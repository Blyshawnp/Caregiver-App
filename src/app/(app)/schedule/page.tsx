import { createClient } from "@/lib/supabase/server";
import ScheduleView from "./schedule-view";

export type ScheduleShift = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  caregiver_id: string | null;
  caregiver_profile_id: string | null;
  caregiver_name: string | null;
  caregiver_avatar_url: string | null;
  caregiver_avatar_color: string | null;
  client_name: string | null;
  shift_type_name: string | null;
  shift_type_color: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  has_check_in: boolean;
  is_complete: boolean;
  is_released: boolean;
  is_open: boolean;
  assignment_status: "pending" | "accepted" | "declined" | null;
};

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, id")
    .eq("id", user.id)
    .single<{ role: "admin" | "client" | "caregiver" | "family"; id: string }>();

  if (profile?.role === "admin" || profile?.role === "client") {
    try {
      await supabase.rpc("generate_recurring_shifts");
    } catch {
      // Ignore until the migration is applied.
    }
  }

  const start = new Date();
  start.setDate(start.getDate() - 14);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 60);
  end.setHours(23, 59, 59, 999);

  const { data: rows } = await supabase
    .from("shifts")
    .select(
      `
      id,
      scheduled_start,
      scheduled_end,
      caregiver_id,
      assignment_status,
      is_released,
      profiles:caregiver_id ( full_name, avatar_url, avatar_color ),
      clients ( full_name ),
      shift_types ( name, color ),
      check_ins ( check_in_time, check_out_time )
    `
    )
    .gte("scheduled_start", start.toISOString())
    .lte("scheduled_start", end.toISOString())
    .order("scheduled_start", { ascending: true });

  type ScheduleQueryRow = {
    id: string;
    scheduled_start: string;
    scheduled_end: string;
    caregiver_id: string | null;
    assignment_status: "pending" | "accepted" | "declined" | null;
    is_released: boolean | null;
    profiles: {
      full_name: string;
      avatar_url: string | null;
      avatar_color: string | null;
    } | null;
    clients: { full_name: string } | null;
    shift_types: { name: string; color: string } | null;
    check_ins:
      | Array<{
          check_in_time: string | null;
          check_out_time: string | null;
        }>
      | {
          check_in_time: string | null;
          check_out_time: string | null;
        }
      | null;
  };

  const viewerRole = profile?.role ?? "caregiver";
  const shifts: ScheduleShift[] = (
    (rows ?? []) as unknown as ScheduleQueryRow[]
  ).map((r) => {
    const checkIns = normalizeRows(r.check_ins);
    const activeCheckIn =
      checkIns.find((row) => row.check_in_time && !row.check_out_time) ??
      checkIns[0] ??
      null;
    const canShowClientDetails =
      viewerRole !== "caregiver" || r.caregiver_id === profile?.id;

    return {
      id: r.id,
      scheduled_start: r.scheduled_start,
      scheduled_end: r.scheduled_end,
      caregiver_id: r.caregiver_id,
      caregiver_profile_id: r.caregiver_id,
      caregiver_name: r.profiles?.full_name ?? null,
      caregiver_avatar_url: r.profiles?.avatar_url ?? null,
      caregiver_avatar_color: r.profiles?.avatar_color ?? null,
      client_name: canShowClientDetails ? r.clients?.full_name ?? null : null,
      shift_type_name: r.shift_types?.name ?? null,
      shift_type_color: r.shift_types?.color ?? null,
      check_in_time: activeCheckIn?.check_in_time ?? null,
      check_out_time: activeCheckIn?.check_out_time ?? null,
      has_check_in: !!activeCheckIn?.check_in_time,
      is_complete: !!activeCheckIn?.check_out_time,
      is_released: !!r.is_released,
      is_open: !r.caregiver_id && !r.is_released && !activeCheckIn?.check_in_time,
      assignment_status: r.assignment_status ?? null,
    };
  });

  return <ScheduleView shifts={shifts} role={viewerRole} />;
}

function normalizeRows<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}
