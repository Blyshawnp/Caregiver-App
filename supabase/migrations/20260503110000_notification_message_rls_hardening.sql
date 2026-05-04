begin;

alter table public.notifications enable row level security;
alter table public.messages enable row level security;

drop policy if exists "recipients view own notifications" on public.notifications;
create policy "recipients view own notifications"
on public.notifications
for select
to authenticated
using (
  recipient_id = auth.uid()
);

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

drop policy if exists "participants view own direct messages" on public.messages;
create policy "participants view own direct messages"
on public.messages
for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
);

drop policy if exists "recipients update own message read state" on public.messages;
create policy "recipients update own message read state"
on public.messages
for update
to authenticated
using (
  recipient_id = auth.uid()
)
with check (
  recipient_id = auth.uid()
);

commit;
