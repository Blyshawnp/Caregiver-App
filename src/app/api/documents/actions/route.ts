import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushForNotifications } from "@/lib/web-push";

type DocumentActionPayload = {
  documentId: string;
  action: "acknowledge" | "request_print" | "review_print";
  version?: string | null;
  targetUserId?: string; // For review_print: the user who requested
  status?: "approved" | "denied"; // For review_print
  reason?: string | null; // For review_print denial
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as DocumentActionPayload | null;
  if (!payload?.documentId || !payload.action) {
    return NextResponse.json({ error: "Missing document ID or action." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch document details
  const { data: doc } = await admin
    .from("documents")
    .select("id, title, organization_id, requires_print_approval")
    .eq("id", payload.documentId)
    .maybeSingle<{ id: string; title: string; organization_id: string; requires_print_approval: boolean }>();

  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  // Fetch actor profile
  const { data: actor } = await admin
    .from("profiles")
    .select("id, role, organization_id, full_name")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: string; organization_id: string; full_name: string }>();

  if (!actor) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }

  if (actor.organization_id !== doc.organization_id) {
    return NextResponse.json({ error: "Unauthorized access to this document." }, { status: 403 });
  }

  const nowStr = new Date().toISOString();

  // Action 1: Acknowledge document
  if (payload.action === "acknowledge") {
    const { error } = await admin
      .from("document_acknowledgments")
      .upsert({
        document_id: doc.id,
        acknowledged_by: actor.id,
        acknowledged_at: nowStr,
        version: payload.version ?? "1.0",
      }, {
        onConflict: "document_id, acknowledged_by"
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // Action 2: Request print approval
  if (payload.action === "request_print") {
    if (!doc.requires_print_approval) {
      return NextResponse.json({ error: "Print approval is not enabled for this document." }, { status: 400 });
    }

    const { error } = await admin
      .from("document_print_requests")
      .upsert({
        document_id: doc.id,
        requested_by: actor.id,
        requested_at: nowStr,
        status: "requested",
        reason: null,
      }, {
        onConflict: "document_id, requested_by"
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify administrators
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", actor.organization_id)
      .eq("role", "admin")
      .eq("is_active", true);

    const notifyRows = (admins ?? []).map((adminUser) => ({
      organization_id: actor.organization_id,
      recipient_id: adminUser.id,
      kind: "print_approval_requested",
      title: "Print Approval Requested",
      body: `${actor.full_name} is requesting print permission for "${doc.title}".`,
      link: "/documents",
    }));

    if (notifyRows.length > 0) {
      await admin.from("notifications").insert(notifyRows);
      void sendPushForNotifications(admin, notifyRows).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  }

  // Action 3: Review print request (Admin only)
  if (payload.action === "review_print") {
    if (actor.role !== "admin") {
      return NextResponse.json({ error: "Only administrators can review print requests." }, { status: 403 });
    }

    if (!payload.targetUserId || !payload.status) {
      return NextResponse.json({ error: "Missing target user ID or approval status." }, { status: 400 });
    }

    if (payload.status === "denied" && !payload.reason?.trim()) {
      return NextResponse.json({ error: "A reason is required to deny a print request." }, { status: 400 });
    }

    const { error } = await admin
      .from("document_print_requests")
      .update({
        status: payload.status,
        reviewed_by: actor.id,
        reviewed_at: nowStr,
        reason: payload.status === "denied" ? payload.reason?.trim() : null,
      })
      .eq("document_id", doc.id)
      .eq("requested_by", payload.targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify the requesting user
    const notifyRow = {
      organization_id: actor.organization_id,
      recipient_id: payload.targetUserId,
      kind: "print_approval_reviewed",
      title: payload.status === "approved" ? "Print Request Approved" : "Print Request Denied",
      body: payload.status === "approved" 
        ? `Your request to print "${doc.title}" has been approved.`
        : `Your request to print "${doc.title}" was denied: ${payload.reason}`,
      link: "/documents",
    };

    await admin.from("notifications").insert(notifyRow);
    void sendPushForNotifications(admin, [notifyRow]).catch(() => {});

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
