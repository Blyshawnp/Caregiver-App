-- Developer Verification Query: Inspect recently created shifts and their tasks timing metadata
-- This query helps verify that newly created shifts correctly copied task scheduling fields (time_mode, time_of_day, scheduled_time, sort_order) from todo_templates.

select
  s.id as shift_id,
  s.scheduled_start,
  st.id as shift_task_id,
  st.task_name,
  st.template_id,
  st.time_mode as shift_task_time_mode,
  st.time_of_day as shift_task_time_of_day,
  st.scheduled_time as shift_task_scheduled_time,
  st.sort_order as shift_task_sort_order,
  tt.time_mode as template_time_mode,
  tt.time_of_day as template_time_of_day,
  tt.scheduled_time as template_scheduled_time,
  tt.sort_order as template_sort_order
from public.shifts s
join public.shift_todos st on st.shift_id = s.id
left join public.todo_templates tt on tt.id = st.template_id
where s.created_at >= now() - interval '1 hour'
order by s.created_at desc, st.sort_order;
