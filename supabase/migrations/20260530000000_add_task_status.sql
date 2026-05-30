-- Add task status column to shift_todos
alter table public.shift_todos add column if not exists status text default 'pending';

-- Drop constraint if exists
alter table public.shift_todos drop constraint if exists shift_todos_status_check;

-- Add check constraint for status options
alter table public.shift_todos add constraint shift_todos_status_check
  check (status in ('pending', 'completed', 'skipped', 'not_needed', 'client_declined', 'needs_follow_up'));

-- Backfill completed tasks
update public.shift_todos
set status = 'completed'
where is_completed = true and status = 'pending';
