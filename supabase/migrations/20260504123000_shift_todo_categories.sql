begin;

alter table public.shift_todos
  add column if not exists category text;

alter table public.todo_templates
  add column if not exists category text;

alter table public.shift_todos
  drop constraint if exists shift_todos_category_check;

alter table public.shift_todos
  add constraint shift_todos_category_check
  check (
    category is null
    or category in (
      'adls',
      'medication',
      'meals',
      'mobility',
      'housekeeping',
      'companionship',
      'safety',
      'other'
    )
  );

alter table public.todo_templates
  drop constraint if exists todo_templates_category_check;

alter table public.todo_templates
  add constraint todo_templates_category_check
  check (
    category is null
    or category in (
      'adls',
      'medication',
      'meals',
      'mobility',
      'housekeeping',
      'companionship',
      'safety',
      'other',
      'general',
      'morning',
      'afternoon',
      'evening',
      'bedtime'
    )
  );

commit;
