import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushForNotifications } from "@/lib/web-push";

type FeedbackPayload = {
  caregiverId?: string | null;
  shiftId?: string | null;
  clientId?: string | null;
  feedbackType: "commendation" | "appreciation" | "concern" | "complaint" | "safety_issue" | "scheduling_issue" | "other";
  message: string;
  rating?: number | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as FeedbackPayload;
  const message = payload.message?.trim();
  const feedbackType = payload.feedbackType;
  const rating = payload.rating ?? null;

  if (!message || !feedbackType) {
    return NextResponse.json({ error: "Feedback type and message are required." }, { status: 400 });
  }

  const validTypes = ["commendation", "appreciation", "concern", "complaint", "safety_issue", "scheduling_issue", "other"];
  if (!validTypes.includes(feedbackType)) {
    return NextResponse.json({ error: "Invalid feedback type." }, { status: 400 });
  }

  if (rating !== null && (rating < 1 || rating > 5)) {
    return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: reporter } = await admin
    .from("profiles")
    .select("id, full_name, role, organization_id")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      full_name: string;
      role: "admin" | "client" | "caregiver" | "family";
      organization_id: string;
    }>();

  if (!reporter) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  if (reporter.role === "caregiver") {
    return NextResponse.json({ error: "Caregivers cannot submit caregiver feedback." }, { status: 403 });
  }

  // Insert feedback
  const { data: feedback, error } = await admin
    .from("caregiver_feedback")
    .insert({
      organization_id: reporter.organization_id,
      caregiver_id: payload.caregiverId ?? null,
      shift_id: payload.shiftId ?? null,
      client_id: payload.clientId ?? null,
      feedback_type: feedbackType,
      message,
      rating,
      submitted_by: reporter.id,
      status: "submitted",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !feedback) {
    return NextResponse.json({ error: error?.message ?? "Could not submit feedback." }, { status: 500 });
  }

  // Find admins to notify
  const { data: recipients } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", reporter.organization_id)
    .eq("is_active", true)
    .neq("id", reporter.id)
    .eq("role", "admin");

  const typeLabels: Record<string, string> = {
    commendation: "Good job / Commendation",
    appreciation: "Thank you / Appreciation",
    concern: "Concern",
    complaint: "Complaint",
    safety_issue: "Safety Issue",
    scheduling_issue: "Scheduling Issue",
    other: "Feedback / Other",
  };

  const label = typeLabels[feedbackType] || feedbackType;
  const rows = (recipients ?? []).map((recipient) => ({
    organization_id: reporter.organization_id,
    recipient_id: recipient.id,
    kind: "feedback_submitted",
    title: `New Caregiver Feedback: ${label}`,
    body: `${reporter.full_name}: ${message.length > 60 ? message.slice(0, 60) + "..." : message}`,
    link: `/feedback?id=${feedback.id}`,
  }));

  if (rows.length > 0) {
    await admin.from("notifications").insert(rows);
    void sendPushForNotifications(admin, rows).catch(() => {});
  }

  return NextResponse.json({ id: feedback.id });
}
