begin;

create table if not exists public.checkout_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  flag_type text not null,
  incomplete_task_count integer not null default 0,
  incomplete_task_ids uuid[] not null default '{}',
  incomplete_task_names text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint checkout_flags_type_check
    check (flag_type in ('incomplete_tasks')),
  constraint checkout_flags_incomplete_count_check
    check (incomplete_task_count >= 0)
);

alter table public.checkout_flags
  add column if not exists organization_id uuid,
  add column if not exists shift_id uuid,
  add column if not exists check_in_id uuid,
  add column if not exists caregiver_id uuid,
  add column if not exists flag_type text default 'incomplete_tasks',
  add column if not exists incomplete_task_count integer default 0,
  add column if not exists incomplete_task_ids uuid[] default '{}',
  add column if not exists incomplete_task_names text[] default '{}',
  add column if not exists created_at timestamptz default now();

alter table public.checkout_flags
  alter column organization_id set not null,
  alter column shift_id set not null,
  alter column check_in_id set not null,
  alter column caregiver_id set not null,
  alter column flag_type set default 'incomplete_tasks',
  alter column flag_type set not null,
  alter column incomplete_task_count set default 0,
  alter column incomplete_task_count set not null,
  alter column incomplete_task_ids set default '{}',
  alter column incomplete_task_ids set not null,
  alter column incomplete_task_names set default '{}',
  alter column incomplete_task_names set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.checkout_flags
  drop constraint if exists checkout_flags_type_check,
  drop constraint if exists checkout_flags_incomplete_count_check;

alter table public.checkout_flags
  add constraint checkout_flags_type_check
    check (flag_type in ('incomplete_tasks')),
  add constraint checkout_flags_incomplete_count_check
    check (incomplete_task_count >= 0);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'checkout_flags_shift_id_fkey'
  ) then
    alter table public.checkout_flags
      add constraint checkout_flags_shift_id_fkey
      foreign key (shift_id) references public.shifts(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'checkout_flags_check_in_id_fkey'
  ) then
    alter table public.checkout_flags
      add constraint checkout_flags_check_in_id_fkey
      foreign key (check_in_id) references public.check_ins(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'checkout_flags_caregiver_id_fkey'
  ) then
    alter table public.checkout_flags
      add constraint checkout_flags_caregiver_id_fkey
      foreign key (caregiver_id) references public.profiles(id) on delete cascade;
  end if;
end
$$;

create index if not exists checkout_flags_org_created_idx
  on public.checkout_flags (organization_id, created_at desc);

create index if not exists checkout_flags_shift_idx
  on public.checkout_flags (shift_id);

create index if not exists checkout_flags_caregiver_created_idx
  on public.checkout_flags (caregiver_id, created_at desc);

alter table public.checkout_flags enable row level security;

drop policy if exists "admins view checkout flags in org" on public.checkout_flags;
create policy "admins view checkout flags in org"
on public.checkout_flags
for select
to authenticated
using (
  is_admin()
  and organization_id = current_org_id()
);

drop policy if exists "caregivers view own checkout flags" on public.checkout_flags;
create policy "caregivers view own checkout flags"
on public.checkout_flags
for select
to authenticated
using (
  caregiver_id = auth.uid()
  and organization_id = current_org_id()
);

commit;
