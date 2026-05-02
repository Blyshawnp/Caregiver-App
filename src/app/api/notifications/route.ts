import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendPushForNotifications } from "@/lib/web-push";
import type { Role } from "@/lib/db-types";

type CallerProfile = {
  id: string;
  role: Role;
  full_name: string;
  organization_id: string;
};

type ShiftRecord = {
  id: string;
  organization_id: string;
  caregiver_id: string | null;
  released_by: string | null;
  scheduled_start: string;
  clients: { full_name: string | null } | null;
};

type ProposalRecord = {
  id: string;
  organization_id: string;
  caregiver_id: string;
  client_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "canceled";
  rejection_reason: string | null;
  shift_id: string | null;
  profiles: { full_name: string | null } | null;
  clients: { full_name: string | null } | null;
};

type NotificationInsert = {
  organization_id: string;
  recipient_id: string;
  kind: string;
  title: string;
  body: string;
  link?: string;
  related_shift_id?: string;
};

type NotificationRequest =
  | {
      type: "check_in_flagged" | "check_out_flagged";
      shiftId: string;
      flagReason: string | null;
    }
  | {
      type: "shift_released";
      shiftId: string;
      reason?: string | null;
    }
  | {
      type: "shift_claimed";
      shiftId: string;
    }
  | {
      type: "shift_assigned";
      shiftId: string;
    }
  | {
      type: "left_geofence" | "auto_check_out";
      shiftId: string;
      distanceMeters: number;
    }
  | {
      type: "time_adjusted";
      shiftId: string;
      reason: string;
    }
  | {
      type: "force_check_out";
      shiftId: string;
      reason?: string | null;
    }
  | {
      type: "new_message";
      recipientId: string;
      preview: string;
    }
  | {
      type: "shift_proposal_created";
      proposalId: string;
    }
  | {
      type: "shift_proposal_approved";
      proposalId: string;
      shiftId?: string | null;
    }
  | {
      type: "shift_proposal_rejected";
      proposalId: string;
      reason?: string | null;
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

    const admin = createAdminClient();
    const { data: caller } = await admin
      .from("profiles")
      .select("id, role, full_name, organization_id")
      .eq("id", user.id)
      .maybeSingle<CallerProfile>();

    if (!caller) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    const payload = (await request.json()) as NotificationRequest;
    const rows = await buildNotificationRows(admin, caller, payload);

    if (rows.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await admin.from("notifications").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void sendPushForNotifications(admin, rows).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Notification dispatch failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role configuration is missing.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function buildNotificationRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: NotificationRequest
): Promise<NotificationInsert[]> {
  switch (payload.type) {
    case "check_in_flagged":
    case "check_out_flagged":
      return buildFlaggedCheckRows(admin, caller, payload);
    case "shift_released":
      return buildShiftReleasedRows(admin, caller, payload);
    case "shift_claimed":
      return buildShiftClaimedRows(admin, caller, payload);
    case "shift_assigned":
      return buildShiftAssignedRows(admin, caller, payload);
    case "left_geofence":
    case "auto_check_out":
      return buildGeofenceRows(admin, caller, payload);
    case "time_adjusted":
      return buildTimeAdjustedRows(admin, caller, payload);
    case "force_check_out":
      return buildForceCheckOutRows(admin, caller, payload);
    case "new_message":
      return buildNewMessageRows(admin, caller, payload);
    case "shift_proposal_created":
      return buildProposalCreatedRows(admin, caller, payload);
    case "shift_proposal_approved":
      return buildProposalApprovedRows(admin, caller, payload);
    case "shift_proposal_rejected":
      return buildProposalRejectedRows(admin, caller, payload);
    default:
      return assertNever(payload);
  }
}

async function buildFlaggedCheckRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<
    NotificationRequest,
    { type: "check_in_flagged" | "check_out_flagged" }
  >
) {
  const shift = await getShift(admin, payload.shiftId);
  assertSameOrg(caller, shift.organization_id);

  if (shift.caregiver_id !== caller.id) {
    throw new Error("Only the assigned caregiver can send this notification.");
  }

  const adminIds = await getRoleRecipientIds(admin, shift.organization_id, ["admin"]);
  if (adminIds.length === 0) return [];

  return adminIds.map((recipientId) => ({
    organization_id: shift.organization_id,
    recipient_id: recipientId,
    kind: payload.type,
    title: payload.type === "check_in_flagged" ? "Flagged check-in" : "Flagged check-out",
    body:
      payload.flagReason ??
      (payload.type === "check_in_flagged"
        ? "A caregiver checked in outside the geofence."
        : "A caregiver checked out outside the geofence."),
    link: `/schedule/${shift.id}`,
    related_shift_id: shift.id,
  }));
}

