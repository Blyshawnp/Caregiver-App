import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HomeInfoEditor from "./home-info-editor";
import EmergencyGuideEditor from "./emergency-guide-editor";
import PetsEditor from "./pets-editor";
import ClientChecklist from "./checklist";
import ClientPhotoUploader from "./client-photo-uploader";
import ClientPhoto from "@/components/client-photo";
import PetsList from "@/components/pets-list";
import { withClientPhotoDisplayUrl } from "@/lib/client-photos";
import { withPetPhotoDisplayUrls } from "@/lib/pet-photos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClientHomeInfo = {
  id: string;
  full_name: string;
  organization_id: string;
  photo_url: string | null;
  photo_display_url?: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number | null;
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
  signedUrl?: string | null;
};

type Pet = {
  id?: string;
  name: string;
  pet_type: string;
  sex: "Male" | "Female" | "Unknown" | null;
  spayed_neutered: "Yes" | "No" | "Unknown" | null;
  photo_url: string | null;
  photo_display_url?: string | null;
  feeding_instructions: string | null;
  medication_instructions: string | null;
  behavior_notes: string | null;
  emergency_notes: string | null;
  supplies_location: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  emergency_vet_phone: string | null;
  microchip_number: string | null;
  vaccine_info: string | null;
  show_to_caregivers: boolean;
};

