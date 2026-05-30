-- Non-destructive duplicate shift tasks detection query
-- This query identifies duplicate tasks that share identical characteristics
-- but keeps legitimate repeated tasks (with different times, order, etc.).

SELECT
  shift_id,
  lower(trim(task_name)) as trimmed_task_name,
  time_mode,
  time_of_day,
  scheduled_time,
  category,
  sort_order,
  template_id,
  count(*) as duplicate_count,
  array_agg(id) as duplicate_ids
FROM public.shift_todos
GROUP BY
  shift_id,
  lower(trim(task_name)),
  time_mode,
  time_of_day,
  scheduled_time,
  category,
  sort_order,
  template_id
HAVING count(*) > 1;
