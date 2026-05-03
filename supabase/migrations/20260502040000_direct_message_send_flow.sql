begin;

create or replace function public.send_direct_message_with_notification(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_content text
)
returns table (
  message_id uuid,
  sender_id uuid,
  recipient_id uuid,
  content text,
  is_read boolean,
  created_at timestamptz,
  organization_id uuid,
  notification_kind text,
  notification_title text,
  notification_body text,
  notification_link text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_profile record;
  recipient_profile record;
  inserted_message record;
  cleaned_content text;
  title_text text;
  body_text text;
  link_text text;
begin
  cleaned_content := nullif(btrim(p_content), '');

  if cleaned_content is null then
    raise exception 'Message content is required.';
  end if;

  if char_length(cleaned_content) > 1000 then
    raise exception 'Messages must be 1000 characters or fewer.';
  end if;

  if p_sender_id = p_recipient_id then
    raise exception 'Sender cannot message themselves.';
  end if;

  select id, full_name, organization_id, is_active
    into sender_profile
  from public.profiles
  where id = p_sender_id;

  if sender_profile.id is null or sender_profile.is_active is not true then
    raise exception 'Sender profile not found.';
  end if;

  select id, full_name, organization_id, is_active
    into recipient_profile
  from public.profiles
  where id = p_recipient_id;

  if recipient_profile.id is null or recipient_profile.is_active is not true then
    raise exception 'Message recipient not found.';
  end if;

  if sender_profile.organization_id <> recipient_profile.organization_id then
    raise exception 'Message recipient is not in the same organization.';
  end if;

  insert into public.messages (
    organization_id,
    sender_id,
    recipient_id,
    content
  )
  values (
    sender_profile.organization_id,
    sender_profile.id,
    recipient_profile.id,
    cleaned_content
  )
  returning id, sender_id, recipient_id, content, is_read, created_at, organization_id
    into inserted_message;

  title_text := 'Message from ' || coalesce(nullif(sender_profile.full_name, ''), 'Caregiver');
  body_text := left(cleaned_content, 120);
  link_text := '/messages/' || sender_profile.id::text;

  insert into public.notifications (
    organization_id,
    recipient_id,
    kind,
    title,
    body,
    link,
    is_read
  )
  values (
    sender_profile.organization_id,
    recipient_profile.id,
    'message',
    title_text,
    body_text,
    link_text,
    false
  );

  message_id := inserted_message.id;
  sender_id := inserted_message.sender_id;
  recipient_id := inserted_message.recipient_id;
  content := inserted_message.content;
  is_read := inserted_message.is_read;
  created_at := inserted_message.created_at;
  organization_id := inserted_message.organization_id;
  notification_kind := 'message';
  notification_title := title_text;
  notification_body := body_text;
  notification_link := link_text;
  return next;
end;
$$;

revoke all on function public.send_direct_message_with_notification(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.send_direct_message_with_notification(uuid, uuid, text)
  to service_role;

create index if not exists messages_participant_created_at_idx
  on public.messages (organization_id, sender_id, recipient_id, created_at desc);

create index if not exists messages_recipient_unread_idx
  on public.messages (recipient_id, is_read, created_at desc)
  where is_read = false;

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, is_read, created_at desc)
  where is_read = false;

commit;
