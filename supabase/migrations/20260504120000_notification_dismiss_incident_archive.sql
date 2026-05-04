begin;

alter table public.notifications
  add column if not exists dismissed_at timestamptz;

create index if not exists notifications_recipient_unread_active_idx
  on public.notifications (recipient_id, is_read, created_at desc)
  where dismissed_at is null;

create index if not exists notifications_recipient_dismissed_idx
  on public.notifications (recipient_id, dismissed_at desc)
  where dismissed_at is not null;

drop policy if exists "recipients mark own notifications read" on public.notifications;
create policy "recipients mark own notifications read"
on public.notifications
for update
to authenticated
using (
  recipient_id = auth.uid()
)
with check (
  recipient_id = auth.uid()
);

alter table public.incidents
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create index if not exists incidents_org_active_created_at_idx
  on public.incidents (organization_id, created_at desc)
  where archived_at is null;

create index if not exists incidents_org_archived_at_idx
  on public.incidents (organization_id, archived_at desc)
  where archived_at is not null;

commit;
