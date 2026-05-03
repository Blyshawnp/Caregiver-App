import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushForNotifications } from "@/lib/web-push";

type SendMessageRequest = {
  recipientId: string;
  content: string;
};

type SendMessageResult = {
  message_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  organization_id: string;
  notification_kind: string;
  notification_title: string;
  notification_body: string;
  notification_link: string;
};

type CallerProfile = {
  id: string;
  full_name: string;
  organization_id: string;
  is_active: boolean;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as SendMessageRequest;
    const recipientId = payload.recipientId?.trim();
    const content = payload.content?.trim();

    if (!recipientId || !content) {
      return NextResponse.json(
        { error: "Recipient and message content are required." },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: "Messages must be 1000 characters or fewer." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: rpcData, error: rpcError } = await admin
      .rpc("send_direct_message_with_notification", {
        p_sender_id: user.id,
        p_recipient_id: recipientId,
        p_content: content,
      })
      .single<SendMessageResult>();

    const data = rpcData ?? (rpcError ? await sendDirectMessageFallback(admin, {
      senderId: user.id,
      recipientId,
      content,
    }) : null);

    if (!data) {
      return NextResponse.json(
        { error: rpcError?.message ?? "Could not send message." },
        { status: 400 }
      );
    }

    void sendPushForNotifications(admin, [
      {
        recipient_id: data.recipient_id,
        kind: data.notification_kind,
        title: data.notification_title,
        body: data.notification_body,
        link: data.notification_link,
      },
    ]).catch(() => {});

    return NextResponse.json({
      message: {
        id: data.message_id,
        sender_id: data.sender_id,
        recipient_id: data.recipient_id,
        content: data.content,
        is_read: data.is_read,
        created_at: data.created_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send message.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function sendDirectMessageFallback(
  admin: ReturnType<typeof createAdminClient>,
  input: { senderId: string; recipientId: string; content: string }
): Promise<SendMessageResult | null> {
  const { data: sender } = await admin
    .from("profiles")
    .select("id, full_name, organization_id, is_active")
    .eq("id", input.senderId)
    .maybeSingle<CallerProfile>();

  const { data: recipient } = await admin
    .from("profiles")
    .select("id, full_name, organization_id, is_active")
    .eq("id", input.recipientId)
    .maybeSingle<CallerProfile>();

  if (!sender?.is_active || !recipient?.is_active) {
    throw new Error("Sender or recipient profile is not active.");
  }
  if (sender.organization_id !== recipient.organization_id) {
    throw new Error("Message recipient is not in the same organization.");
  }
  if (sender.id === recipient.id) {
    throw new Error("Sender cannot message themselves.");
  }

  const { data: message, error: messageError } = await admin
    .from("messages")
    .insert({
      organization_id: sender.organization_id,
      sender_id: sender.id,
      recipient_id: recipient.id,
      content: input.content,
    })
    .select("id, sender_id, recipient_id, content, is_read, created_at, organization_id")
    .single<{
      id: string;
      sender_id: string;
      recipient_id: string;
      content: string;
      is_read: boolean;
      created_at: string;
      organization_id: string;
    }>();

  if (messageError || !message) {
    throw new Error(messageError?.message ?? "Could not insert message.");
  }

  const notificationTitle = `Message from ${sender.full_name}`;
  const notificationBody = input.content.slice(0, 120);
  const notificationLink = `/messages/${sender.id}`;

  const { error: notificationError } = await admin.from("notifications").insert({
    organization_id: sender.organization_id,
    recipient_id: recipient.id,
    kind: "message",
    title: notificationTitle,
    body: notificationBody,
    link: notificationLink,
    is_read: false,
  });

  if (notificationError) {
    throw new Error(notificationError.message);
  }

  return {
    message_id: message.id,
    sender_id: message.sender_id,
    recipient_id: message.recipient_id,
    content: message.content,
    is_read: message.is_read,
    created_at: message.created_at,
    organization_id: message.organization_id,
    notification_kind: "message",
    notification_title: notificationTitle,
    notification_body: notificationBody,
    notification_link: notificationLink,
  };
}
