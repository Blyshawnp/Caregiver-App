begin;

alter table public.push_subscriptions
  add column if not exists device_id text null;

create index if not exists push_subscriptions_user_device_active_idx
  on public.push_subscriptions (user_id, device_id, is_active, updated_at desc);

comment on column public.push_subscriptions.device_id is
  'Stable browser-local device identifier used to match diagnostics and test push to the current device.';

commit;