async function buildShiftReleasedRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<NotificationRequest, { type: "shift_released" }>
) {
  const shift = await getShift(admin, payload.shiftId);
  assertSameOrg(caller, shift.organization_id);

  if (caller.role !== "caregiver" || shift.released_by !== caller.id) {
    throw new Error("Only the caregiver who released the shift can notify.");
  }

  const recipients = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", shift.organization_id)
    .eq("is_active", true)
    .neq("id", caller.id)
    .in("role", ["admin", "caregiver"]);

  const ids = (recipients.data ?? []).map((row) => row.id);
  if (ids.length === 0) return [];

  const date = new Date(shift.scheduled_start);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const clientName = shift.clients?.full_name ?? "the client";
  const reasonSuffix = payload.reason?.trim() ? ` (${payload.reason.trim()})` : "";
  const body = `${caller.full_name} released their ${dateStr} ${timeStr} shift with ${clientName}${reasonSuffix}. Tap to claim it.`;

  return ids.map((recipientId) => ({
    organization_id: shift.organization_id,
    recipient_id: recipientId,
    kind: "shift_released",
    title: "Shift available",
    body,
    link: `/schedule/${shift.id}`,
    related_shift_id: shift.id,
  }));
}

async function buildShiftClaimedRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<NotificationRequest, { type: "shift_claimed" }>
) {
  const shift = await getShift(admin, payload.shiftId);
  assertSameOrg(caller, shift.organization_id);

  if (caller.role !== "caregiver" || shift.caregiver_id !== caller.id) {
    throw new Error("Only the claiming caregiver can notify.");
  }

  const adminIds = await getRoleRecipientIds(admin, shift.organization_id, ["admin"]);
  const recipientIds = new Set(adminIds);
  if (shift.released_by) recipientIds.add(shift.released_by);
  if (recipientIds.size === 0) return [];

  const date = new Date(shift.scheduled_start);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const clientName = shift.clients?.full_name ?? "the client";
  const body = `${caller.full_name} picked up the ${dateStr} ${timeStr} shift with ${clientName}.`;

  return Array.from(recipientIds).map((recipientId) => ({
    organization_id: shift.organization_id,
    recipient_id: recipientId,
    kind: "shift_claimed",
    title: "Shift covered",
    body,
    link: `/schedule/${shift.id}`,
    related_shift_id: shift.id,
  }));
}

async function buildShiftAssignedRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<NotificationRequest, { type: "shift_assigned" }>
) {
  const shift = await getShift(admin, payload.shiftId);
  assertSameOrg(caller, shift.organization_id);

  if (caller.role !== "admin" && caller.role !== "client") {
    throw new Error("Only admins or clients can notify assigned caregivers.");
  }
  if (!shift.caregiver_id) return [];

  const date = new Date(shift.scheduled_start);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const clientName = shift.clients?.full_name ?? "the client";

  return [
    {
      organization_id: shift.organization_id,
      recipient_id: shift.caregiver_id,
      kind: "shift_assigned",
      title: "New shift assigned",
      body: `You were assigned a ${dateStr} ${timeStr} shift with ${clientName}.`,
      link: `/schedule/${shift.id}`,
      related_shift_id: shift.id,
    },
  ];
}

