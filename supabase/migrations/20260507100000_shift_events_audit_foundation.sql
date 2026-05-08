begin;

create table if not exists public.shift_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  caregiver_id uuid null references public.profiles(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  event_type text not null,
  event_time timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint shift_events_event_type_check
    check (
      event_type in (
        'check_in_reminder_sent',
        'checkout_reminder_sent',
        'auto_checkout_completed',
        'auto_checkout_skipped_location_unknown',
        'auto_checkout_skipped_inside_geofence',
        'auto_checkout_skipped_stale_location'
      )
    ),
  constraint shift_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

alter table public.shift_events
  add column if not exists organization_id uuid,
  add column if not exists shift_id uuid,
  add column if not exists caregiver_id uuid,
  add column if not exists client_id uuid,
  add column if not exists event_type text,
  add column if not exists event_time timestamptz default now(),
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now();

alter table public.shift_events
  alter column organization_id set not null,
  alter column shift_id set not null,
  alter column event_type set not null,
  alter column event_time set default now(),
  alter column event_time set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.shift_events
  drop constraint if exists shift_events_event_type_check,
  drop constraint if exists shift_events_metadata_object_check;

alter table public.shift_events
  add constraint shift_events_event_type_check
    check (
      event_type in (
        'check_in_reminder_sent',
        'checkout_reminder_sent',
        'auto_checkout_completed',
        'auto_checkout_skipped_location_unknown',
        'auto_checkout_skipped_inside_geofence',
        'auto_checkout_skipped_stale_location'
      )
    ),
  add constraint shift_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object');

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shift_events_organization_id_fkey'
  ) then
    alter table public.shift_events
      add constraint shift_events_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'shift_events_shift_id_fkey'
  ) then
    alter table public.shift_events
      add constraint shift_events_shift_id_fkey
      foreign key (shift_id) references public.shifts(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'shift_events_caregiver_id_fkey'
  ) then
    alter table public.shift_events
      add constraint shift_events_caregiver_id_fkey
      foreign key (caregiver_id) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'shift_events_client_id_fkey'
  ) then
    alter table public.shift_events
      add constraint shift_events_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'shift_events_created_by_fkey'
  ) then
    alter table public.shift_events
      add constraint shift_events_created_by_fkey
      foreign key (created_by) references public.profiles(id) on delete set null;
  end if;
end
$do$;

create index if not exists shift_events_shift_id_idx
  on public.shift_events (shift_id);

create index if not exists shift_events_caregiver_id_idx
  on public.shift_events (caregiver_id);

create index if not exists shift_events_event_type_idx
  on public.shift_events (event_type);

create index if not exists shift_events_event_time_idx
  on public.shift_events (event_time desc);

create index if not exists shift_events_organization_id_idx
  on public.shift_events (organization_id);

create index if not exists shift_events_org_type_time_idx
  on public.shift_events (organization_id, event_type, event_time desc);

alter table public.shift_events enable row level security;

drop policy if exists "admins manage shift events in org" on public.shift_events;
create policy "admins manage shift events in org"
on public.shift_events
for all
to authenticated
using (
  organization_id = current_org_id()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = shift_events.organization_id
      and p.role = 'admin'
  )
)
with check (
  organization_id = current_org_id()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = shift_events.organization_id
      and p.role = 'admin'
  )
);

drop policy if exists "caregivers view own shift events" on public.shift_events;
create policy "caregivers view own shift events"
on public.shift_events
for select
to authenticated
using (
  organization_id = current_org_id()
  and caregiver_id = auth.uid()
);

drop policy if exists "clients and family view client shift events" on public.shift_events;
create policy "clients and family view client shift events"
on public.shift_events
for select
to authenticated
using (
  organization_id = current_org_id()
  and client_id is not null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = shift_events.organization_id
      and p.role in ('client', 'family')
  )
);

alter table public.check_ins
  add column if not exists check_out_reason text;

comment on table public.shift_events is
  'Audit trail for shift reminders and automated checkout decisions.';

comment on column public.shift_events.event_type is
  'Constrained reminder and auto-checkout event type used to throttle reminders and audit automated decisions.';

comment on column public.check_ins.check_out_reason is
  'Optional human-readable reason for manual, caregiver, or automated checkout updates.';

commit;
