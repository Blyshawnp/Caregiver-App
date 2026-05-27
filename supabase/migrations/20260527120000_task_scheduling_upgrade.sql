alter table if exists public.todo_templates
  add column if not exists is_optional boolean not null default false,
  add column if not exists is_prn boolean not null default false,
  add column if not exists importance text not null default 'medium',
  add column if not exists time_mode text not null default 'unscheduled',
  add column if not exists time_of_day text null,
  add column if not exists scheduled_time time null,
  add column if not exists sort_order integer not null default 0,
  add column if not exists allow_repeat boolean not null default true;

alter table if exists public.shift_todos
  add column if not exists is_optional boolean not null default false,
  add column if not exists is_prn boolean not null default false,
  add column if not exists importance text not null default 'medium',
  add column if not exists time_mode text not null default 'unscheduled',
  add column if not exists time_of_day text null,
  add column if not exists scheduled_time time null,
  add column if not exists sort_order integer not null default 0,
  add column if not exists allow_repeat boolean not null default true;

alter table if exists public.todo_templates
  add constraint todo_templates_importance_check
  check (importance in ('low', 'medium', 'high', 'critical')) not valid;

alter table if exists public.todo_templates
  add constraint todo_templates_time_mode_check
  check (time_mode in ('time_of_day', 'exact_time', 'unscheduled')) not valid;

alter table if exists public.todo_templates
  add constraint todo_templates_time_of_day_check
  check (time_of_day is null or time_of_day in ('morning', 'early_afternoon', 'late_afternoon', 'evening', 'bedtime')) not valid;

alter table if exists public.shift_todos
  add constraint shift_todos_importance_check
  check (importance in ('low', 'medium', 'high', 'critical')) not valid;

alter table if exists public.shift_todos
  add constraint shift_todos_time_mode_check
  check (time_mode in ('time_of_day', 'exact_time', 'unscheduled')) not valid;

alter table if exists public.shift_todos
  add constraint shift_todos_time_of_day_check
  check (time_of_day is null or time_of_day in ('morning', 'early_afternoon', 'late_afternoon', 'evening', 'bedtime')) not valid;

create index if not exists idx_todo_templates_schedule_order
  on public.todo_templates (organization_id, caregiver_id, sort_order, time_mode, time_of_day, scheduled_time, importance);

create index if not exists idx_shift_todos_schedule_order
  on public.shift_todos (shift_id, time_mode, time_of_day, scheduled_time, importance, sort_order);
