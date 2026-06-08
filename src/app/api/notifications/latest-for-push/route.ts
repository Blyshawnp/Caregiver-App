import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyInText } from "@/lib/format-currency";

export const dynamic = "force-dynamic";

function isHighPriority(kind: string): boolean {
  const normalized = kind.toLowerCase();
  return (
    normalized.includes("urgent") ||
    normalized.includes("emergency") ||
    normalized.includes("incident")
  );
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "permission_denied" }, { status: 401 });
    }

    const url = new URL(request.url);
    const endpoint = url.searchParams.get("endpoint");

    // Fetch the recent unread notifications for the recipient
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("id, title, body, link, kind")
      .eq("recipient_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      console.error("[latest-for-push] database error", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    let selected = null;

    if (notifications && notifications.length > 0) {
      // 1. Newest test notification matching this device's endpoint
      if (endpoint) {
        selected = notifications.find(
          (n) =>
            n.kind === "test" &&
            n.link &&
            n.link.includes(`endpoint=${encodeURIComponent(endpoint)}`)
        );
      }

      // If not found by endpoint, try any test notification for this user
      if (!selected) {
        selected = notifications.find((n) => n.kind === "test");
      }

      // 2. Newest unread high-priority notification
      if (!selected) {
        selected = notifications.find((n) => isHighPriority(n.kind));
      }

      // 3. Newest unread normal notification
      if (!selected) {
        selected = notifications[0];
      }
    }

    if (!selected) {
      return NextResponse.json({ no_notifications: true });
    }

    return NextResponse.json({
      id: selected.id,
      title: formatCurrencyInText(selected.title),
      body: formatCurrencyInText(selected.body),
      url: selected.link || "/notifications",
      tag: selected.kind || "caregiver-notification",
    });
  } catch (err: any) {
    console.error("[latest-for-push] error", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
