-- Manual and reviewable cleanup script for duplicated shift tasks
-- This script only removes accidental duplicate shift tasks (keeping the earliest created row)
-- and preserves legitimate repeated tasks with different details.

-- 1. Show the duplicate groups and their counts before cleanup
SELECT
  shift_id,
  lower(trim(task_name)) as trimmed_task_name,
  time_mode,
  time_of_day,
  scheduled_time,
  category,
  sort_order,
  template_id,
  count(*) as duplicate_count
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

-- 2. Optional/reviewable deletion statement
-- This deletes the later duplicates (based on created_at and id) of any exact matching task group
-- and retains only the earliest created instance.
DELETE FROM public.shift_todos
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY
          shift_id,
          lower(trim(task_name)),
          time_mode,
          time_of_day,
          scheduled_time,
          category,
          sort_order,
          template_id
        ORDER BY created_at ASC, id ASC
      ) as rn
    FROM public.shift_todos
  ) t
  WHERE t.rn > 1
);
