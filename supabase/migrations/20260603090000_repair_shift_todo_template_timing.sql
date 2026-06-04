-- Fill timing metadata for future/incomplete shift tasks that were copied from
-- task templates before timing fields were preserved.
update public.shift_todos st
set
  time_mode = tt.time_mode,
  time_of_day = tt.time_of_day,
  scheduled_time = tt.scheduled_time,
  sort_order = coalesce(nullif(st.sort_order, 0), tt.sort_order, st.sort_order),
  importance = tt.importance,
  is_optional = tt.is_optional,
  is_prn = tt.is_prn,
  category = tt.category
from public.todo_templates tt
left join public.shifts s on s.id = st.shift_id
where st.template_id = tt.id
  and coalesce(st.is_completed, false) = false
  and (s.scheduled_end is null or s.scheduled_end >= now())
  and (
    st.time_mode is null
    or st.time_mode = 'unscheduled'
    or (st.time_mode = 'time_of_day' and st.time_of_day is null)
    or (st.time_mode = 'exact_time' and st.scheduled_time is null)
  )
  and (
    tt.time_mode <> 'unscheduled'
    or tt.time_of_day is not null
    or tt.scheduled_time is not null
  );
