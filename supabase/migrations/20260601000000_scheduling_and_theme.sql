begin;

-- 1. Add default days of week and scheduling constraints to todo_templates table
alter table public.todo_templates add column if not exists default_days_of_week integer[] null;
alter table public.todo_templates add column if not exists auto_add_to_matching_shifts boolean not null default true;
alter table public.todo_templates add column if not exists auto_add_start_date date null;
alter table public.todo_templates add column if not exists auto_add_end_date date null;
alter table public.todo_templates add column if not exists applies_to_all_clients boolean not null default true;

-- 2. Add theme preference to profiles table
alter table public.profiles add column if not exists theme_preference text not null default 'default';

commit;
