begin;

-- Add platform column to push_subscriptions if not exists
alter table public.push_subscriptions add column if not exists platform text null;

commit;
