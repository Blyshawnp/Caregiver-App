import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CheckOutForm from "./check-out-form";

export default async function CheckOutPage({
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

  const { data: shift } = await supabase
    .from("shifts")
    .select(
      `
      id,
      caregiver_id,
      organization_id,
      scheduled_start,
      scheduled_end,
      clients ( full_name, address, latitude, longitude, geofence_radius_meters ),
      check_ins ( id, check_in_time, check_out_time ),
      shift_todos ( id, task_name, is_completed )
    `
    )
    .eq("id", id)
    .single();

  if (!shift) notFound();

  if ((shift as any).caregiver_id !== user.id) {
    return (
      <main className="px-5 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center">
          <h1 className="font-display text-2xl mb-2">Not your shift</h1>
          <Link
            href={`/schedule/${id}`}
            className="inline-block mt-4 bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl text-sm font-medium transition"
          >
            Back
          </Link>
        </div>
      </main>
    );
  }

  const existing = (shift as any).check_ins?.[0];
  if (!existing?.check_in_time) {
    redirect(`/schedule/${id}/check-in`);
  }
  if (existing?.check_out_time) {
    redirect(`/schedule/${id}`);
  }

  const todos = (shift as any).shift_todos ?? [];

  return (
    <CheckOutForm
      shift={shift as any}
      checkInId={existing.id}
      checkInTime={existing.check_in_time}
      todos={todos}
    />
  );
}
