begin;

alter table public.check_ins
  add column if not exists check_out_reason text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists shift_events_checkout_reminder_once_idx
  on public.shift_events (shift_id)
  where event_type = 'checkout_reminder_sent';

create unique index if not exists shift_events_auto_checkout_completed_once_idx
  on public.shift_events (shift_id)
  where event_type = 'auto_checkout_completed';

create index if not exists check_ins_shift_end_geofence_active_idx
  on public.check_ins (check_out_time, check_in_time, last_location_at, last_location_within_geofence);

create or replace function public.process_shift_end_geofence_checkout()
returns table (
  check_in_id uuid,
  shift_id uuid,
  caregiver_id uuid,
  organization_id uuid,
  checked_out_at timestamptz,
  distance_meters numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with active as (
    select
      ci.id as check_in_id,
      ci.shift_id,
      ci.caregiver_id,
      s.organization_id,
      s.scheduled_end,
      s.client_id,
      c.full_name as client_name,
      coalesce(c.geofence_radius_meters, 150) as geofence_radius_meters,
      ci.check_in_time,
      ci.last_location_at,
      ci.last_location_latitude,
      ci.last_location_longitude,
      ci.last_location_distance_meters,
      ci.last_location_within_geofence,
      case
        when ci.last_location_distance_meters is not null then ci.last_location_distance_meters::numeric
        when ci.last_location_latitude is not null
          and ci.last_location_longitude is not null
          and c.latitude is not null
          and c.longitude is not null
        then (
          6371000 * 2 * asin(
            sqrt(
              power(sin(radians(((c.latitude - ci.last_location_latitude) / 2)::double precision)), 2)
              + cos(radians(ci.last_location_latitude::double precision))
              * cos(radians(c.latitude::double precision))
              * power(sin(radians(((c.longitude - ci.last_location_longitude) / 2)::double precision)), 2)
            )
          )
        )::numeric
        else null
      end as computed_distance_meters
    from public.check_ins ci
    join public.shifts s on s.id = ci.shift_id
    left join public.clients c on c.id = s.client_id
    where ci.check_in_time is not null
      and ci.check_out_time is null
      and s.caregiver_id is not null
      and ci.caregiver_id = s.caregiver_id
      and coalesce(s.is_released, false) = false
      and coalesce(s.assignment_status, 'accepted') not in ('pending', 'declined')
      and now() >= s.scheduled_end - interval '60 minutes'
  ),
  fresh_outside as (
    select *
    from active
    where last_location_at is not null
      and last_location_at >= now() - interval '15 minutes'
      and (
        last_location_within_geofence = false
        or (
          computed_distance_meters is not null
          and computed_distance_meters > geofence_radius_meters
        )
      )
  ),
  reminder_events as (
    insert into public.shift_events (
      organization_id,
      shift_id,
      caregiver_id,
      client_id,
      event_type,
      event_time,
      metadata
    )
    select
      fo.organization_id,
      fo.shift_id,
      fo.caregiver_id,
      fo.client_id,
      'checkout_reminder_sent',
      now(),
      jsonb_build_object(
        'distance_meters', fo.computed_distance_meters,
        'location_recorded_at', fo.last_location_at,
        'geofence_radius_meters', fo.geofence_radius_meters,
        'monitoring_window_minutes', 60,
        'grace_period_minutes', 5
      )
    from fresh_outside fo
    where not exists (
      select 1
      from public.shift_events se
      where se.shift_id = fo.shift_id
        and se.event_type = 'checkout_reminder_sent'
    )
    on conflict do nothing
    returning organization_id, shift_id, caregiver_id, client_id
  ),
  reminder_notifications as (
    insert into public.notifications (
      organization_id,
      recipient_id,
      kind,
      title,
      body,
      link,
      related_shift_id
    )
    select
      re.organization_id,
      re.caregiver_id,
      'checkout_reminder',
      'Remember to check out',
      concat(
        'It looks like you may have left ',
        coalesce(a.client_name, 'the client'),
        '. Please check out if your shift is finished.'
      ),
      concat('/schedule/', re.shift_id::text, '/check-out'),
      re.shift_id
    from reminder_events re
    join active a on a.shift_id = re.shift_id
    where re.caregiver_id is not null
    returning id
  ),
  auto_eligible as (
    select fo.*, se.event_time as reminder_sent_at
    from fresh_outside fo
    join public.shift_events se
      on se.shift_id = fo.shift_id
     and se.event_type = 'checkout_reminder_sent'
    where se.event_time <= now() - interval '5 minutes'
      and not exists (
        select 1
        from public.shift_events completed
        where completed.shift_id = fo.shift_id
          and completed.event_type = 'auto_checkout_completed'
      )
  ),
  updated as (
    update public.check_ins ci
    set
      check_out_time = now(),
      check_out_latitude = ae.last_location_latitude,
      check_out_longitude = ae.last_location_longitude,
      check_out_within_geofence = false,
      flagged_outside_geofence = true,
      flag_reason = concat(
        'Automatically checked out after geofence reminder',
        case
          when ae.computed_distance_meters is null then ''
          else concat(' (', round(ae.computed_distance_meters)::text, 'm away)')
        end
      ),
      check_out_method = 'auto_geofence_after_checkout_reminder',
      check_out_reason = 'Automatically checked out after geofence reminder.',
      check_out_by = null,
      total_minutes = greatest(0, round(extract(epoch from (now() - ci.check_in_time)) / 60.0))::integer,
      updated_at = now()
    from auto_eligible ae
    where ci.id = ae.check_in_id
      and ci.check_out_time is null
    returning
      ci.id as check_in_id,
      ci.shift_id,
      ci.caregiver_id,
      ae.organization_id,
      ci.check_out_time as checked_out_at,
      ae.computed_distance_meters,
      ae.client_id,
      ae.client_name,
      ae.last_location_at,
      ae.geofence_radius_meters
  ),
  completed_events as (
    insert into public.shift_events (
      organization_id,
      shift_id,
      caregiver_id,
      client_id,
      event_type,
      event_time,
      metadata
    )
    select
      u.organization_id,
      u.shift_id,
      u.caregiver_id,
      u.client_id,
      'auto_checkout_completed',
      u.checked_out_at,
      jsonb_build_object(
        'distance_meters', u.computed_distance_meters,
        'location_recorded_at', u.last_location_at,
        'geofence_radius_meters', u.geofence_radius_meters,
        'checkout_method', 'auto_geofence_after_checkout_reminder',
        'grace_period_minutes', 5
      )
    from updated u
    on conflict do nothing
    returning id
  ),
  caregiver_notifications as (
    insert into public.notifications (
      organization_id,
      recipient_id,
      kind,
      title,
      body,
      link,
      related_shift_id
    )
    select
      u.organization_id,
      u.caregiver_id,
      'auto_check_out',
      'You were automatically checked out',
      concat(
        'You were automatically checked out after a geofence reminder for ',
        coalesce(u.client_name, 'your shift'),
        '.'
      ),
      concat('/schedule/', u.shift_id::text),
      u.shift_id
    from updated u
    where u.caregiver_id is not null
    returning id
  ),
  care_team_notifications as (
    insert into public.notifications (
      organization_id,
      recipient_id,
      kind,
      title,
      body,
      link,
      related_shift_id
    )
    select
      u.organization_id,
      p.id,
      'auto_check_out',
      'Caregiver automatically checked out',
      concat(
        'A caregiver was automatically checked out after a geofence reminder for ',
        coalesce(u.client_name, 'a shift'),
        case
          when u.computed_distance_meters is null then '.'
          else concat(' (', round(u.computed_distance_meters)::text, 'm away).')
        end
      ),
      concat('/schedule/', u.shift_id::text),
      u.shift_id
    from updated u
    join public.profiles p
      on p.organization_id = u.organization_id
     and p.is_active = true
     and p.role in ('admin', 'client', 'family')
     and p.id <> u.caregiver_id
    returning id
  )
  select
    u.check_in_id,
    u.shift_id,
    u.caregiver_id,
    u.organization_id,
    u.checked_out_at,
    u.computed_distance_meters as distance_meters
  from updated u;
end;
$$;

revoke all on function public.process_shift_end_geofence_checkout() from public;
grant execute on function public.process_shift_end_geofence_checkout() to service_role;

create or replace function public.auto_checkout_after_8pm_geofence()
returns table (
  check_in_id uuid,
  shift_id uuid,
  caregiver_id uuid,
  organization_id uuid,
  checked_out_at timestamptz,
  distance_meters numeric
)
language sql
security definer
set search_path = public, extensions
as $$
  select *
  from public.process_shift_end_geofence_checkout();
$$;

revoke all on function public.auto_checkout_after_8pm_geofence() from public;
grant execute on function public.auto_checkout_after_8pm_geofence() to service_role;

commit;
