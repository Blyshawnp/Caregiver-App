begin;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null, -- 'bulk_delete_shifts', 'bulk_add_tasks'
  shift_count integer not null default 0,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

-- Admins and standard org members can view activity logs from their organization.
drop policy if exists "users can view activity logs in org" on public.activity_logs;
create policy "users can view activity logs in org"
on public.activity_logs
for select
to authenticated
using (
  organization_id = current_org_id()
);

-- Users can insert their own activity logs.
drop policy if exists "users can insert own activity logs" on public.activity_logs;
create policy "users can insert own activity logs"
on public.activity_logs
for insert
to authenticated
with check (
  organization_id = current_org_id()
  and actor_id = auth.uid()
);

commit;
