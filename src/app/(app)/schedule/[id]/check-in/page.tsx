import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CheckInForm from "./check-in-form";
import type { AssignmentStatus } from "@/lib/db-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ShiftForCheckIn = {
  id: string;
  caregiver_id: string | null;
  assignment_status: AssignmentStatus | null;
  scheduled_start: string;
  scheduled_end: string;
  organization_id: string;
  clients: {
    full_name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    geofence_radius_meters: number;
  } | null;
  check_ins: Array<{
    id: string;
    check_in_time: string | null;
    check_out_time: string | null;
  }> | null;
};

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shiftRaw } = await supabase
    .from("shifts")
    .select(
      `
      id,
      caregiver_id,
      assignment_status,
      scheduled_start,
      scheduled_end,
      organization_id,
      clients ( full_name, address, latitude, longitude, geofence_radius_meters ),
      check_ins ( id, check_in_time, check_out_time )
    `
    )
    .eq("id", id)
    .single();

  if (!shiftRaw) notFound();
  const shift = shiftRaw as unknown as ShiftForCheckIn;

  // Only the assigned caregiver can check in
  if (shift.caregiver_id !== user.id) {
    return (
      <main className="px-5 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center">
          <h1 className="font-display text-2xl mb-2">Not your shift</h1>
          <p className="text-ink-500 text-sm mb-5">
            Only the assigned caregiver can check in.
          </p>
          <Link
            href={`/schedule/${id}`}
            className="inline-block bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl text-sm font-medium transition"
          >
            Back
          </Link>
        </div>
      </main>
    );
  }

  // Must be accepted before check-in
  if (shift.assignment_status === "pending") {
    return (
      <main className="px-5 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center">
          <h1 className="font-display text-2xl mb-2">Accept first</h1>
          <p className="text-ink-500 text-sm mb-5">
            Accept this shift before checking in.
          </p>
          <Link
            href={`/schedule/${id}`}
            className="inline-block bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl text-sm font-medium transition"
          >
            Back to shift
          </Link>
        </div>
      </main>
    );
  }

  // Already checked in?
  const existing = shift.check_ins?.[0];
  if (existing?.check_in_time) {
    redirect(`/schedule/${id}`);
  }

  // Form requires non-null clients (geofence)
  if (!shift.clients) {
    redirect(`/schedule/${id}`);
  }

  return (
    <CheckInForm
      shift={{
        id: shift.id,
        caregiver_id: shift.caregiver_id as string,
        organization_id: shift.organization_id,
        scheduled_start: shift.scheduled_start,
        scheduled_end: shift.scheduled_end,
        clients: shift.clients,
      }}
    />
  );
}
