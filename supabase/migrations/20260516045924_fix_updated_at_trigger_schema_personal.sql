begin;

alter table public.clients
  add column if not exists updated_at timestamptz not null default now();

alter table public.invitations
  add column if not exists updated_at timestamptz not null default now();

alter table public.organizations
  add column if not exists updated_at timestamptz not null default now();

alter table public.pay_periods
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

alter table public.shift_todos
  add column if not exists updated_at timestamptz not null default now();

alter table public.shift_types
  add column if not exists updated_at timestamptz not null default now();

alter table public.shifts
  add column if not exists updated_at timestamptz not null default now();

alter table public.todo_templates
  add column if not exists updated_at timestamptz not null default now();

commit;
