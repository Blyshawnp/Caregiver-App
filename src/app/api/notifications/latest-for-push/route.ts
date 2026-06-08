import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "permission_denied" }, { status: 401 });
    }

    // Fetch the latest unread notification for the recipient
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, link, kind")
      .eq("recipient_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[latest-for-push] database error", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ no_notifications: true });
    }

    return NextResponse.json({
      id: data.id,
      title: data.title,
      body: data.body,
      url: data.link || "/notifications",
      tag: data.kind || "caregiver-notification",
    });
  } catch (err: any) {
    console.error("[latest-for-push] error", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
