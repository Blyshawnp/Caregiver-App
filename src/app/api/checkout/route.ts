import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushForNotifications } from "@/lib/web-push";
import type { Role } from "@/lib/db-types";

type CheckoutRequest = {
  shiftId: string;
  checkInId: string;
  allowIncomplete?: boolean;
  location:
    | {
        kind: "located";
        latitude: number;
        longitude: number;
        withinFence: boolean;
        distanceMeters: number | null;
      }
    | { kind: "denied" }
    | { kind: "unavailable" };
};

type CallerProfile = {
  id: string;
  role: Role;
  full_name: string;
  organization_id: string;
};

type ShiftRecord = {
  id: string;
  caregiver_id: string | null;
  organization_id: string;
  scheduled_start: string;
  scheduled_end: string;
  clients: { full_name: string | null } | null;
  profiles: { full_name: string | null } | null;
  shift_todos: Array<{
    id: string;
    task_name: string;
    is_completed: boolean;
  }> | null;
};

type CheckInRecord = {
  id: string;
  shift_id: string;
  caregiver_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
};

type NotificationInsert = {
  organization_id: string;
  recipient_id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  related_shift_id: string;
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

    const payload = (await request.json()) as CheckoutRequest;
    if (!payload.shiftId || !payload.checkInId || !payload.location) {
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: caller } = await admin
      .from("profiles")
      .select("id, role, full_name, organization_id")
      .eq("id", user.id)
      .maybeSingle<CallerProfile>();

    if (!caller || caller.role !== "caregiver") {
      return NextResponse.json({ error: "Only caregivers can check out here" }, { status: 403 });
    }

    const { data: shiftRaw } = await admin
      .from("shifts")
      .select(
        `
        id,
        caregiver_id,
        organization_id,
        scheduled_start,
        scheduled_end,
        clients ( full_name ),
        profiles:caregiver_id ( full_name ),
        shift_todos ( id, task_name, is_completed )
      `
      )
      .eq("id", payload.shiftId)
      .maybeSingle();

    if (!shiftRaw) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const shift = shiftRaw as unknown as ShiftRecord;
    if (
      shift.organization_id !== caller.organization_id ||
      shift.caregiver_id !== caller.id
    ) {
      return NextResponse.json({ error: "Not your shift" }, { status: 403 });
    }

    const { data: requestedCheckIn } = await admin
      .from("check_ins")
      .select("id, shift_id, caregiver_id, check_in_time, check_out_time")
      .eq("id", payload.checkInId)
      .eq("shift_id", payload.shiftId)
      .maybeSingle<CheckInRecord>();

    let checkIn = requestedCheckIn;
    if (!checkIn?.check_in_time || checkIn.check_out_time) {
      const { data: activeCheckIn } = await admin
        .from("check_ins")
        .select("id, shift_id, caregiver_id, check_in_time, check_out_time")
        .eq("shift_id", payload.shiftId)
        .eq("caregiver_id", caller.id)
        .not("check_in_time", "is", null)
        .is("check_out_time", null)
        .order("check_in_time", { ascending: false })
        .limit(1)
        .maybeSingle<CheckInRecord>();
      checkIn = activeCheckIn;
    }

    if (!checkIn?.check_in_time) {
      return NextResponse.json({ error: "This shift is not checked in" }, { status: 409 });
    }
    if (checkIn.check_out_time) {
      return NextResponse.json({ error: "This shift is already checked out" }, { status: 409 });
    }
    if (checkIn.caregiver_id !== caller.id) {
      return NextResponse.json({ error: "Not your check-in record" }, { status: 403 });
    }

    const incompleteTasks = (shift.shift_todos ?? []).filter(
      (todo) => !todo.is_completed
    );
    if (incompleteTasks.length > 0 && !payload.allowIncomplete) {
      return NextResponse.json(
        {
          error: "Incomplete tasks require confirmation",
          incompleteCount: incompleteTasks.length,
        },
        { status: 409 }
      );
    }

    const checkoutTime = new Date().toISOString();
    const flagged =
      payload.location.kind === "denied" ||
      (payload.location.kind === "located" && !payload.location.withinFence);
    const flagReason =
      payload.location.kind === "denied"
        ? "Location permission denied at check-out"
        : payload.location.kind === "located" && !payload.location.withinFence
          ? `Checked out ${formatDistance(payload.location.distanceMeters ?? 0)} from client`
          : null;

    const update: {
      check_out_time: string;
      check_out_latitude?: number;
      check_out_longitude?: number;
      check_out_within_geofence: boolean;
      check_out_method: string;
      check_out_by: string;
      flagged_outside_geofence?: boolean;
      flag_reason?: string | null;
    } = {
      check_out_time: checkoutTime,
      check_out_within_geofence:
        payload.location.kind === "located" ? payload.location.withinFence : false,
      check_out_method: "caregiver_self",
      check_out_by: caller.id,
    };

    if (payload.location.kind === "located") {
      update.check_out_latitude = payload.location.latitude;
      update.check_out_longitude = payload.location.longitude;
    }
    if (flagged) {
      update.flagged_outside_geofence = true;
      update.flag_reason = flagReason;
    }

    const { data: checkedOut, error: updateError } = await admin
      .from("check_ins")
      .update(update)
      .eq("id", checkIn.id)
      .is("check_out_time", null)
      .select("id, check_out_time")
      .maybeSingle<{ id: string; check_out_time: string | null }>();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!checkedOut?.check_out_time) {
      return NextResponse.json(
        { error: "Checkout did not update an active check-in. Refresh and try again." },
        { status: 409 }
      );
    }

    const warnings: string[] = [];
    if (incompleteTasks.length > 0) {
      try {
        await recordIncompleteCheckout(admin, {
          organizationId: shift.organization_id,
          shiftId: shift.id,
          checkInId: checkIn.id,
          caregiverId: caller.id,
          incompleteTasks,
          checkoutTime,
        });
        await notifyIncompleteCheckout(admin, caller, shift, incompleteTasks);
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? error.message
            : "Incomplete checkout notification failed"
        );
      }
    }

    if (flagged) {
      try {
        await notifyFlaggedCheckout(admin, caller, shift, flagReason);
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? error.message
            : "Flagged checkout notification failed"
        );
      }
    }

    return NextResponse.json({ ok: true, warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function recordIncompleteCheckout(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    organizationId: string;
    shiftId: string;
    checkInId: string;
    caregiverId: string;
    incompleteTasks: Array<{ id: string; task_name: string }>;
    checkoutTime: string;
  }
) {
  const { error } = await admin.from("checkout_flags").insert({
    organization_id: input.organizationId,
    shift_id: input.shiftId,
    check_in_id: input.checkInId,
    caregiver_id: input.caregiverId,
    flag_type: "incomplete_tasks",
    incomplete_task_count: input.incompleteTasks.length,
    incomplete_task_ids: input.incompleteTasks.map((task) => task.id),
    incomplete_task_names: input.incompleteTasks.map((task) => task.task_name),
    created_at: input.checkoutTime,
  });

  if (error && error.code !== "42P01") {
    throw new Error(error.message);
  }
}

async function notifyIncompleteCheckout(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  shift: ShiftRecord,
  incompleteTasks: Array<{ id: string; task_name: string }>
) {
  const recipientIds = await getRoleRecipientIds(
    admin,
    shift.organization_id,
    ["admin", "client", "family"],
    caller.id
  );
  if (recipientIds.length === 0) return;

  const caregiverName =
    shift.profiles?.full_name ?? caller.full_name ?? "The caregiver";
  const clientName = shift.clients?.full_name ?? "the client";
  const body = `${caregiverName} checked out from ${clientName}'s ${formatShiftTime(
    shift.scheduled_start
  )} shift with ${incompleteTasks.length} unfinished task${
    incompleteTasks.length === 1 ? "" : "s"
  }.`;

  const rows: NotificationInsert[] = recipientIds.map((recipientId) => ({
    organization_id: shift.organization_id,
    recipient_id: recipientId,
    kind: "checkout_incomplete_tasks",
    title: "Shift checked out with unfinished tasks",
    body,
    link: `/schedule/${shift.id}`,
    related_shift_id: shift.id,
  }));

  const { error } = await admin.from("notifications").insert(rows);
  if (error) throw new Error(error.message);
  void sendPushForNotifications(admin, rows).catch(() => {});
}

async function notifyFlaggedCheckout(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  shift: ShiftRecord,
  flagReason: string | null
) {
  const recipientIds = await getRoleRecipientIds(
    admin,
    shift.organization_id,
    ["admin"],
    caller.id
  );
  if (recipientIds.length === 0) return;

  const rows: NotificationInsert[] = recipientIds.map((recipientId) => ({
    organization_id: shift.organization_id,
    recipient_id: recipientId,
    kind: "check_out_flagged",
    title: "Flagged check-out",
    body: flagReason ?? "A caregiver checked out outside the geofence.",
    link: `/schedule/${shift.id}`,
    related_shift_id: shift.id,
  }));

  const { error } = await admin.from("notifications").insert(rows);
  if (error) throw new Error(error.message);
  void sendPushForNotifications(admin, rows).catch(() => {});
}

async function getRoleRecipientIds(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  roles: Role[],
  excludeId: string
) {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .neq("id", excludeId)
    .in("role", roles);

  return (data ?? []).map((row) => row.id);
}

function formatShiftTime(value: string) {
  const date = new Date(value);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} ${timeStr}`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
