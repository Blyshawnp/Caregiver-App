import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewShiftForm from "./new-shift-form";

export default async function NewShiftPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single<{
      role: "admin" | "client" | "caregiver";
      organization_id: string;
    }>();

  if (!profile || profile.role === "caregiver") {
    return (
      <main className="px-5 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center">
          <h1 className="font-display text-2xl mb-2">Not allowed</h1>
          <p className="text-ink-500 text-sm mb-5">
            Only administrators and clients can create shifts.
          </p>
          <Link
            href="/schedule"
            className="inline-block bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl text-sm font-medium transition"
          >
            Back to schedule
          </Link>
        </div>
      </main>
    );
  }

  const [caregiversRes, shiftTypesRes, clientsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "caregiver")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("shift_types")
      .select("id, name, color")
      .order("name"),
    supabase.from("clients").select("id, full_name").order("full_name"),
  ]);

  return (
    <NewShiftForm
      caregivers={caregiversRes.data ?? []}
      shiftTypes={shiftTypesRes.data ?? []}
      clients={clientsRes.data ?? []}
      organizationId={profile.organization_id}
      currentUserId={user.id}
    />
  );
}
