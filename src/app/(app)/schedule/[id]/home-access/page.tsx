import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HomeInfoCard from "@/components/home-info-card";
import type { Role } from "@/lib/db-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ShiftHomeAccess = {
  id: string;
  caregiver_id: string | null;
  client_id: string;
  clients: {
    full_name: string;
    wifi_ssid: string | null;
    wifi_password: string | null;
    home_notes: string | null;
  } | null;
};

export default async function ShiftHomeAccessPage({
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
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: Role }>();

  if (!profile || profile.role === "family") redirect(`/schedule/${id}`);

  const { data: shiftRaw } = await supabase
    .from("shifts")
    .select(
      "id, caregiver_id, client_id, clients ( full_name, wifi_ssid, wifi_password, home_notes )"
    )
    .eq("id", id)
    .maybeSingle();

  if (!shiftRaw) notFound();

  const shift = shiftRaw as unknown as ShiftHomeAccess;
  const isAssignedCaregiver =
    profile.role === "caregiver" && profile.id === shift.caregiver_id;
  const canAccess =
    profile.role === "admin" || profile.role === "client" || isAssignedCaregiver;

  if (!canAccess) redirect(`/schedule/${id}`);

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href={`/schedule/${id}`}
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back to shift
        </Link>
        <h1 className="font-display text-3xl text-ink-900">
          Home access
        </h1>
        <p className="text-ink-500 text-sm">
          {shift.clients?.full_name ?? "Client"} access details and home notes
        </p>
      </header>

      {shift.clients ? (
        <HomeInfoCard
          title="Home access"
          info={{
            wifi_ssid: shift.clients.wifi_ssid,
            wifi_password: shift.clients.wifi_password,
            emergency_contact_1_name: null,
            emergency_contact_1_phone: null,
            emergency_contact_1_relationship: null,
            emergency_contact_2_name: null,
            emergency_contact_2_phone: null,
            emergency_contact_2_relationship: null,
            home_notes: shift.clients.home_notes,
          }}
        />
      ) : (
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center grain-overlay">
          <p className="text-sm text-ink-500">
            No home access details have been saved for this client.
          </p>
        </div>
      )}

      {(profile.role === "admin" || profile.role === "client") && (
        <Link
          href={`/clients/${shift.client_id}/home-info`}
          className="mt-4 flex items-center justify-between bg-white hover:bg-cream-50 px-5 py-3.5 rounded-2xl shadow-soft text-ink-900 font-medium transition"
        >
          Edit home info
          <span className="text-ink-300">→</span>
        </Link>
      )}
    </main>
  );
}
