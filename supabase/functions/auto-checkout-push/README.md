# auto-checkout-push

Scheduled Supabase Edge Function fallback for projects where `pg_cron` is not
available or where native push delivery is needed after database-side shift
automation inserts notifications.

This scheduled function also sends caregiver check-in reminders near shift start
time. It records `shift_events.event_type = 'check_in_reminder_sent'` before
creating the in-app notification so each shift is reminded only once.

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

The function calls `public.process_shift_end_geofence_checkout()` first, records
check-in reminder events/notifications for newly started shifts, then sends
native web push for `auto_check_out`, `checkout_reminder`, and
`check_in_reminder` notifications created during that run.
