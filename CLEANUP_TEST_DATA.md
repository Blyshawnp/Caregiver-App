# Cleanup Test Data

Use this when you want to remove test shifts, clients, caregivers, messages, notifications, and related app data from Supabase while keeping your own admin account.

Run this from **Supabase Dashboard > SQL Editor**.

## 1. Find Your IDs

First find your organization ID and your admin profile ID:

```sql
select id, email, full_name, role, organization_id
from public.profiles
order by created_at;
```

Copy:

- your `organization_id`
- your admin profile `id`

## 2. Run The Cleanup

Replace `PASTE_ORGANIZATION_ID_HERE` and `PASTE_YOUR_ADMIN_PROFILE_ID_HERE`, then run:

```sql
begin;

do $$
declare
  target_org uuid := 'PASTE_ORGANIZATION_ID_HERE';
  keep_admin uuid := 'PASTE_YOUR_ADMIN_PROFILE_ID_HERE';
begin
  delete from public.checkout_flags where organization_id = target_org;
  delete from public.shift_location_pings where organization_id = target_org;
  delete from public.check_ins where organization_id = target_org;
  delete from public.shift_todos where organization_id = target_org;
  delete from public.shift_proposals where organization_id = target_org;
  delete from public.incidents where organization_id = target_org;
  delete from public.notifications where organization_id = target_org;
  delete from public.messages where organization_id = target_org;

  delete from public.shifts where organization_id = target_org;
  delete from public.recurring_shift_templates where organization_id = target_org;

  delete from public.client_documents where organization_id = target_org;
  delete from public.client_allergies where organization_id = target_org;
  delete from public.clients where organization_id = target_org;

  delete from public.todo_templates where organization_id = target_org;
  delete from public.task_categories where organization_id = target_org;
  delete from public.shift_types where organization_id = target_org;

  delete from public.pay_period_snapshots where organization_id = target_org;
  delete from public.pay_periods where organization_id = target_org;

  delete from public.caregiver_rates
  where caregiver_id in (
    select id from public.profiles
    where organization_id = target_org
      and id <> keep_admin
  );

  delete from public.push_subscriptions
  where user_id in (
    select id from public.profiles
    where organization_id = target_org
      and id <> keep_admin
  );

  delete from public.notification_preferences
  where user_id in (
    select id from public.profiles
    where organization_id = target_org
      and id <> keep_admin
  );

  delete from public.invitations where organization_id = target_org;

  delete from public.profiles
  where organization_id = target_org
    and id <> keep_admin;
end $$;

commit;
```

## 3. Delete Test Auth Users

The SQL removes app rows, but Supabase Auth users may still exist.

Go to **Supabase Dashboard > Authentication > Users** and delete the test users there, especially any `@noemail.local` accounts.

## 4. Delete Uploaded Test Files

If you uploaded test files or avatars, also check **Supabase Dashboard > Storage**.

Look in these buckets:

- `avatars`
- `client-documents`

Delete test files manually from those buckets.
