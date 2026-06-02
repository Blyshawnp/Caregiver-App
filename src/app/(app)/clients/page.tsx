import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { withClientPhotoDisplayUrls } from "@/lib/client-photos";
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
    .single<{ role: "admin" | "client" | "caregiver" | "family"; organization_id: string }>();

  if (!profile) redirect("/me");
  const canManage = profile.role === "admin" || profile.role === "client";

  const { data: clients } = await supabase
    .from("clients")
    .select("id, full_name, photo_url, address, latitude, longitude, geofence_radius_meters")
    .order("full_name");
  const clientsWithPhotos = await withClientPhotoDisplayUrls(supabase, clients ?? []);

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
          {canManage
            ? "View clients, pets, home info, and geofence settings"
            : "View assigned client details, pets, and home info"}
        </p>
      </header>

      <ClientsList clients={clientsWithPhotos} canManage={canManage} />
    </main>
  );
}
