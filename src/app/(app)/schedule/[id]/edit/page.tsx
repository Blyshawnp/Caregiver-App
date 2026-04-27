import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EditShiftForm from "./edit-shift-form";

export default async function EditShiftPage({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: "admin" | "client" | "caregiver" }>();

  if (!profile || profile.role === "caregiver") {
    return (
      <main className="px-5 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center">
          <h1 className="font-display text-2xl mb-2">Not allowed</h1>
          <p className="text-ink-500 text-sm mb-5">
            Only administrators and clients can edit shifts.
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

  const [shiftRes, caregiversRes, shiftTypesRes, clientsRes] = await Promise.all([
    supabase
      .from("shifts")
      .select(
        "id, scheduled_start, scheduled_end, caregiver_id, client_id, shift_type_id, bonus_amount, bonus_reason, notes"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "caregiver")
      .eq("is_active", true)
      .order("full_name"),
    supabase.from("shift_types").select("id, name, color").order("name"),
    supabase.from("clients").select("id, full_name").order("full_name"),
  ]);

  if (!shiftRes.data) notFound();

  return (
    <EditShiftForm
      shift={shiftRes.data as any}
      caregivers={caregiversRes.data ?? []}
      shiftTypes={shiftTypesRes.data ?? []}
      clients={clientsRes.data ?? []}
    />
  );
}
