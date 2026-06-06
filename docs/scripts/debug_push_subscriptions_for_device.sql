-- Read-only push subscription diagnostics for one browser device.
-- Replace with the device id shown in notification diagnostics:
-- 'd3453918-8ec6-40a7-9976-8c59ad32ee07'
--
-- If the current endpoint matches the browser endpoint but active = false,
-- the save route is not reactivating the current subscription.
-- If endpoint/fingerprint/keys match but active status is false, check whether
-- code is writing is_active while diagnostics/test read active, or vice versa.
--
-- This query intentionally does not select full auth, full p256dh,
-- service-role keys, private VAPID keys, or full endpoints.

-- Column audit. The local migrations define is_active and do not define
-- active, status, or invalid_reason for public.push_subscriptions.
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'push_subscriptions'
  and column_name in ('active', 'is_active', 'status', 'invalid_reason')
order by column_name;

select
  id,
  user_id,
  device_id,
  is_active as active,
  'is_active' as canonical_active_column,
  left(endpoint, 32) || '...' || right(endpoint, 16) as endpoint_masked,
  encode(digest(endpoint, 'sha256'), 'hex') as endpoint_sha256,
  left(p256dh, 10) || '...' as p256dh_masked,
  encode(digest(p256dh, 'sha256'), 'hex') as p256dh_sha256,
  left(auth, 6) || '...' as auth_masked,
  encode(digest(auth, 'sha256'), 'hex') as auth_sha256,
  vapid_key_fingerprint,
  created_at,
  updated_at,
  last_seen_at,
  disabled_at
from public.push_subscriptions
where device_id = 'd3453918-8ec6-40a7-9976-8c59ad32ee07'
order by updated_at desc nulls last, created_at desc;
