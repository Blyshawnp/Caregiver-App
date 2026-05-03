import { createClient } from "@/lib/supabase/server";
import HomeContent from "./home-content";

export type ShiftRow = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  caregiver_id: string | null;
  caregiver_name: string | null;
  client_name: string | null;
  client_address: string | null;
  client_lat: number | null;
  client_lng: number | null;
  geofence_radius_meters: number;
  shift_type_name: string | null;
  shift_type_color: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  todo_total: number;
  todo_done: number;
  assignment_status: "pending" | "accepted" | "declined" | null;
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, organization_id")
    .eq("id", user.id)
    .single<{ id: string; role: "admin" | "client" | "caregiver" | "family"; full_name: string; organization_id: string }>();

  if (!profile) return null;

  // Find this user's relevant shifts (today + future, ordered by start)
  // For caregivers: only their assigned shifts. Admin/client: all org shifts.
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const lookback = new Date(now);
  lookback.setDate(lookback.getDate() - 14);

  const shiftSelect = `
    id,
    scheduled_start,
    scheduled_end,
    caregiver_id,
    assignment_status,
    profiles:caregiver_id ( full_name ),
    clients ( full_name, address, latitude, longitude, geofence_radius_meters ),
    shift_types ( name, color ),
    check_ins ( check_in_time, check_out_time ),
    shift_todos ( id, is_completed )
  `;

  let query = supabase
    .from("shifts")
    .select(shiftSelect)
    .lte("scheduled_start", horizon.toISOString())
    .order("scheduled_start", { ascending: true });

  if (profile.role === "caregiver") {
    query = query
      .eq("caregiver_id", profile.id)
      .gte("scheduled_start", lookback.toISOString());
  } else {
    query = query.gte("scheduled_end", now.toISOString());
  }

  const { data: rows } = await query;

  type ShiftQueryRow = {
    id: string;
    scheduled_start: string;
    scheduled_end: string;
    caregiver_id: string | null;
    assignment_status: "pending" | "accepted" | "declined" | null;
    profiles: { full_name: string } | null;
    clients: {
      full_name: string;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
      geofence_radius_meters: number;
    } | null;
    shift_types: { name: string; color: string } | null;
    check_ins: Array<{ check_in_time: string | null; check_out_time: string | null }>;
    shift_todos: Array<{ id: string; is_completed: boolean }>;
  };

  const mergedRows = new Map<string, ShiftQueryRow>();
  for (const row of (rows ?? []) as unknown as ShiftQueryRow[]) {
    mergedRows.set(row.id, row);
  }

  if (profile.role === "caregiver") {
    const { data: activeRows } = await supabase
      .from("shifts")
      .select(
        shiftSelect.replace(
          "check_ins ( check_in_time, check_out_time )",
          "check_ins!inner ( check_in_time, check_out_time )"
        )
      )
      .eq("caregiver_id", profile.id)
      .not("check_ins.check_in_time", "is", null)
      .is("check_ins.check_out_time", null);

    for (const row of (activeRows ?? []) as unknown as ShiftQueryRow[]) {
      mergedRows.set(row.id, row);
    }
  }

  const shifts: ShiftRow[] = Array.from(mergedRows.values())
    .map(mapShiftRow)
    .sort(
      (a, b) =>
        new Date(a.scheduled_start).getTime() -
        new Date(b.scheduled_start).getTime()
    );

  // For admin/client: list of caregivers currently on shift
  let activeShifts: ActiveShift[] = [];
  if (profile.role !== "caregiver") {
    type ActiveQueryRow = {
      shift_id: string;
      caregiver_name: string | null;
      client_name: string | null;
      check_in_time: string;
      scheduled_end: string;
      past_scheduled_end: boolean;
      flagged_outside_geofence: boolean | null;
      shift_type_color: string | null;
    };

    const { data: activeRows } = await supabase
      .from("currently_on_shift")
      .select(
        "shift_id, caregiver_name, client_name, check_in_time, scheduled_end, past_scheduled_end, flagged_outside_geofence, shift_type_color"
      )
      .order("check_in_time", { ascending: true })
      .returns<ActiveQueryRow[]>();

    activeShifts = (activeRows ?? []).map((r) => ({
      shift_id: r.shift_id,
      caregiver_name: r.caregiver_name ?? "Caregiver",
      client_name: r.client_name ?? null,
      check_in_time: r.check_in_time,
      scheduled_end: r.scheduled_end,
      past_scheduled_end: r.past_scheduled_end,
      flagged: r.flagged_outside_geofence ?? false,
      shift_type_color: r.shift_type_color ?? null,
    }));
  }

  return (
    <HomeContent
      role={profile.role}
      userId={profile.id}
      organizationId={profile.organization_id}
      shifts={shifts}
      activeShifts={activeShifts}
    />
  );
}

export type ActiveShift = {
  shift_id: string;
  caregiver_name: string;
  client_name: string | null;
  check_in_time: string;
  scheduled_end: string;
  past_scheduled_end: boolean;
  flagged: boolean;
  shift_type_color: string | null;
};

function mapShiftRow(r: {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  caregiver_id: string | null;
  assignment_status: "pending" | "accepted" | "declined" | null;
  profiles: { full_name: string } | null;
  clients: {
    full_name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    geofence_radius_meters: number;
  } | null;
  shift_types: { name: string; color: string } | null;
  check_ins: Array<{ check_in_time: string | null; check_out_time: string | null }>;
  shift_todos: Array<{ id: string; is_completed: boolean }>;
}): ShiftRow {
  const todos = r.shift_todos ?? [];
  return {
    id: r.id,
    scheduled_start: r.scheduled_start,
    scheduled_end: r.scheduled_end,
    caregiver_id: r.caregiver_id,
    caregiver_name: r.profiles?.full_name ?? null,
    client_name: r.clients?.full_name ?? null,
    client_address: r.clients?.address ?? null,
    client_lat: r.clients?.latitude ?? null,
    client_lng: r.clients?.longitude ?? null,
    geofence_radius_meters: r.clients?.geofence_radius_meters ?? 150,
    shift_type_name: r.shift_types?.name ?? null,
    shift_type_color: r.shift_types?.color ?? null,
    check_in_time: r.check_ins?.[0]?.check_in_time ?? null,
    check_out_time: r.check_ins?.[0]?.check_out_time ?? null,
    todo_total: todos.length,
    todo_done: todos.filter((t) => t.is_completed).length,
    assignment_status: r.assignment_status ?? null,
  };
}
