import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    readOnly?: boolean;
  };
  const dismissedAt = new Date().toISOString();
  const admin = createAdminClient();

  let query = admin
    .from("notifications")
    .update({ dismissed_at: dismissedAt })
    .eq("recipient_id", user.id)
    .is("dismissed_at", null);

  if (body.id) {
    query = query.eq("id", body.id);
  } else if (body.readOnly) {
    query = query.eq("is_read", true);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
