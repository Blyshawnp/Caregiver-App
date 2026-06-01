-- Migration: Create shift_time_change_requests table and secure RLS policies.
create table if not exists public.shift_time_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  requested_check_in_time timestamptz null,
  requested_check_out_time timestamptz null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  admin_notes text null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.shift_time_change_requests enable row level security;

-- Row Level Security Policies
create policy "users view shift time change requests"
on public.shift_time_change_requests
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.organization_id = shift_time_change_requests.organization_id
    and (
      p.role = 'admin'
      or (p.role = 'caregiver' and p.id = shift_time_change_requests.caregiver_id)
    )
  )
);

create policy "users insert shift time change requests"
on public.shift_time_change_requests
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.organization_id = shift_time_change_requests.organization_id
    and p.role = 'caregiver'
    and p.id = shift_time_change_requests.caregiver_id
  )
);

create policy "users update shift time change requests"
on public.shift_time_change_requests
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.organization_id = shift_time_change_requests.organization_id
    and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.organization_id = shift_time_change_requests.organization_id
    and p.role = 'admin'
  )
);
