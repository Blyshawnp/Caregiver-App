begin;

create unique index if not exists shift_events_check_in_reminder_once_idx
  on public.shift_events (shift_id)
  where event_type = 'check_in_reminder_sent';

commit;
