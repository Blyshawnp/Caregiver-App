-- Read-only push subscription diagnostics for one browser device.
-- Replace with the device id shown in notification diagnostics:
-- 'a232758d-0082-4a57-b052-dc98a6f9150b'
--
-- If the current endpoint matches the browser endpoint but active = false,
-- the save route is not reactivating the current subscription.
--
-- This query intentionally does not select auth, p256dh, service-role keys,
-- private VAPID keys, or full endpoints.

select
  id,
  user_id,
  device_id,
  is_active as active,
  left(endpoint, 32) || '...' || right(endpoint, 16) as endpoint_masked,
  encode(digest(endpoint, 'sha256'), 'hex') as endpoint_sha256,
  vapid_key_fingerprint,
  created_at,
  updated_at,
  last_seen_at,
  disabled_at
from public.push_subscriptions
where device_id = 'a232758d-0082-4a57-b052-dc98a6f9150b'
order by updated_at desc nulls last, created_at desc;
