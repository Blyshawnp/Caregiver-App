import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HomeInfoEditor from "./home-info-editor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClientHomeInfo = {
  id: string;
  full_name: string;
  organization_id: string;
  wifi_ssid: string | null;
  wifi_password: string | null;
  emergency_contact_1_name: string | null;
  emergency_contact_1_phone: string | null;
  emergency_contact_1_relationship: string | null;
  emergency_contact_2_name: string | null;
  emergency_contact_2_phone: string | null;
  emergency_contact_2_relationship: string | null;
  home_notes: string | null;
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
  name: string;
  severity: "critical" | "mild" | "minor";
  notes: string | null;
};

type Document = {
  id: string;
  category: "emergency" | "wifi" | "instructions" | "general";
  title: string;
  description: string | null;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

export default async function HomeInfoPage({
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
    .single<{ role: "admin" | "client" | "caregiver" | "family" }>();

  if (!profile || (profile.role === "caregiver" || profile.role === "family")) redirect("/me");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(
      "id, full_name, organization_id, wifi_ssid, wifi_password, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relationship, emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relationship, home_notes, preferred_hospital_name, preferred_hospital_address, preferred_hospital_phone, primary_physician_name, primary_physician_address, primary_physician_phone, has_panic_button, panic_button_location, has_medical_alert, medical_alert_location, first_aid_location, hypoglycemia_kit_location, fire_extinguisher_location, aed_location"
    )
    .eq("id", id)
    .single<ClientHomeInfo>();

  if (clientError) {
    return (
      <main className="px-5 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center">
          <h1 className="font-display text-2xl mb-2">Couldn't load home info</h1>
          <p className="text-ink-500 text-sm mb-2">{clientError.message}</p>
          <p className="text-xs text-ink-500 mb-5">
            If a column is missing, run the latest migration in Supabase SQL
            Editor.
          </p>
          <Link
            href="/clients"
            className="inline-block bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl text-sm font-medium transition"
          >
            Back to clients
          </Link>
        </div>
      </main>
    );
  }

  if (!client) notFound();

  // Fetch allergies (silent fail if Batch C SQL not run)
  let allergies: Allergy[] = [];
  try {
    const { data } = await supabase
      .from("client_allergies")
      .select("id, name, severity, notes")
      .eq("client_id", client.id)
      .order("severity", { ascending: true })
      .order("name", { ascending: true });
    allergies = (data ?? []) as Allergy[];
  } catch {
    allergies = [];
  }

  // Fetch documents (silent fail)
  let documents: Document[] = [];
  try {
    const { data } = await supabase
      .from("client_documents")
      .select(
        "id, category, title, description, storage_path, mime_type, file_size_bytes, created_at"
      )
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    documents = (data ?? []) as Document[];
  } catch {
    documents = [];
  }

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/clients"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back to clients
        </Link>
        <h1 className="font-display text-3xl text-ink-900">
          {client.full_name}
        </h1>
        <p className="text-ink-500 text-sm">
          Home info for caregivers
        </p>
      </header>

      <HomeInfoEditor
        client={client}
        allergies={allergies}
        documents={documents}
        canEditWifi={profile.role === "admin"}
      />
    </main>
  );
}
