import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShiftTypesManager from "./shift-types-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ShiftTypesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single<{ role: "admin" | "client" | "caregiver" | "family"; organization_id: string }>();

  if (!profile || (profile.role !== "admin" && profile.role !== "client")) {
    redirect("/schedule");
  }

  const { data: shiftTypes } = await supabase
    .from("shift_types")
    .select("id, name, color")
    .eq("organization_id", profile.organization_id)
    .order("name");

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link href="/schedule" className="text-sm text-forest-600 hover:underline mb-2 inline-block">
          ← Back to schedule
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Shift types</h1>
        <p className="text-ink-500 text-sm">Add and rename the shift type options used on schedules.</p>
      </header>

      <ShiftTypesManager shiftTypes={shiftTypes ?? []} />
    </main>
  );
}