async function buildGeofenceRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<
    NotificationRequest,
    { type: "left_geofence" | "auto_check_out" }
  >
) {
  const shift = await getShift(admin, payload.shiftId);
  assertSameOrg(caller, shift.organization_id);

  if (shift.caregiver_id !== caller.id) {
    throw new Error("Only the assigned caregiver can send this notification.");
  }

  const name = caller.full_name || "Caregiver";
  const clientName = shift.clients?.full_name ?? "the client";
  const distance = formatDistance(payload.distanceMeters);

  if (payload.type === "left_geofence") {
    const recipientIds = await getRoleRecipientIds(admin, shift.organization_id, [
      "admin",
      "client",
    ]);
    return recipientIds.map((recipientId) => ({
      organization_id: shift.organization_id,
      recipient_id: recipientId,
      kind: "left_geofence",
      title: "Caregiver left location",
      body: `${name} left the geofence (${distance} from ${clientName}) without checking out yet.`,
      link: `/schedule/${shift.id}`,
      related_shift_id: shift.id,
    }));
  }

  const recipientIds = await getRoleRecipientIds(admin, shift.organization_id, [
    "admin",
    "client",
  ]);
  const allRecipients = new Set(recipientIds);
  allRecipients.add(caller.id);

  return Array.from(allRecipients).map((recipientId) => ({
    organization_id: shift.organization_id,
    recipient_id: recipientId,
    kind: "auto_check_out",
    title: "Auto-checked out",
    body: `${name} was auto-checked out at ${formatTime(new Date())} after leaving ${clientName}'s location (${distance} away).`,
    link: `/schedule/${shift.id}`,
    related_shift_id: shift.id,
  }));
}

async function buildTimeAdjustedRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<NotificationRequest, { type: "time_adjusted" }>
) {
  const shift = await getShift(admin, payload.shiftId);
  assertSameOrg(caller, shift.organization_id);

  if (caller.role !== "admin" && caller.role !== "client") {
    throw new Error("Only admins or clients can send this notification.");
  }
  if (!shift.caregiver_id) return [];

  return [
    {
      organization_id: shift.organization_id,
      recipient_id: shift.caregiver_id,
      kind: "time_adjusted",
      title: "Your shift times were adjusted",
      body: payload.reason.trim(),
      link: `/schedule/${shift.id}`,
      related_shift_id: shift.id,
    },
  ];
}

async function buildForceCheckOutRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<NotificationRequest, { type: "force_check_out" }>
) {
  const shift = await getShift(admin, payload.shiftId);
  assertSameOrg(caller, shift.organization_id);

  if (caller.role !== "admin" && caller.role !== "client") {
    throw new Error("Only admins or clients can send this notification.");
  }
  if (!shift.caregiver_id) return [];

  return [
    {
      organization_id: shift.organization_id,
      recipient_id: shift.caregiver_id,
      kind: "force_check_out",
      title: "You were checked out",
      body:
        payload.reason?.trim() ||
        "An admin manually checked you out. Tap to view shift details.",
      link: `/schedule/${shift.id}`,
      related_shift_id: shift.id,
    },
  ];
}

async function buildNewMessageRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<NotificationRequest, { type: "new_message" }>
) {
  if (payload.recipientId === caller.id) return [];

  const { data: recipient } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("id", payload.recipientId)
    .maybeSingle<{ id: string; organization_id: string }>();

  if (!recipient || recipient.organization_id !== caller.organization_id) {
    throw new Error("Message recipient is not in the same organization.");
  }

  return [
    {
      organization_id: caller.organization_id,
      recipient_id: payload.recipientId,
      kind: "new_message",
      title: `Message from ${caller.full_name}`,
      body: payload.preview.slice(0, 120),
      link: `/messages/${caller.id}`,
    },
  ];
}

