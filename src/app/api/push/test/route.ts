import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushForNotifications } from "@/lib/web-push";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    
    // We send a mock push notification using sendPushForNotifications
    await sendPushForNotifications(admin, [
      {
        recipient_id: user.id,
        kind: "general",
        title: "Test Notification 🔔",
        body: "This is a successful test push notification from your settings page.",
        link: "/me/notifications",
      }
    ]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[push-test] error", err);
    return NextResponse.json({ error: err.message || "Failed to send test push" }, { status: 500 });
  }
}
