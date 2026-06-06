-- Preview-first repair for one current browser push subscription.
-- Do not run the UPDATE until the preview shows exactly the current device row.
--
-- Replace these placeholders before use:
--   device_id: d3453918-8ec6-40a7-9976-8c59ad32ee07
--   endpoint:  paste the current browser endpoint from diagnostics if available
--   vapid fingerprint: kIitT4fays9YrZaM

-- PREVIEW ONLY
select
  id,
  user_id,
  device_id,
  is_active,
  left(endpoint, 32) || '...' || right(endpoint, 16) as endpoint_masked,
  encode(digest(endpoint, 'sha256'), 'hex') as endpoint_sha256,
  p256dh is not null as has_p256dh,
  auth is not null as has_auth,
  vapid_key_fingerprint,
  updated_at,
  last_seen_at,
  disabled_at
from public.push_subscriptions
where device_id = 'd3453918-8ec6-40a7-9976-8c59ad32ee07'
  and is_active = false
  and p256dh is not null
  and auth is not null
  and vapid_key_fingerprint = 'kIitT4fays9YrZaM'
  -- Uncomment after pasting the exact browser endpoint:
  -- and endpoint = 'PASTE_CURRENT_BROWSER_ENDPOINT_HERE'
order by updated_at desc nulls last, created_at desc;

-- UPDATE ONLY AFTER REVIEWING THE PREVIEW ABOVE.
-- begin;
-- update public.push_subscriptions
-- set
--   is_active = true,
--   disabled_at = null,
--   last_seen_at = now(),
--   updated_at = now()
-- where device_id = 'd3453918-8ec6-40a7-9976-8c59ad32ee07'
--   and is_active = false
--   and p256dh is not null
--   and auth is not null
--   and vapid_key_fingerprint = 'kIitT4fays9YrZaM'
--   and endpoint = 'PASTE_CURRENT_BROWSER_ENDPOINT_HERE';
-- commit;
