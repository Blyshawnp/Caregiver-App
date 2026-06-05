-- Add vapid_key_fingerprint column to push_subscriptions if not exists
alter table public.push_subscriptions add column if not exists vapid_key_fingerprint text null;
