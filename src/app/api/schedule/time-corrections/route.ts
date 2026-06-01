import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .single<{ id: string; role: string; organization_id: string; full_name: string }>();

    if (!profile || profile.role !== "caregiver") {
      return NextResponse.json(
        { error: "Only caregivers can submit time correction requests." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      shiftId: string;
      requestedCheckInTime?: string;
      requestedCheckOutTime?: string;
      reason: string;
    } | null;

    if (!body || !body.shiftId || !body.reason.trim()) {
      return NextResponse.json(
        { error: "Missing required request parameters." },
        { status: 400 }
      );
    }

    // Verify shift exists and is assigned to this caregiver
    const { data: shift } = await admin
      .from("shifts")
      .select("id, caregiver_id, organization_id")
      .eq("id", body.shiftId)
      .single<{ id: string; caregiver_id: string; organization_id: string }>();

    if (!shift) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    if (shift.caregiver_id !== profile.id) {
      return NextResponse.json(
        { error: "You can only request corrections for shifts assigned to you." },
        { status: 403 }
      );
    }

    // Check for existing pending request
    const { data: existing } = await admin
      .from("shift_time_change_requests")
      .select("id")
      .eq("shift_id", body.shiftId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "There is already a pending time correction request for this shift." },
        { status: 400 }
      );
    }

    // Insert request
    const { data: newRequest, error: insertError } = await admin
      .from("shift_time_change_requests")
      .insert({
        organization_id: profile.organization_id,
        shift_id: body.shiftId,
        caregiver_id: profile.id,
        requested_check_in_time: body.requestedCheckInTime || null,
        requested_check_out_time: body.requestedCheckOutTime || null,
        reason: body.reason.trim(),
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Notify all admins of the request
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      const notifications = admins.map((adm) => ({
        organization_id: profile.organization_id,
        recipient_id: adm.id,
        kind: "time_correction_request_pending",
        title: "Time correction request",
        body: `${profile.full_name} has requested a time correction. Reason: "${body.reason.trim()}"`,
        link: `/schedule/${body.shiftId}`,
      }));

      await admin.from("notifications").insert(notifications);
    }

    // Log to activity logs
    await admin.from("activity_logs").insert({
      organization_id: profile.organization_id,
      actor_id: user.id,
      action_type: "request_time_correction",
      reason: body.reason.trim(),
      metadata: { shift_id: body.shiftId },
    });

    return NextResponse.json({ ok: true, data: newRequest });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, organization_id, full_name")
      .eq("id", user.id)
      .single<{ id: string; role: string; organization_id: string; full_name: string }>();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can review time correction requests." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      requestId: string;
      status: "approved" | "declined";
      adminNotes?: string;
    } | null;

    if (!body || !body.requestId || !body.status) {
      return NextResponse.json(
        { error: "Missing required request parameters." },
        { status: 400 }
      );
    }

    // Load request details
    const { data: req, error: reqError } = await admin
      .from("shift_time_change_requests")
      .select("*, shifts(*)")
      .eq("id", body.requestId)
      .single();

    if (reqError || !req) {
      return NextResponse.json(
        { error: "Time correction request not found." },
        { status: 404 }
      );
    }

    if (req.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been reviewed." },
        { status: 400 }
      );
    }

    // Update request
    const { error: updateError } = await admin
      .from("shift_time_change_requests")
      .update({
        status: body.status,
        admin_notes: body.adminNotes || null,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.requestId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (body.status === "approved") {
      // 1. Calculate check-in details
      const start = req.requested_check_in_time;
      const end = req.requested_check_out_time;
      let totalMinutes: number | null = null;
      if (start && end) {
        totalMinutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
      }

      // 2. Fetch or create check_in record
      const { data: existingCheckIn } = await admin
        .from("check_ins")
        .select("id")
        .eq("shift_id", req.shift_id)
        .maybeSingle();

      if (existingCheckIn) {
        const { error: checkInUpdateError } = await admin
          .from("check_ins")
          .update({
            check_in_time: start || null,
            check_out_time: end || null,
            total_minutes: totalMinutes,
            check_out_method: "admin_correction",
            check_out_by: profile.id,
            check_out_reason: `Time correction approved by Admin: ${body.adminNotes || "None"}`,
          })
          .eq("id", existingCheckIn.id);

        if (checkInUpdateError) {
          return NextResponse.json({ error: checkInUpdateError.message }, { status: 500 });
        }
      } else {
        const { error: checkInInsertError } = await admin
          .from("check_ins")
          .insert({
            organization_id: req.organization_id,
            shift_id: req.shift_id,
            caregiver_id: req.caregiver_id,
            check_in_time: start || null,
            check_out_time: end || null,
            total_minutes: totalMinutes,
            check_out_method: "admin_correction",
            check_out_by: profile.id,
            check_out_reason: `Time correction approved by Admin: ${body.adminNotes || "None"}`,
          });

        if (checkInInsertError) {
          return NextResponse.json({ error: checkInInsertError.message }, { status: 500 });
        }
      }

      // 3. Notify caregiver
      await admin.from("notifications").insert({
        organization_id: profile.organization_id,
        recipient_id: req.caregiver_id,
        kind: "time_correction_approved",
        title: "Time correction approved",
        body: `Your time correction request has been approved. Corrections will reflect on the next invoice.`,
        link: `/schedule/${req.shift_id}`,
      });

      // 4. Log to activity logs
      await admin.from("activity_logs").insert({
        organization_id: profile.organization_id,
        actor_id: user.id,
        action_type: "approve_time_correction",
        reason: body.adminNotes || null,
        metadata: { shift_id: req.shift_id, request_id: req.id },
      });
    } else if (body.status === "declined") {
      // Notify caregiver
      await admin.from("notifications").insert({
        organization_id: profile.organization_id,
        recipient_id: req.caregiver_id,
        kind: "time_correction_declined",
        title: "Time correction declined",
        body: `Your time correction request was declined. Reason: "${body.adminNotes || "No reason specified"}"`,
        link: `/schedule/${req.shift_id}`,
      });

      // Log to activity logs
      await admin.from("activity_logs").insert({
        organization_id: profile.organization_id,
        actor_id: user.id,
        action_type: "decline_time_correction",
        reason: body.adminNotes || null,
        metadata: { shift_id: req.shift_id, request_id: req.id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
