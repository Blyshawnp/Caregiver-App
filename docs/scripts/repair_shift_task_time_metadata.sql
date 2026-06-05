-- Repair shift task timing metadata from todo_templates.
-- Run the PREVIEW query first. Review every row before running the UPDATE.
-- This script is intentionally limited to future, incomplete shift tasks.

-- PREVIEW: future/incomplete shift tasks with a template link but missing timing metadata.
select
  st.id as shift_task_id,
  st.shift_id,
  s.scheduled_start,
  st.task_name,
  st.template_id,
  st.time_mode as current_time_mode,
  st.time_of_day as current_time_of_day,
  st.scheduled_time as current_scheduled_time,
  st.sort_order as current_sort_order,
  tt.time_mode as template_time_mode,
  tt.time_of_day as template_time_of_day,
  tt.scheduled_time as template_scheduled_time,
  tt.sort_order as template_sort_order
from public.shift_todos st
join public.shifts s on s.id = st.shift_id
join public.todo_templates tt on tt.id = st.template_id
where coalesce(st.is_completed, false) = false
  and s.scheduled_start >= now()
  and (
    st.time_mode is null
    or (
      st.time_mode = 'unscheduled'
      and st.time_of_day is null
      and st.scheduled_time is null
      and (
        tt.time_mode <> 'unscheduled'
        or tt.time_of_day is not null
        or tt.scheduled_time is not null
      )
    )
    or (st.time_mode = 'time_of_day' and st.time_of_day is null and tt.time_of_day is not null)
    or (st.time_mode = 'exact_time' and st.scheduled_time is null and tt.scheduled_time is not null)
  )
order by s.scheduled_start, st.task_name;

-- UPDATE: copy only missing timing metadata from linked templates.
-- Uncomment and run only after the preview result is correct.
/*
update public.shift_todos st
set
  time_mode = case
    when st.time_mode is null then tt.time_mode
    when st.time_mode = 'unscheduled'
      and st.time_of_day is null
      and st.scheduled_time is null
      and (tt.time_mode <> 'unscheduled' or tt.time_of_day is not null or tt.scheduled_time is not null)
      then tt.time_mode
    else st.time_mode
  end,
  time_of_day = coalesce(st.time_of_day, tt.time_of_day),
  scheduled_time = coalesce(st.scheduled_time, tt.scheduled_time),
  sort_order = coalesce(st.sort_order, tt.sort_order)
from public.shifts s,
  public.todo_templates tt
where s.id = st.shift_id
  and tt.id = st.template_id
  and coalesce(st.is_completed, false) = false
  and s.scheduled_start >= now()
  and (
    st.time_mode is null
    or (
      st.time_mode = 'unscheduled'
      and st.time_of_day is null
      and st.scheduled_time is null
      and (
        tt.time_mode <> 'unscheduled'
        or tt.time_of_day is not null
        or tt.scheduled_time is not null
      )
    )
    or (st.time_mode = 'time_of_day' and st.time_of_day is null and tt.time_of_day is not null)
    or (st.time_mode = 'exact_time' and st.scheduled_time is null and tt.scheduled_time is not null)
  );
*/

-- VERIFY: count future/incomplete linked tasks that still have no usable timing metadata.
select count(*) as remaining_linked_unscheduled_tasks
from public.shift_todos st
join public.shifts s on s.id = st.shift_id
where coalesce(st.is_completed, false) = false
  and s.scheduled_start >= now()
  and st.template_id is not null
  and (
    (coalesce(st.time_mode, 'unscheduled') = 'unscheduled' and st.time_of_day is null and st.scheduled_time is null)
    or (st.time_mode = 'time_of_day' and st.time_of_day is null)
    or (st.time_mode = 'exact_time' and st.scheduled_time is null)
  );

-- VERIFY: rows that could not be repaired because no matching template exists.
select
  st.id as shift_task_id,
  st.shift_id,
  s.scheduled_start,
  st.task_name,
  st.template_id,
  st.time_mode,
  st.time_of_day,
  st.scheduled_time
from public.shift_todos st
join public.shifts s on s.id = st.shift_id
left join public.todo_templates tt on tt.id = st.template_id
where coalesce(st.is_completed, false) = false
  and s.scheduled_start >= now()
  and st.template_id is not null
  and tt.id is null
order by s.scheduled_start, st.task_name;
