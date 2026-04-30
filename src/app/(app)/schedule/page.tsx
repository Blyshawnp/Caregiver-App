import { createClient } from "@/lib/supabase/server";
import ScheduleView from "./schedule-view";

export type ScheduleShift = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  caregiver_id: string | null;
  caregiver_name: string | null;
  client_name: string;
  shift_type_name: string | null;
  shift_type_color: string | null;
  has_check_in: boolean;
  is_complete: boolean;
  is_released: boolean;
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
    .select("role")
    .eq("id", user.id)
    .single<{ role: "admin" | "client" | "caregiver" | "family" }>();

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
      profiles:caregiver_id ( full_name ),
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
    profiles: { full_name: string } | null;
    clients: { full_name: string } | null;
    shift_types: { name: string; color: string } | null;
    check_ins: Array<{
      check_in_time: string | null;
      check_out_time: string | null;
    }>;
  };

  const shifts: ScheduleShift[] = (
    (rows ?? []) as unknown as ScheduleQueryRow[]
  ).map((r) => ({
    id: r.id,
    scheduled_start: r.scheduled_start,
    scheduled_end: r.scheduled_end,
    caregiver_id: r.caregiver_id,
    caregiver_name: r.profiles?.full_name ?? null,
    client_name: r.clients?.full_name ?? "Client",
    shift_type_name: r.shift_types?.name ?? null,
    shift_type_color: r.shift_types?.color ?? null,
    has_check_in: !!r.check_ins?.[0]?.check_in_time,
    is_complete: !!r.check_ins?.[0]?.check_out_time,
    is_released: !!r.is_released,
    assignment_status: r.assignment_status ?? null,
  }));

  return <ScheduleView shifts={shifts} role={profile?.role ?? "caregiver"} />;
}