async function buildProposalCreatedRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<NotificationRequest, { type: "shift_proposal_created" }>
) {
  const proposal = await getProposal(admin, payload.proposalId);
  assertSameOrg(caller, proposal.organization_id);

  if (caller.role !== "caregiver" || proposal.caregiver_id !== caller.id) {
    throw new Error("Only the proposing caregiver can notify.");
  }

  const recipientIds = await getRoleRecipientIds(admin, proposal.organization_id, [
    "admin",
  ]);
  if (recipientIds.length === 0) return [];

  const label = formatProposalLabel(proposal);
  const notes = proposal.notes?.trim() ? ` · ${proposal.notes.trim()}` : "";

  return recipientIds.map((recipientId) => ({
    organization_id: proposal.organization_id,
    recipient_id: recipientId,
    kind: "shift_proposal_created",
    title: "New shift proposal",
    body: `${caller.full_name} proposed ${label}${notes}.`,
    link: "/schedule/proposals",
    related_shift_id: proposal.shift_id ?? undefined,
  }));
}

async function buildProposalApprovedRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<NotificationRequest, { type: "shift_proposal_approved" }>
) {
  const proposal = await getProposal(admin, payload.proposalId);
  assertSameOrg(caller, proposal.organization_id);

  if (caller.role !== "admin") {
    throw new Error("Only admins can approve proposals.");
  }

  if (!proposal.caregiver_id) return [];

  const label = formatProposalLabel(proposal);
  const shiftId = payload.shiftId ?? proposal.shift_id ?? undefined;

  return [
    {
      organization_id: proposal.organization_id,
      recipient_id: proposal.caregiver_id,
      kind: "shift_proposal_approved",
      title: "Shift proposal approved",
      body: `Your proposal for ${label} was approved.`,
      link: shiftId ? `/schedule/${shiftId}` : "/schedule/proposals",
      related_shift_id: shiftId,
    },
  ];
}

async function buildProposalRejectedRows(
  admin: ReturnType<typeof createAdminClient>,
  caller: CallerProfile,
  payload: Extract<NotificationRequest, { type: "shift_proposal_rejected" }>
) {
  const proposal = await getProposal(admin, payload.proposalId);
  assertSameOrg(caller, proposal.organization_id);

  if (caller.role !== "admin") {
    throw new Error("Only admins can reject proposals.");
  }

  if (!proposal.caregiver_id) return [];

  const label = formatProposalLabel(proposal);
  const reasonSuffix = payload.reason?.trim() ? ` (${payload.reason.trim()})` : "";

  return [
    {
      organization_id: proposal.organization_id,
      recipient_id: proposal.caregiver_id,
      kind: "shift_proposal_rejected",
      title: "Shift proposal rejected",
      body: `Your proposal for ${label} was rejected${reasonSuffix}.`,
      link: "/schedule/proposals",
      related_shift_id: proposal.shift_id ?? undefined,
    },
  ];
}

async function getShift(
  admin: ReturnType<typeof createAdminClient>,
  shiftId: string
) {
  const { data: shift } = await admin
    .from("shifts")
    .select(
      `
      id,
      organization_id,
      caregiver_id,
      released_by,
      scheduled_start,
      clients ( full_name )
    `
    )
    .eq("id", shiftId)
    .maybeSingle();

  if (!shift) {
    throw new Error("Shift not found.");
  }

  return shift as unknown as ShiftRecord;
}

async function getProposal(
  admin: ReturnType<typeof createAdminClient>,
  proposalId: string
) {
  const { data: proposal } = await admin
    .from("shift_proposals")
    .select(
      `
      id,
      organization_id,
      caregiver_id,
      client_id,
      scheduled_start,
      scheduled_end,
      notes,
      status,
      rejection_reason,
      shift_id,
      profiles:caregiver_id ( full_name ),
      clients ( full_name )
    `
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) {
    throw new Error("Proposal not found.");
  }

  return proposal as unknown as ProposalRecord;
}

async function getRoleRecipientIds(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  roles: Role[]
) {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .in("role", roles);

  return (data ?? []).map((row) => row.id);
}

function assertSameOrg(caller: CallerProfile, organizationId: string) {
  if (caller.organization_id !== organizationId) {
    throw new Error("Cross-organization notifications are not allowed.");
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported notification request: ${JSON.stringify(value)}`);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatProposalLabel(proposal: ProposalRecord) {
  const date = new Date(proposal.scheduled_start);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const clientName = proposal.clients?.full_name ?? "general availability";

  return `${dateStr} ${timeStr} with ${clientName}`;
}
