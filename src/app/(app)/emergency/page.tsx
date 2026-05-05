import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EmergencyPanel from "@/components/emergency-panel";
import { StarOfLifeIcon, ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClientFull = {
  id: string;
  full_name: string;
  address: string | null;
  emergency_contact_1_name: string | null;
  emergency_contact_1_phone: string | null;
  emergency_contact_1_relationship: string | null;
  emergency_contact_2_name: string | null;
  emergency_contact_2_phone: string | null;
  emergency_contact_2_relationship: string | null;
  preferred_hospital_name: string | null;
  preferred_hospital_address: string | null;
  preferred_hospital_phone: string | null;
  primary_physician_name: string | null;
  primary_physician_address: string | null;
  primary_physician_phone: string | null;
  has_panic_button: boolean | null;
  panic_button_location: string | null;
  has_medical_alert: boolean | null;
  medical_alert_location: string | null;
  first_aid_location: string | null;
  hypoglycemia_kit_location: string | null;
  fire_extinguisher_location: string | null;
  aed_location: string | null;
};

type Allergy = {
  id: string;
  client_id: string;
  name: string;
  severity: "critical" | "mild" | "minor";
  notes: string | null;
};

export default async function EmergencyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: "admin" | "client" | "caregiver" | "family" }>();

  const { data: clientsRaw } = await supabase
    .from("clients")
    .select(
      "id, full_name, address, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relationship, emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relationship, preferred_hospital_name, preferred_hospital_address, preferred_hospital_phone, primary_physician_name, primary_physician_address, primary_physician_phone, has_panic_button, panic_button_location, has_medical_alert, medical_alert_location, first_aid_location, hypoglycemia_kit_location, fire_extinguisher_location, aed_location"
    )
    .order("full_name");

  const clients = (clientsRaw ?? []) as ClientFull[];

  let allAllergies: Allergy[] = [];
  try {
    const { data } = await supabase
      .from("client_allergies")
      .select("id, client_id, name, severity, notes");
    allAllergies = (data ?? []) as Allergy[];
  } catch {
    allAllergies = [];
  }

  const { data: urgentIncidents } = await supabase
    .from("incidents")
    .select("id, title")
    .eq("severity", "urgent")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-5">
        <Link
          href="/home"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back
        </Link>
        <div className="flex items-center gap-3">
          <span className="relative w-14 h-14 rounded-2xl bg-red-600 text-cream-50 grid place-items-center shrink-0 shadow-xl ring-4 ring-red-200/80">
            <span className="absolute inset-0 rounded-2xl bg-red-500/30 animate-ping" />
            <StarOfLifeIcon size={30} className="relative" />
          </span>
          <div>
            <h1 className="font-display text-3xl text-ink-900 leading-tight">
              Emergency
            </h1>
            <p className="text-ink-500 text-sm">
              Critical info and active alerts.
            </p>
          </div>
        </div>
      </header>

      {(urgentIncidents ?? []).length > 0 && (
        <section className="mb-6 space-y-2">
          {urgentIncidents?.map((inc) => (
            <Link
              key={inc.id}
              href={`/incidents?incident=${inc.id}`}
              className="flex items-center justify-between bg-terracotta-500 text-white p-5 rounded-[2rem] shadow-lg animate-pulse border-2 border-white/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                 <StarOfLifeIcon size={24} className="shrink-0" />
                 <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-80 leading-none mb-1">Active Urgent Incident</p>
                    <p className="font-display text-lg truncate leading-none">{inc.title}</p>
                 </div>
              </div>
              <ArrowRightIcon size={20} className="shrink-0 ml-2" />
            </Link>
          ))}
        </section>
      )}

      <a
        href="tel:911"
        className="block bg-red-600 hover:bg-red-700 text-cream-50 rounded-[2rem] p-6 mb-8 transition active:scale-[0.99] shadow-xl text-center border-4 border-white/10"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-cream-50/70 mb-1 font-bold">
          Emergency Services
        </p>
        <p className="font-display text-4xl">Call 911</p>
      </a>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
        <Link
          href="/incidents"
          className="bg-terracotta-600 hover:bg-terracotta-500 text-cream-50 rounded-2xl shadow-soft px-4 py-3 transition active:scale-[0.99] border border-terracotta-400/30"
        >
          <span className="block font-medium">Report an incident</span>
          <span className="block text-xs text-cream-50/80">Create a care or safety report</span>
        </Link>
        {profile?.role !== "caregiver" && (
          <Link
            href="/incidents"
            className="bg-white hover:bg-cream-50 rounded-2xl shadow-soft px-4 py-3 transition active:scale-[0.99]"
          >
            <span className="block font-medium text-ink-900">Incident history</span>
            <span className="block text-xs text-ink-500">Review submitted reports</span>
          </Link>
        )}
      </section>

      {clients.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center grain-overlay">
          <p className="text-sm text-ink-500">No clients to show.</p>
        </div>
      ) : (
        <div id="emergency-info" className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-ink-400 font-bold px-1">Client Medical Info</h2>
          {clients.map((client) => {
            const clientAllergies = allAllergies.filter(
              (a) => a.client_id === client.id
            );
            return (
              <div key={client.id}>
                <div className="flex items-baseline justify-between mb-1.5 px-1">
                  <h2 className="font-display text-lg text-ink-900">
                    {client.full_name}
                  </h2>
                  {client.address && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-forest-600 hover:underline font-medium"
                    >
                      View Map
                    </a>
                  )}
                </div>
                <EmergencyPanel info={client} allergies={clientAllergies} />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
