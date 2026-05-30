import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushForNotifications } from "@/lib/web-push";

type FeedbackActionPayload = {
  feedbackId: string;
  action: "review" | "resolve" | "dismiss" | "share";
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as FeedbackActionPayload | null;
  if (!payload?.feedbackId || !payload.action) {
    return NextResponse.json({ error: "Missing feedback ID or action." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: actor } = await admin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: string; organization_id: string }>();

  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Only administrators can manage feedback." }, { status: 403 });
  }

  const { data: feedback } = await admin
    .from("caregiver_feedback")
    .select("id, organization_id, caregiver_id, feedback_type, status")
    .eq("id", payload.feedbackId)
    .maybeSingle<{
      id: string;
      organization_id: string;
      caregiver_id: string | null;
      feedback_type: string;
      status: string;
    }>();

  if (!feedback) {
    return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
  }

  if (feedback.organization_id !== actor.organization_id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let nextStatus: "reviewed" | "resolved" | "dismissed" | "shared_with_caregiver";
  const nowStr = new Date().toISOString();

  if (payload.action === "review") {
    nextStatus = "reviewed";
  } else if (payload.action === "resolve") {
    nextStatus = "resolved";
  } else if (payload.action === "dismiss") {
    nextStatus = "dismissed";
  } else if (payload.action === "share") {
    if (feedback.feedback_type !== "commendation" && feedback.feedback_type !== "appreciation") {
      return NextResponse.json({ error: "Only positive feedback (commendations/appreciations) can be shared with caregivers." }, { status: 400 });
    }
    if (!feedback.caregiver_id) {
      return NextResponse.json({ error: "No caregiver is assigned to this feedback." }, { status: 400 });
    }
    nextStatus = "shared_with_caregiver";
  } else {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from("caregiver_feedback")
    .update({
      status: nextStatus,
      reviewed_by: actor.id,
      reviewed_at: nowStr,
      updated_at: nowStr,
    })
    .eq("id", feedback.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If sharing with caregiver, send notification
  if (nextStatus === "shared_with_caregiver" && feedback.caregiver_id) {
    const notifyRow = {
      organization_id: feedback.organization_id,
      recipient_id: feedback.caregiver_id,
      kind: "feedback_shared",
      title: "New Positive Feedback Shared!",
      body: "An administrator has shared client/family appreciation with you. Good job!",
      link: "/feedback",
    };

    await admin.from("notifications").insert(notifyRow);
    void sendPushForNotifications(admin, [notifyRow]).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
