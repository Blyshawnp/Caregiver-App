# auto-checkout-push

Scheduled Supabase Edge Function fallback for projects where `pg_cron` is not
available or where native push delivery is needed after the database-side
auto-checkout job inserts notifications.

Required Edge Function secrets:

```sh
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set VAPID_SUBJECT=mailto:you@example.com
supabase secrets set AUTO_CHECKOUT_EDGE_SECRET=use-a-long-random-string
```

Required Vault secrets for SQL scheduling:

```sql
select vault.create_secret('https://PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_SUPABASE_ANON_KEY', 'anon_key');
select vault.create_secret('THE_SAME_LONG_RANDOM_STRING', 'auto_checkout_edge_secret');
```

The migration `20260502034000_schedule_auto_checkout_push_edge.sql` schedules
the function every 15 minutes using Supabase's `pg_cron` + `pg_net` pattern.
It also unschedules the DB-only `auto-checkout-after-8pm-geofence` job so the
Edge Function owns both checkout and push delivery.

If you schedule from the Supabase Dashboard instead, use:

- Cron: `*/15 * * * *`
- Method: `POST`
- Header: `x-auto-checkout-secret: THE_SAME_LONG_RANDOM_STRING`

The function calls `public.auto_checkout_after_8pm_geofence()` first, then sends
native web push for `auto_check_out` notifications created during that run.
