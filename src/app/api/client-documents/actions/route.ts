import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushForNotifications } from "@/lib/web-push";

type Payload = {
  documentId?: string;
  action?: "request_print" | "review_print";
  targetUserId?: string;
  status?: "approved" | "denied";
  reason?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as Payload | null;
  if (!payload?.documentId || !payload.action) {
    return NextResponse.json({ error: "Missing document ID or action." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id")
    .eq("id", user.id)
    .single<{ id: string; full_name: string; role: string; organization_id: string }>();
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 403 });

  const { data: doc } = await admin
    .from("client_documents")
    .select("id, title, organization_id, client_id, requires_print_approval")
    .eq("id", payload.documentId)
    .maybeSingle<{
      id: string;
      title: string;
      organization_id: string;
      client_id: string;
      requires_print_approval: boolean;
    }>();
  if (!doc || doc.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const isAdmin = profile.role === "admin" || profile.role === "client";

  if (payload.action === "request_print") {
    if (!doc.requires_print_approval) {
      return NextResponse.json({ error: "Print approval is not required for this document." }, { status: 400 });
    }

    const { error } = await admin.from("client_document_print_requests").upsert(
      {
        client_document_id: doc.id,
        requested_by: profile.id,
        requested_at: new Date().toISOString(),
        status: "requested",
        reason: null,
      },
      { onConflict: "client_document_id,requested_by" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: reviewers } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", doc.organization_id)
      .in("role", ["admin", "client"]);

    const notifyRows = (reviewers ?? [])
      .filter((row) => row.id !== profile.id)
      .map((row) => ({
        recipient_id: row.id,
        organization_id: doc.organization_id,
        kind: "print_approval_requested",
        title: "Document print approval requested",
        body: `${profile.full_name} requested print permission for "${doc.title}".`,
        link: `/clients/${doc.client_id}/documents`,
      }));

    if (notifyRows.length > 0) {
      await admin.from("notifications").insert(notifyRows);
      void sendPushForNotifications(admin, notifyRows).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  }

  if (payload.action === "review_print") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Only administrators can review print requests." }, { status: 403 });
    }
    if (!payload.targetUserId || !payload.status) {
      return NextResponse.json({ error: "Missing requester or review status." }, { status: 400 });
    }
    if (payload.status === "denied" && !payload.reason?.trim()) {
      return NextResponse.json({ error: "A denial reason is required." }, { status: 400 });
    }

    const { error } = await admin
      .from("client_document_print_requests")
      .update({
        status: payload.status,
        reason: payload.status === "denied" ? payload.reason?.trim() : null,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("client_document_id", doc.id)
      .eq("requested_by", payload.targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const notifyRow = {
      recipient_id: payload.targetUserId,
      organization_id: doc.organization_id,
      kind: "print_approval_reviewed",
      title: payload.status === "approved" ? "Print request approved" : "Print request denied",
      body:
        payload.status === "approved"
          ? `Your request to print "${doc.title}" was approved.`
          : `Your request to print "${doc.title}" was denied: ${payload.reason}`,
      link: `/clients/${doc.client_id}/documents`,
    };
    await admin.from("notifications").insert(notifyRow);
    void sendPushForNotifications(admin, [notifyRow]).catch(() => {});

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