export default async function HomeInfoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = (await searchParams) ?? {};
  const currentTab =
    tab === "edit" ? "edit" : tab === "guide" ? "guide" : tab === "pets" ? "pets" : "view";

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

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(
      "id, full_name, organization_id, photo_url, address, latitude, longitude, geofence_radius_meters, wifi_ssid, wifi_password, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relationship, emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relationship, home_notes, preferred_hospital_name, preferred_hospital_address, preferred_hospital_phone, primary_physician_name, primary_physician_address, primary_physician_phone, has_panic_button, panic_button_location, has_medical_alert, medical_alert_location, first_aid_location, hypoglycemia_kit_location, fire_extinguisher_location, aed_location"
    )
    .eq("id", id)
    .single<ClientHomeInfo>();

  if (clientError) {
    return (
      <main className="px-5 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center">
          <h1 className="font-display text-2xl mb-2">Couldn't load home info</h1>
          <p className="text-ink-500 text-sm mb-2">{clientError.message}</p>
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
  const clientWithPhoto = await withClientPhotoDisplayUrl(supabase, client);

  // 1. Fetch allergies
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

  // 2. Fetch documents
  let documents: Document[] = [];
  try {
    const { data } = await supabase
      .from("client_documents")
      .select(
        "id, category, title, description, storage_path, mime_type, file_size_bytes, created_at"
      )
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    documents = await Promise.all(
      ((data ?? []) as Document[]).map(async (doc) => {
        const { data: signed } = await supabase.storage
          .from("client-documents")
          .createSignedUrl(doc.storage_path, 60 * 5);
        return { ...doc, signedUrl: signed?.signedUrl ?? null };
      })
    );
  } catch {
    documents = [];
  }

  // 3. Fetch emergency preparedness guide
  const { data: guide } = await supabase
    .from("client_emergency_guides")
    .select("*")
    .eq("client_id", client.id)
    .maybeSingle();

  // 4. Fetch pet details
  const { data: petsData } = await supabase
    .from("client_pets")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: true });

  const pets = await withPetPhotoDisplayUrls(supabase, (petsData ?? []) as Pet[]);

  // Compute checklist metrics
  const isGeofenceSet = !!(client.address && client.latitude && client.longitude);
  const isContactsAdded = !!client.emergency_contact_1_name;
  const isPetsConfigured = pets.length > 0;
  const isGuideConfigured = !!(guide?.enabled);
  const isNotesAdded = !!client.home_notes;
  const isAllergiesConfigured = allergies.length > 0;

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-5">
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
          {canManage
            ? "View profile details, pets, documents, and emergency plans."
            : "Client details, pets, and emergency information."}
        </p>
      </header>

      {canManage && (
        <ClientChecklist
          isGeofenceSet={isGeofenceSet}
          isContactsAdded={isContactsAdded}
          isPetsConfigured={isPetsConfigured}
          isGuideConfigured={isGuideConfigured}
          isNotesAdded={isNotesAdded}
          isAllergiesConfigured={isAllergiesConfigured}
        />
      )}

      {/* Navigation tabs */}
      <div className="flex gap-1.5 p-1 bg-cream-50 rounded-2xl border border-cream-200/80 mb-5 text-center no-print">
        <Link
          href={`/clients/${client.id}/home-info`}
          className={`flex-1 text-xs py-2.5 rounded-xl font-medium transition ${
            currentTab === "view"
              ? "bg-white text-forest-700 shadow-sm"
              : "text-ink-500 hover:text-ink-900"
          }`}
        >
          View
        </Link>
        {canManage && (
          <Link
            href={`/clients/${client.id}/home-info?tab=edit`}
            className={`flex-1 text-xs py-2.5 rounded-xl font-medium transition ${
              currentTab === "edit"
                ? "bg-white text-forest-700 shadow-sm"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            Edit Info
          </Link>
        )}
        <Link
          href={`/clients/${client.id}/home-info?tab=guide`}
          className={`flex-1 text-xs py-2.5 rounded-xl font-medium transition ${
            currentTab === "guide"
              ? "bg-white text-forest-700 shadow-sm"
              : "text-ink-500 hover:text-ink-900"
          }`}
        >
          Emergency Guide
        </Link>
        <Link
          href={`/clients/${client.id}/home-info?tab=pets`}
          className={`flex-1 text-xs py-2.5 rounded-xl font-medium transition ${
            currentTab === "pets"
              ? "bg-white text-forest-700 shadow-sm"
              : "text-ink-500 hover:text-ink-900"
          }`}
        >
          Pet Records
        </Link>
      </div>

      {/* Tab content */}
      {(currentTab === "view" || (!canManage && currentTab === "edit")) && (
        <ClientProfileView
          client={clientWithPhoto}
          allergies={allergies}
          documents={documents}
          pets={pets}
          canManage={canManage}
          guideEnabled={!!guide?.enabled}
        />
      )}

      {canManage && currentTab === "edit" && (
        <HomeInfoEditor
          client={clientWithPhoto}
          allergies={allergies}
          documents={documents}
          canEditWifi={profile.role === "admin"}
        />
      )}

      {currentTab === "guide" && (
        canManage ? (
          <EmergencyGuideEditor clientId={client.id} initialGuide={guide} client={clientWithPhoto} />
        ) : (
          <ReadOnlyEmergencyGuide guide={guide} client={client} />
        )
      )}

      {currentTab === "pets" && (
        canManage ? (
          <PetsEditor clientId={client.id} initialPets={pets} orgId={profile.organization_id} />
        ) : (
          <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
            <PetsList pets={pets} readOnly={true} />
          </section>
        )
      )}
    </main>
  );
}

function ClientProfileView({
  client,
  allergies,
  documents,
  pets,
  canManage,
  guideEnabled,
}: {
  client: ClientHomeInfo;
  allergies: Allergy[];
  documents: Document[];
  pets: Pet[];
  canManage: boolean;
  guideEnabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-base text-ink-900">Basic info</h2>
            <p className="text-xs text-ink-500">Client profile and home summary</p>
          </div>
          {!canManage && (
            <ClientPhoto
              name={client.full_name}
              photoUrl={client.photo_display_url ?? client.photo_url}
              size="md"
            />
          )}
        </div>
        {canManage && (
          <div className="mb-4">
            <ClientPhotoUploader
              clientId={client.id}
              orgId={client.organization_id}
              clientName={client.full_name}
              currentPhotoUrl={client.photo_display_url ?? client.photo_url}
            />
          </div>
        )}
        <ReadOnly label="Address" value={client.address || "Location not set"} />
        <ReadOnly
          label="Geofence"
          value={
            client.latitude != null && client.longitude != null
              ? `${client.geofence_radius_meters ?? 150}m radius`
              : "Not set"
          }
        />
        <ReadOnly label="Preferred hospital" value={client.preferred_hospital_name || "Not set"} />
        <ReadOnly label="Primary physician" value={client.primary_physician_name || "Not set"} />
        {client.home_notes ? (
          <p className="text-sm text-ink-700 whitespace-pre-wrap mt-3">{client.home_notes}</p>
        ) : (
          <p className="text-sm text-ink-500 mt-3">No home notes listed.</p>
        )}
      </section>

      <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display text-base text-ink-900">Pets ({pets.length})</h2>
          <Link href={`/clients/${client.id}/home-info?tab=pets`} className="text-sm text-forest-600 font-medium hover:underline">
            View pets
          </Link>
        </div>
        {pets.length === 0 ? (
          <p className="text-sm text-ink-500">No pets listed</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pets.slice(0, 4).map((pet) => {
              const photoUrl = pet.photo_display_url ?? pet.photo_url;
              return (
                <Link
                  key={pet.id ?? pet.name}
                  href={`/clients/${client.id}/home-info?tab=pets`}
                  className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-cream-50/50 hover:bg-cream-100 p-3 transition"
                >
                  <span className="w-20 h-20 rounded-2xl bg-white overflow-hidden grid place-items-center text-lg font-semibold text-forest-700 shrink-0 border border-cream-200">
                    {photoUrl ? (
                      <img src={photoUrl} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <img src={petPresetForType(pet.pet_type)} alt={`${pet.name} preset avatar`} className="w-full h-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink-900 truncate">{pet.name}</span>
                    <span className="block text-xs text-ink-500 capitalize">{pet.pet_type || "Pet"}</span>
                    {(pet.medication_instructions || pet.emergency_notes || pet.behavior_notes) && (
                      <span className="block text-[10px] text-terracotta-600 mt-1">Medication, emergency, or caution notes</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <Link href={`/clients/${client.id}/home-info?tab=guide`} className="flex items-center justify-between bg-white hover:bg-cream-50 px-5 py-4 rounded-2xl shadow-soft transition">
          <span>
            <span className="block font-medium text-ink-900">Emergency guide</span>
            <span className="block text-xs text-ink-500">{guideEnabled ? "Preparedness instructions available" : "No emergency guide enabled"}</span>
          </span>
          <span className="text-ink-300">→</span>
        </Link>
        <Link href="/documents" className="flex items-center justify-between bg-white hover:bg-cream-50 px-5 py-4 rounded-2xl shadow-soft transition">
          <span>
            <span className="block font-medium text-ink-900">Documents ({documents.length})</span>
            <span className="block text-xs text-ink-500">Care documents and instructions</span>
          </span>
          <span className="text-ink-300">→</span>
        </Link>
        {canManage && (
          <Link href={`/clients/${client.id}/home-info?tab=edit`} className="flex items-center justify-between bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-4 rounded-2xl shadow-soft transition">
            <span className="font-medium">Edit client info</span>
            <span>→</span>
          </Link>
        )}
      </section>
    </div>
  );
}

function petPresetForType(type?: string | null) {
  const normalized = (type ?? "").toLowerCase();
  if (normalized.includes("cat")) return "/avatar-presets/cat.png";
  if (normalized.includes("dog")) return "/avatar-presets/dog.png";
  if (normalized.includes("bird")) return "/avatar-presets/paw.png";
  if (normalized.includes("fish")) return "/avatar-presets/fish.png";
  if (normalized.includes("reptile")) return "/avatar-presets/dinosaur.png";
  if (normalized.includes("rabbit") || normalized.includes("bunny")) return "/avatar-presets/paw.png";
  return "/avatar-presets/paw.png";
}

function ReadOnlyEmergencyGuide({
  guide,
  client,
}: {
  guide: any;
  client: ClientHomeInfo;
}) {
  if (!guide?.enabled) {
    return (
      <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
        <p className="text-sm text-ink-500">No emergency guide is enabled for this client.</p>
      </section>
    );
  }

  const items = [
    ["Medical emergency", guide.medical_emergency_plan],
    ["Fall plan", guide.fall_plan],
    ["Fire evacuation", guide.fire_evacuation_plan],
    ["Severe weather", guide.severe_weather_plan],
    ["Power outage", guide.power_outage_plan],
    ["Pet evacuation", guide.pet_evacuation_plan],
    ["Supplies", guide.supplies_location],
    ["Backup contact", guide.backup_contact_instructions],
    ["Mobility equipment", guide.mobility_equipment],
    ["Oxygen / fire risk", guide.oxygen_fire_risk],
    ["Emergency access", guide.access_notes],
    ["Other", guide.other_instructions],
  ].filter(([, value]) => typeof value === "string" && value.trim());

  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
      <h2 className="font-display text-base text-ink-900 mb-3">Emergency guide</h2>
      <ReadOnly label="Preferred hospital" value={client.preferred_hospital_name || guide.hospital_preference || "Not set"} />
      <div className="space-y-3 mt-3">
        {items.length === 0 ? (
          <p className="text-sm text-ink-500">No guide details listed.</p>
        ) : (
          items.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-cream-50 border border-cream-200 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
              <p className="text-sm text-ink-900 whitespace-pre-wrap">{value}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-cream-200 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-ink-500">{label}</span>
      <span className="text-sm text-ink-900 text-right">{value}</span>
    </div>
  );
}
