-- Repair shift task timing metadata from task templates.
-- Run the PREVIEW query first. Review every row before running the UPDATE.
-- This intentionally targets future or incomplete shift tasks only.

-- PREVIEW: future/incomplete shift tasks with a template link but missing timing metadata.
select
  st.id as shift_task_id,
  st.shift_id,
  s.scheduled_start,
  st.task_name,
  st.template_id,
  st.task_template_id,
  st.time_mode as current_time_mode,
  st.time_of_day as current_time_of_day,
  st.scheduled_time as current_scheduled_time,
  tt.time_mode as template_time_mode,
  tt.time_of_day as template_time_of_day,
  tt.scheduled_time as template_scheduled_time,
  tt.sort_order as template_sort_order
from public.shift_todos st
join public.shifts s on s.id = st.shift_id
join public.task_templates tt on tt.id = coalesce(st.template_id, st.task_template_id)
where coalesce(st.is_completed, false) = false
  and coalesce(s.is_complete, false) = false
  and s.scheduled_start >= now()
  and (
    st.time_mode is null
    or st.time_mode = 'unscheduled'
    or (st.time_mode = 'time_of_day' and st.time_of_day is null)
    or (st.time_mode = 'exact_time' and st.scheduled_time is null)
  )
order by s.scheduled_start, st.task_name;

-- UPDATE: copy missing timing metadata from linked templates.
-- Uncomment and run only after the preview result is correct.
/*
update public.shift_todos st
set
  time_mode = coalesce(nullif(st.time_mode, 'unscheduled'), tt.time_mode),
  time_of_day = coalesce(st.time_of_day, tt.time_of_day),
  scheduled_time = coalesce(st.scheduled_time, tt.scheduled_time),
  sort_order = coalesce(st.sort_order, tt.sort_order)
from public.shifts s
cross join public.task_templates tt
where s.id = st.shift_id
  and tt.id = coalesce(st.template_id, st.task_template_id)
  and coalesce(st.is_completed, false) = false
  and coalesce(s.is_complete, false) = false
  and s.scheduled_start >= now()
  and (
    st.time_mode is null
    or st.time_mode = 'unscheduled'
    or (st.time_mode = 'time_of_day' and st.time_of_day is null)
    or (st.time_mode = 'exact_time' and st.scheduled_time is null)
  );
*/
