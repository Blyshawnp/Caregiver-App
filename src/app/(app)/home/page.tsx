import { createClient } from "@/lib/supabase/server";
import HomeContent from "./home-content";

export type ShiftRow = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  caregiver_id: string | null;
  caregiver_name: string | null;
  client_name: string;
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
    .select("id, role, full_name")
    .eq("id", user.id)
    .single<{ id: string; role: "admin" | "client" | "caregiver"; full_name: string }>();

  if (!profile) return null;

  // Find this user's relevant shifts (today + future, ordered by start)
  // For caregivers: only their assigned shifts. Admin/client: all org shifts.
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);

  let query = supabase
    .from("shifts")
    .select(
      `
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
    `
    )
    .gte("scheduled_end", now.toISOString())
    .lte("scheduled_start", horizon.toISOString())
    .order("scheduled_start", { ascending: true });

  if (profile.role === "caregiver") {
    query = query.eq("caregiver_id", profile.id);
  }

  const { data: rows } = await query;

  const shifts: ShiftRow[] =
    (rows ?? []).map((r: any) => {
      const todos = r.shift_todos ?? [];
      return {
        id: r.id,
        scheduled_start: r.scheduled_start,
        scheduled_end: r.scheduled_end,
        caregiver_id: r.caregiver_id,
        caregiver_name: r.profiles?.[0]?.full_name ?? null,
        client_name: r.clients?.[0]?.full_name ?? "Client",
        client_address: r.clients?.[0]?.address ?? null,
        client_lat: r.clients?.[0]?.latitude ?? null,
        client_lng: r.clients?.[0]?.longitude ?? null,
        geofence_radius_meters: r.clients?.[0]?.geofence_radius_meters ?? 150,
        shift_type_name: r.shift_types?.[0]?.name ?? null,
        shift_type_color: r.shift_types?.[0]?.color ?? null,
        check_in_time: r.check_ins?.[0]?.check_in_time ?? null,
        check_out_time: r.check_ins?.[0]?.check_out_time ?? null,
        todo_total: todos.length,
        todo_done: todos.filter((t: any) => t.is_completed).length,
        assignment_status: r.assignment_status ?? null,
      };
    }) ?? [];

  // For admin/client: list of caregivers currently on shift
  let activeShifts: ActiveShift[] = [];
  if (profile.role !== "caregiver") {
    const { data: activeRows } = await supabase
      .from("currently_on_shift")
      .select(
        "shift_id, caregiver_name, client_name, check_in_time, scheduled_end, past_scheduled_end, flagged_outside_geofence, shift_type_color"
      )
      .order("check_in_time", { ascending: true });

    activeShifts = (activeRows ?? []).map((r: any) => ({
      shift_id: r.shift_id,
      caregiver_name: r.caregiver_name ?? "Caregiver",
      client_name: r.client_name ?? "Client",
      check_in_time: r.check_in_time,
      scheduled_end: r.scheduled_end,
      past_scheduled_end: r.past_scheduled_end,
      flagged: r.flagged_outside_geofence,
      shift_type_color: r.shift_type_color ?? null,
    }));
  }

  return (
    <HomeContent
      role={profile.role}
      userId={profile.id}
      shifts={shifts}
      activeShifts={activeShifts}
    />
  );
}

export type ActiveShift = {
  shift_id: string;
  caregiver_name: string;
  client_name: string;
  check_in_time: string;
  scheduled_end: string;
  past_scheduled_end: boolean;
  flagged: boolean;
  shift_type_color: string | null;
};
