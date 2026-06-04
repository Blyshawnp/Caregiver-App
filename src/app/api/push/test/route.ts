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
    
    const result = await sendPushForNotifications(admin, [
      {
        recipient_id: user.id,
        kind: "general",
        title: "Test notification",
        body: "This is a test alert from your settings page.",
        link: "/me/notifications",
      }
    ]);

    if (result.skipped === "no_subscriptions") {
      return NextResponse.json(
        {
          error: "No active push subscription was found for this device. Refresh subscription or enable alerts again.",
          diagnostics: result,
        },
        { status: 409 }
      );
    }
    if (result.skipped === "not_configured") {
      return NextResponse.json(
        { error: "Push notifications are not configured on the server.", diagnostics: result },
        { status: 500 }
      );
    }
    if (result.delivered === 0) {
      return NextResponse.json(
        {
          error: "The browser push service did not accept the test notification. The subscription may be expired or blocked by OS/browser settings.",
          diagnostics: result,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, diagnostics: result });
  } catch (err: any) {
    console.error("[push-test] error", err);
    return NextResponse.json({ error: err.message || "Failed to send test push" }, { status: 500 });
  }
}
