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
    const { data, error } = await admin
      .rpc("send_direct_message_with_notification", {
        p_sender_id: user.id,
        p_recipient_id: recipientId,
        p_content: content,
      })
      .single<SendMessageResult>();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Could not send message." },
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
