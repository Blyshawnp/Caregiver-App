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

  const payload = await request.json().catch(() => null);
  if (!payload?.summary_id || !payload?.message?.trim()) {
    return NextResponse.json({ error: "Missing summary_id or message." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the summary exists and belongs to this caregiver
  const { data: summary } = await admin
    .from("year_end_summaries")
    .select("id, caregiver_id")
    .eq("id", payload.summary_id)
    .single();

  if (!summary) {
    return NextResponse.json({ error: "Year-End Summary not found." }, { status: 404 });
  }

  if (summary.caregiver_id !== user.id) {
    return NextResponse.json({ error: "Forbidden: You do not own this summary." }, { status: 403 });
  }

  const { data: correction, error } = await admin
    .from("summary_correction_requests")
    .insert({
      summary_id: payload.summary_id,
      caregiver_id: user.id,
      message: payload.message.trim(),
      status: "submitted",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, correction });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload?.id || !payload?.status) {
    return NextResponse.json({ error: "Missing id or status." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch profiles role
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const isAdmin = profile.role === "admin" || profile.role === "client";

  // Fetch the correction request
  const { data: correction } = await admin
    .from("summary_correction_requests")
    .select("id, caregiver_id")
    .eq("id", payload.id)
    .single();

  if (!correction) {
    return NextResponse.json({ error: "Correction request not found." }, { status: 404 });
  }

  if (!isAdmin && correction.caregiver_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const update: Record<string, any> = {
    status: payload.status,
  };

  if (isAdmin) {
    update.admin_response = payload.admin_response || null;
  }

  if (payload.status === "resolved") {
    update.resolved_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("summary_correction_requests")
    .update(update)
    .eq("id", payload.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
