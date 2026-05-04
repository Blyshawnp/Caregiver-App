begin;

create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

alter table public.shift_todos
  add column if not exists category text;

alter table public.todo_templates
  add column if not exists category text;

alter table public.shift_todos
  drop constraint if exists shift_todos_category_check;

alter table public.todo_templates
  drop constraint if exists todo_templates_category_check;

create index if not exists task_categories_org_sort_idx
  on public.task_categories (organization_id, is_active, sort_order, label);

alter table public.task_categories enable row level security;

drop policy if exists "org members view task categories" on public.task_categories;
create policy "org members view task categories"
on public.task_categories
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = task_categories.organization_id
  )
);

drop policy if exists "admins clients manage task categories" on public.task_categories;
create policy "admins clients manage task categories"
on public.task_categories
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = task_categories.organization_id
      and p.role in ('admin', 'client')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = task_categories.organization_id
      and p.role in ('admin', 'client')
  )
);

insert into public.task_categories (organization_id, key, label, sort_order)
select o.id, seed.key, seed.label, seed.sort_order
from public.organizations o
cross join (
  values
    ('adls', 'ADLs', 10),
    ('medication', 'Medication', 20),
    ('meals', 'Meals', 30),
    ('mobility', 'Mobility', 40),
    ('housekeeping', 'Housekeeping', 50),
    ('companionship', 'Companionship', 60),
    ('safety', 'Safety', 70),
    ('other', 'Other', 80)
) as seed(key, label, sort_order)
on conflict (organization_id, key) do nothing;

commit;
