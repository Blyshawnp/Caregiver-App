begin;

alter table public.check_ins
  add column if not exists updated_at timestamptz not null default now();

create index if not exists check_ins_active_auto_checkout_idx
  on public.check_ins (check_out_time, check_in_time, last_location_within_geofence, last_location_at);

create or replace function public.auto_checkout_after_8pm_geofence()
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
  with candidates as (
    select
      ci.id as check_in_id,
      ci.shift_id,
      ci.caregiver_id,
      s.organization_id,
      s.scheduled_end,
      s.client_id,
      c.full_name as client_name,
      c.latitude as client_latitude,
      c.longitude as client_longitude,
      coalesce(c.geofence_radius_meters, 150) as geofence_radius_meters,
      ci.last_location_at,
      ci.last_location_latitude,
      ci.last_location_longitude,
      ci.last_location_distance_meters,
      ci.last_location_within_geofence,
      coalesce(
        nullif(to_jsonb(c)->>'timezone', ''),
        nullif(to_jsonb(c)->>'time_zone', ''),
        nullif(to_jsonb(o)->>'timezone', ''),
        nullif(to_jsonb(o)->>'time_zone', ''),
        'America/New_York'
      ) as local_timezone,
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
    left join public.organizations o on o.id = s.organization_id
    where ci.check_in_time is not null
      and ci.check_out_time is null
      and s.scheduled_end <= now()
      and ci.last_location_at is not null
      and ci.last_location_at >= now() - interval '30 minutes'
  ),
  eligible as (
    select *
    from candidates
    where (now() at time zone local_timezone)::time >= time '20:00'
      and (
        last_location_within_geofence = false
        or (
          computed_distance_meters is not null
          and computed_distance_meters > geofence_radius_meters
        )
      )
  ),
  updated as (
    update public.check_ins ci
    set
      check_out_time = coalesce(e.last_location_at, now()),
      check_out_latitude = e.last_location_latitude,
      check_out_longitude = e.last_location_longitude,
      check_out_within_geofence = false,
      flagged_outside_geofence = true,
      flag_reason = concat(
        'Auto-checked out after 8 PM outside geofence',
        case
          when e.computed_distance_meters is null then ''
          else concat(' (', round(e.computed_distance_meters)::text, 'm away)')
        end
      ),
      check_out_method = 'auto_geofence_after_8pm',
      check_out_by = null,
      updated_at = now()
    from eligible e
    where ci.id = e.check_in_id
      and ci.check_out_time is null
    returning
      ci.id as check_in_id,
      ci.shift_id,
      ci.caregiver_id,
      e.organization_id,
      ci.check_out_time as checked_out_at,
      e.computed_distance_meters,
      e.client_name
  ),
  recipient_notifications as (
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
      'Auto-checked out after 8 PM',
      concat(
        'A caregiver was auto-checked out after leaving ',
        coalesce(u.client_name, 'the client'),
        '''s geofence',
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
     and p.role in ('admin', 'client')
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
      'You were auto-checked out',
      concat(
        'You were auto-checked out after 8 PM because your last known location was outside ',
        coalesce(u.client_name, 'the client'),
        '''s geofence.'
      ),
      concat('/schedule/', u.shift_id::text),
      u.shift_id
    from updated u
    where u.caregiver_id is not null
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

revoke all on function public.auto_checkout_after_8pm_geofence() from public;
grant execute on function public.auto_checkout_after_8pm_geofence() to service_role;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (
      select 1
      from cron.job
      where jobname = 'auto-checkout-after-8pm-geofence'
    ) then
      perform cron.unschedule('auto-checkout-after-8pm-geofence');
    end if;

    perform cron.schedule(
      'auto-checkout-after-8pm-geofence',
      '*/15 * * * *',
      $job$select public.auto_checkout_after_8pm_geofence();$job$
    );
  end if;
exception
  when invalid_schema_name or undefined_function then
    raise notice 'pg_cron is not available. Use a Supabase Scheduled Edge Function fallback.';
end
$do$;

commit;
