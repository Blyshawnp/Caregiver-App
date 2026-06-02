import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushForNotifications } from "@/lib/web-push";

export const dynamic = "force-dynamic";

type ForceAssignBody = {
  shiftId?: string;
  caregiverId?: string;
  reason?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as ForceAssignBody;
    const shiftId = body.shiftId?.trim();
    const caregiverId = body.caregiverId?.trim();
    const reason = body.reason?.trim();

    if (!shiftId || !caregiverId || !reason) {
      return NextResponse.json(
        { error: "Caregiver, shift, and reason are required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: caller } = await admin
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .single();

    if (!caller) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    if (caller.role !== "admin" && caller.role !== "client") {
      return NextResponse.json(
        { error: "Only administrators can force assign shifts." },
        { status: 403 }
      );
    }

    const { data: shift } = await admin
      .from("shifts")
      .select("id, organization_id, caregiver_id, assignment_status, scheduled_start, client_id, clients(full_name)")
      .eq("id", shiftId)
      .single();

    if (!shift || shift.organization_id !== caller.organization_id) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    const { data: caregiver } = await admin
      .from("profiles")
      .select("id, role, organization_id, full_name, is_active")
      .eq("id", caregiverId)
      .single();

    if (!caregiver || caregiver.organization_id !== shift.organization_id || caregiver.role !== "caregiver") {
      return NextResponse.json(
        { error: "Select an active caregiver in this organization." },
        { status: 400 }
      );
    }

    if (caregiver.is_active === false) {
      return NextResponse.json(
        { error: "Inactive caregivers cannot be assigned." },
        { status: 400 }
      );
    }

    const previousCaregiverId = shift.caregiver_id;
    const previousStatus = shift.assignment_status;
    const now = new Date().toISOString();

    const { error: updateError } = await admin
      .from("shifts")
      .update({
        caregiver_id: caregiverId,
        assignment_status: "accepted",
        is_released: false,
        released_by: null,
        release_reason: null,
      })
      .eq("id", shiftId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const shiftClient = shift.clients as { full_name: string | null } | Array<{ full_name: string | null }> | null;
    const clientName = Array.isArray(shiftClient)
      ? shiftClient[0]?.full_name
      : shiftClient?.full_name;

    const notification = {
      organization_id: shift.organization_id,
      recipient_id: caregiverId,
      kind: "shift_assigned",
      title: "Shift assigned by admin",
      body: "You were assigned to this shift by an admin.",
      link: `/schedule/${shiftId}`,
      related_shift_id: shiftId,
    };

    await admin.from("notifications").insert(notification);
    await sendPushForNotifications(admin, [notification]);

    await admin.from("activity_logs").insert({
      organization_id: shift.organization_id,
      actor_id: caller.id,
      action_type: "force_assign_shift",
      shift_count: 1,
      reason,
      metadata: {
        shift_id: shiftId,
        forced_by: caller.id,
        forced_by_name: caller.full_name,
        forced_at: now,
        previous_caregiver_id: previousCaregiverId,
        new_caregiver_id: caregiverId,
        previous_status: previousStatus,
        new_status: "accepted",
        client_name: clientName ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Force assignment failed." },
      { status: 500 }
    );
  }
}
