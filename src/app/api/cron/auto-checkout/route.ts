import { NextResponse } from "next/server";
import { haversineMeters, formatDistance } from "@/lib/geo";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushForNotifications } from "@/lib/web-push";

type ActiveCheckInRow = {
  id: string;
  shift_id: string;
  caregiver_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  last_location_at: string | null;
  last_location_latitude: number | null;
  last_location_longitude: number | null;
  last_location_distance_meters: number | null;
  last_location_within_geofence: boolean | null;
  shifts: {
    id: string;
    organization_id: string;
    scheduled_end: string;
    clients: {
      full_name: string | null;
      latitude: number | null;
      longitude: number | null;
      geofence_radius_meters: number;
    } | null;
  } | null;
};

type RecipientRow = { id: string; role: "admin" | "client" };

const DEFAULT_TIMEZONE = "America/New_York";
const RECENT_PING_WINDOW_MINUTES = 30;

export async function GET(request: Request) {
  const authError = authorizeCron(request);
  if (authError) return authError;

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("check_ins")
    .select(
      `
      id,
      shift_id,
      caregiver_id,
      check_in_time,
      check_out_time,
      last_location_at,
      last_location_latitude,
      last_location_longitude,
      last_location_distance_meters,
      last_location_within_geofence,
      shifts!inner (
        id,
        organization_id,
        scheduled_end,
        clients ( full_name, latitude, longitude, geofence_radius_meters )
      )
    `
    )
    .not("check_in_time", "is", null)
    .is("check_out_time", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let autoCheckedOut = 0;

  for (const row of (rows ?? []) as unknown as ActiveCheckInRow[]) {
    if (!shouldAutoCheckOut(row)) continue;

    const distanceMeters = computeDistance(row);
    const checkoutTime = row.last_location_at ?? new Date().toISOString();
    const clientName = row.shifts?.clients?.full_name ?? "the client";

    const { data: written } = await admin
      .from("check_ins")
      .update({
        check_out_time: checkoutTime,
        check_out_latitude: row.last_location_latitude,
        check_out_longitude: row.last_location_longitude,
        check_out_within_geofence: false,
        flagged_outside_geofence: true,
        flag_reason: `Auto-checked out after 8 PM outside geofence (${formatDistance(
          distanceMeters ?? 0
        )} away)`,
        check_out_method: "auto_geofence_after_8pm",
        check_out_by: null,
      })
      .eq("id", row.id)
      .is("check_out_time", null)
      .select("id");

    if (!written || written.length === 0) {
      continue;
    }

    autoCheckedOut += 1;
    await insertAutoCheckoutNotifications(admin, row, clientName, distanceMeters ?? 0);
  }

  return NextResponse.json({ ok: true, autoCheckedOut });
}

function authorizeCron(request: Request) {
  const bearer = request.headers.get("authorization");
  const expected =
    process.env.AUTO_CHECKOUT_CRON_SECRET ?? process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json(
      { error: "Cron secret is not configured." },
      { status: 500 }
    );
  }

  if (bearer !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function shouldAutoCheckOut(row: ActiveCheckInRow) {
  if (!row.last_location_at || row.last_location_within_geofence !== false) {
    return false;
  }

  const lastLocationAt = new Date(row.last_location_at);
  if (Number.isNaN(lastLocationAt.getTime())) return false;

  const now = new Date();
  const ageMinutes = (now.getTime() - lastLocationAt.getTime()) / 60_000;
  if (ageMinutes > RECENT_PING_WINDOW_MINUTES) {
    return false;
  }

  const localHour = getHourInTimezone(now, DEFAULT_TIMEZONE);
  const pingHour = getHourInTimezone(lastLocationAt, DEFAULT_TIMEZONE);
  return localHour >= 20 && pingHour >= 20;
}

function getHourInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value;
  return hour ? Number(hour) : 0;
}

function computeDistance(row: ActiveCheckInRow) {
  if (
    row.last_location_distance_meters != null
  ) {
    return row.last_location_distance_meters;
  }

  const client = row.shifts?.clients;
  if (
    client?.latitude == null ||
    client.longitude == null ||
    row.last_location_latitude == null ||
    row.last_location_longitude == null
  ) {
    return null;
  }

  return haversineMeters(
    row.last_location_latitude,
    row.last_location_longitude,
    client.latitude,
    client.longitude
  );
}

async function insertAutoCheckoutNotifications(
  admin: ReturnType<typeof createAdminClient>,
  row: ActiveCheckInRow,
  clientName: string,
  distanceMeters: number
) {
  const shift = row.shifts;
  if (!shift) return;

  const { data: recipients } = await admin
    .from("profiles")
    .select("id, role")
    .eq("organization_id", shift.organization_id)
    .eq("is_active", true)
    .in("role", ["admin", "client"])
    .returns<RecipientRow[]>();

  const recipientRows = (recipients ?? []).map((recipient) => ({
    organization_id: shift.organization_id,
    recipient_id: recipient.id,
    kind: "auto_check_out",
    title: "Auto-checked out after 8 PM",
    body: `A caregiver was auto-checked out after leaving ${clientName}'s geofence (${formatDistance(
      distanceMeters
    )} away).`,
    link: `/schedule/${row.shift_id}`,
    related_shift_id: row.shift_id,
  }));

  if (row.caregiver_id) {
    recipientRows.push({
      organization_id: shift.organization_id,
      recipient_id: row.caregiver_id,
      kind: "auto_check_out",
      title: "You were auto-checked out",
      body: `You were auto-checked out after 8 PM because your last known location was outside ${clientName}'s geofence.`,
      link: `/schedule/${row.shift_id}`,
      related_shift_id: row.shift_id,
    });
  }

  if (recipientRows.length > 0) {
    await admin.from("notifications").insert(recipientRows);
    void sendPushForNotifications(admin, recipientRows).catch(() => {});
  }
}
