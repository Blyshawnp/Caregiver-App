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
      const firstFailure = result.failures[0];
      const error = describePushFailure(firstFailure?.status, firstFailure?.reason);
      return NextResponse.json(
        {
          error,
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

function describePushFailure(status?: number, reason?: string) {
  if (status === 404 || status === 410) {
    return "The saved push subscription has expired. Refresh notifications or enable alerts again on this device.";
  }
  if (status === 401 || status === 403) {
    return "The browser push service rejected the notification keys. Refresh notifications to create a new subscription with the current VAPID key.";
  }
  if (status === 400) {
    return "The browser push service rejected the subscription payload. Refresh notifications, then send another test.";
  }
  return reason || "The browser push service did not accept the test notification. Check OS/browser notification settings, Focus or Do Not Disturb, battery optimization, and installed PWA state.";
}
