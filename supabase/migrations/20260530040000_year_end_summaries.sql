begin;

-- Create year_end_summaries table
create table if not exists public.year_end_summaries (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null,
  year integer not null,
  total_hours numeric not null default 0,
  total_pay numeric not null default 0,
  total_bonus numeric not null default 0,
  released_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint year_end_summaries_caregiver_year_key unique (caregiver_id, year)
);

-- Create summary_correction_requests table
create table if not exists public.summary_correction_requests (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references public.year_end_summaries(id) on delete cascade,
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status text not null check (status in ('submitted', 'reviewed', 'resolved', 'dismissed')) default 'submitted',
  admin_response text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

-- Add settings columns to organizations table
alter table public.organizations add column if not exists enable_year_end_summary boolean not null default true;
alter table public.organizations add column if not exists year_end_summary_release_month integer not null default 1 check (year_end_summary_release_month between 1 and 12);
alter table public.organizations add column if not exists year_end_summary_release_day integer not null default 5 check (year_end_summary_release_day between 1 and 31);

-- Enable RLS
alter table public.year_end_summaries enable row level security;
alter table public.summary_correction_requests enable row level security;

-- Policies for year_end_summaries
drop policy if exists "caregivers view released year end summaries" on public.year_end_summaries;
create policy "caregivers view released year end summaries"
on public.year_end_summaries
for select
to authenticated
using (
  organization_id = current_org_id()
  and auth.uid() = caregiver_id
  and released_at is not null
  and released_at <= now()
);

drop policy if exists "admins view all year end summaries" on public.year_end_summaries;
create policy "admins view all year end summaries"
on public.year_end_summaries
for select
to authenticated
using (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id = year_end_summaries.organization_id
  )
);

drop policy if exists "admins modify year end summaries" on public.year_end_summaries;
create policy "admins modify year end summaries"
on public.year_end_summaries
for all
to authenticated
using (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id = year_end_summaries.organization_id
  )
)
with check (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id = year_end_summaries.organization_id
  )
);

-- Policies for summary_correction_requests
drop policy if exists "caregivers view their own correction requests" on public.summary_correction_requests;
create policy "caregivers view their own correction requests"
on public.summary_correction_requests
for select
to authenticated
using (
  auth.uid() = caregiver_id
);

drop policy if exists "admins view all correction requests" on public.summary_correction_requests;
create policy "admins view all correction requests"
on public.summary_correction_requests
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id = (select organization_id from public.year_end_summaries y where y.id = summary_correction_requests.summary_id)
  )
);

drop policy if exists "caregivers insert correction requests" on public.summary_correction_requests;
create policy "caregivers insert correction requests"
on public.summary_correction_requests
for insert
to authenticated
with check (
  auth.uid() = caregiver_id
);

drop policy if exists "members update correction requests" on public.summary_correction_requests;
create policy "members update correction requests"
on public.summary_correction_requests
for update
to authenticated
using (
  auth.uid() = caregiver_id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id = (select organization_id from public.year_end_summaries y where y.id = summary_correction_requests.summary_id)
  )
)
with check (
  auth.uid() = caregiver_id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id = (select organization_id from public.year_end_summaries y where y.id = summary_correction_requests.summary_id)
  )
);

commit;
