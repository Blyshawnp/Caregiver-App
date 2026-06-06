-- Read-only push subscription diagnostics for one browser device.
-- Replace with the device id shown in notification diagnostics:
-- '5307f3d4-d830-4c16-a587-500da5093fed'
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
where device_id = '5307f3d4-d830-4c16-a587-500da5093fed'
order by updated_at desc nulls last, created_at desc;
