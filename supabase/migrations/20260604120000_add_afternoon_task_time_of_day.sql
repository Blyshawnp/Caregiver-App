alter table public.todo_templates
  drop constraint if exists todo_templates_time_of_day_check;

alter table public.todo_templates
  add constraint todo_templates_time_of_day_check
  check (time_of_day is null or time_of_day in ('morning', 'early_afternoon', 'afternoon', 'late_afternoon', 'evening', 'bedtime')) not valid;

alter table public.shift_todos
  drop constraint if exists shift_todos_time_of_day_check;

alter table public.shift_todos
  add constraint shift_todos_time_of_day_check
  check (time_of_day is null or time_of_day in ('morning', 'early_afternoon', 'afternoon', 'late_afternoon', 'evening', 'bedtime')) not valid;
