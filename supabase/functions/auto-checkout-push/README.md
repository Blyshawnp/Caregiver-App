# auto-checkout-push

Scheduled Supabase Edge Function fallback for projects where `pg_cron` is not
available or where native push delivery is needed after the database-side
auto-checkout job inserts notifications.

Required secrets:

```sh
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set VAPID_SUBJECT=mailto:you@example.com
```

Schedule every 15 minutes in Supabase Dashboard:

Edge Functions -> auto-checkout-push -> Schedules -> `*/15 * * * *`

The function calls `public.auto_checkout_after_8pm_geofence()` first, then sends
native web push for `auto_check_out` notifications created during that run.
