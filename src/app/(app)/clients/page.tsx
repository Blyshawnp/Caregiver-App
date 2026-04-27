import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientsList from "./clients-list";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single<{ role: "admin" | "client" | "caregiver"; organization_id: string }>();

  if (!profile || profile.role === "caregiver") redirect("/me");

  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, address, latitude, longitude, geofence_radius_meters")
    .order("full_name");

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/me"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Clients</h1>
        <p className="text-ink-500 text-sm">
          Set the address and geofence for each client
        </p>
      </header>

      <ClientsList clients={clients ?? []} />
    </main>
  );
}
