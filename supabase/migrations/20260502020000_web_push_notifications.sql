begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  is_active boolean not null default true,
  disabled_at timestamptz null,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null,
  messages boolean not null default true,
  shift_assignments boolean not null default true,
  trades boolean not null default true,
  incidents boolean not null default true,
  general boolean not null default true,
  sounds_enabled boolean not null default true,
  message_sound_enabled boolean not null default true,
  urgent_incident_sound_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, is_active, updated_at desc);

create index if not exists push_subscriptions_org_active_idx
  on public.push_subscriptions (organization_id, is_active);

create index if not exists notification_preferences_org_idx
  on public.notification_preferences (organization_id);

alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "users view own push subscriptions" on public.push_subscriptions;
create policy "users view own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
  and organization_id = current_org_id()
);

drop policy if exists "users create own push subscriptions" on public.push_subscriptions;
create policy "users create own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and organization_id = current_org_id()
);

drop policy if exists "users update own push subscriptions" on public.push_subscriptions;
create policy "users update own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
  and organization_id = current_org_id()
)
with check (
  user_id = auth.uid()
  and organization_id = current_org_id()
);

drop policy if exists "users view own notification preferences" on public.notification_preferences;
create policy "users view own notification preferences"
on public.notification_preferences
for select
to authenticated
using (
  user_id = auth.uid()
  and organization_id = current_org_id()
);

drop policy if exists "users create own notification preferences" on public.notification_preferences;
create policy "users create own notification preferences"
on public.notification_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
  and organization_id = current_org_id()
);

drop policy if exists "users update own notification preferences" on public.notification_preferences;
create policy "users update own notification preferences"
on public.notification_preferences
for update
to authenticated
using (
  user_id = auth.uid()
  and organization_id = current_org_id()
)
with check (
  user_id = auth.uid()
  and organization_id = current_org_id()
);

commit;
