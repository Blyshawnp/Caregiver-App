"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

const DOC_CATEGORIES: { value: Document["category"]; label: string }[] = [
  { value: "emergency", label: "Emergency" },
  { value: "instructions", label: "Instructions" },
  { value: "wifi", label: "Wi-Fi / utilities" },
  { value: "general", label: "General" },
];

export default function HomeInfoEditor({
  client,
  allergies: initialAllergies,
  documents: initialDocs,
  canEditWifi,
}: {
  client: ClientHomeInfo;
  allergies: Allergy[];
  documents: Document[];
  canEditWifi: boolean;
}) {
  const router = useRouter();

  // Wifi
  const [wifiSsid, setWifiSsid] = useState(client.wifi_ssid ?? "");
  const [wifiPassword, setWifiPassword] = useState(client.wifi_password ?? "");
  const [showWifi, setShowWifi] = useState(false);

  // Emergency contacts
  const [ec1Name, setEc1Name] = useState(client.emergency_contact_1_name ?? "");
  const [ec1Phone, setEc1Phone] = useState(client.emergency_contact_1_phone ?? "");
  const [ec1Rel, setEc1Rel] = useState(client.emergency_contact_1_relationship ?? "");
  const [ec2Name, setEc2Name] = useState(client.emergency_contact_2_name ?? "");
  const [ec2Phone, setEc2Phone] = useState(client.emergency_contact_2_phone ?? "");
  const [ec2Rel, setEc2Rel] = useState(client.emergency_contact_2_relationship ?? "");

  // Hospital
  const [hospName, setHospName] = useState(client.preferred_hospital_name ?? "");
  const [hospAddr, setHospAddr] = useState(client.preferred_hospital_address ?? "");
  const [hospPhone, setHospPhone] = useState(client.preferred_hospital_phone ?? "");

  // Physician
  const [physName, setPhysName] = useState(client.primary_physician_name ?? "");
  const [physAddr, setPhysAddr] = useState(client.primary_physician_address ?? "");
  const [physPhone, setPhysPhone] = useState(client.primary_physician_phone ?? "");

  // Devices
  const [hasPanic, setHasPanic] = useState(client.has_panic_button ?? false);
  const [panicLoc, setPanicLoc] = useState(client.panic_button_location ?? "");
  const [hasMedical, setHasMedical] = useState(client.has_medical_alert ?? false);
  const [medicalLoc, setMedicalLoc] = useState(client.medical_alert_location ?? "");
  const [firstAidLoc, setFirstAidLoc] = useState(client.first_aid_location ?? "");
  const [hypoLoc, setHypoLoc] = useState(client.hypoglycemia_kit_location ?? "");
  const [fireLoc, setFireLoc] = useState(client.fire_extinguisher_location ?? "");
  const [aedLoc, setAedLoc] = useState(client.aed_location ?? "");

  // Notes
  const [notes, setNotes] = useState(client.home_notes ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const update: Record<string, string | number | boolean | null> = {
      emergency_contact_1_name: ec1Name.trim() || null,
      emergency_contact_1_phone: ec1Phone.trim() || null,
      emergency_contact_1_relationship: ec1Rel.trim() || null,
      emergency_contact_2_name: ec2Name.trim() || null,
      emergency_contact_2_phone: ec2Phone.trim() || null,
      emergency_contact_2_relationship: ec2Rel.trim() || null,
      home_notes: notes.trim() || null,
      preferred_hospital_name: hospName.trim() || null,
      preferred_hospital_address: hospAddr.trim() || null,
      preferred_hospital_phone: hospPhone.trim() || null,
      primary_physician_name: physName.trim() || null,
      primary_physician_address: physAddr.trim() || null,
      primary_physician_phone: physPhone.trim() || null,
      has_panic_button: hasPanic,
      panic_button_location: hasPanic ? panicLoc.trim() || null : null,
      has_medical_alert: hasMedical,
      medical_alert_location: hasMedical ? medicalLoc.trim() || null : null,
      first_aid_location: firstAidLoc.trim() || null,
      hypoglycemia_kit_location: hypoLoc.trim() || null,
      fire_extinguisher_location: fireLoc.trim() || null,
      aed_location: aedLoc.trim() || null,
    };

    if (canEditWifi) {
      update.wifi_ssid = wifiSsid.trim() || null;
      update.wifi_password = wifiPassword.trim() || null;
    }

    const { error: updateError } = await supabase
      .from("clients")
      .update(update)
      .eq("id", client.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Card title="Emergency contact">
        <Field label="Name" value={ec1Name} onChange={setEc1Name} placeholder="Sarah Smith" />
        <Field label="Phone" type="tel" value={ec1Phone} onChange={setEc1Phone} placeholder="555-123-4567" />
        <Field label="Relationship" value={ec1Rel} onChange={setEc1Rel} placeholder="Daughter" />
      </Card>

      <Card title="Emergency contact 2 (optional)">
        <Field label="Name" value={ec2Name} onChange={setEc2Name} placeholder="John Smith" />
        <Field label="Phone" type="tel" value={ec2Phone} onChange={setEc2Phone} placeholder="555-987-6543" />
        <Field label="Relationship" value={ec2Rel} onChange={setEc2Rel} placeholder="Son" />
      </Card>

      <Card title="Allergies" subtitle="Add what caregivers should know about. Tag each by severity.">
        <AllergyManager
          clientId={client.id}
          organizationId={client.organization_id}
          initialAllergies={initialAllergies}
          onChanged={() => router.refresh()}
        />
      </Card>

      <Card title="Preferred hospital">
        <Field label="Name" value={hospName} onChange={setHospName} placeholder="St. Luke's Hospital" />
        <Field label="Address" value={hospAddr} onChange={setHospAddr} placeholder="801 Ostrum St, Bethlehem, PA" />
        <Field label="Phone" type="tel" value={hospPhone} onChange={setHospPhone} placeholder="610-555-1234" />
      </Card>

      <Card title="Primary physician">
        <Field label="Name" value={physName} onChange={setPhysName} placeholder="Dr. Patel" />
        <Field label="Address" value={physAddr} onChange={setPhysAddr} placeholder="100 Main St, Allentown, PA" />
        <Field label="Phone" type="tel" value={physPhone} onChange={setPhysPhone} placeholder="610-555-5678" />
      </Card>

      <Card title="Emergency devices & locations" subtitle="Where to find safety items in the home. Caregivers see these on every shift.">
        <Toggle
          label="Has panic button"
          checked={hasPanic}
          onChange={setHasPanic}
        />
        {hasPanic && (
          <Field
            label="Panic button location"
            value={panicLoc}
            onChange={setPanicLoc}
            placeholder="On the bedside table"
          />
        )}

        <Toggle
          label="Has medical alert button (e.g. Life Alert)"
          checked={hasMedical}
          onChange={setHasMedical}
        />
        {hasMedical && (
          <Field
            label="Medical alert location"
            value={medicalLoc}
            onChange={setMedicalLoc}
            placeholder="Worn around neck"
          />
        )}

        <Field
          label="First aid kit location"
          value={firstAidLoc}
          onChange={setFirstAidLoc}
          placeholder="Bathroom cabinet, top shelf"
        />
        <Field
          label="Hypoglycemia kit / glucagon location"
          value={hypoLoc}
          onChange={setHypoLoc}
          placeholder="Kitchen drawer next to fridge"
        />
        <Field
          label="Fire extinguisher location"
          value={fireLoc}
          onChange={setFireLoc}
          placeholder="Under the kitchen sink"
        />
        <Field
          label="AED location"
          value={aedLoc}
          onChange={setAedLoc}
          placeholder="Hallway closet"
        />
      </Card>

      <Card title="Wi-Fi" subtitle={canEditWifi ? undefined : "Only admins can edit Wi-Fi credentials."}>
        {canEditWifi ? (
          <>
            <Field label="Network name (SSID)" value={wifiSsid} onChange={setWifiSsid} placeholder="HomeNetwork" />
            <div>
              <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
                Password
              </span>
              <div className="flex gap-2">
                <input
                  type={showWifi ? "text" : "password"}
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowWifi((v) => !v)}
                  className="text-xs text-forest-600 hover:underline px-2"
                >
                  {showWifi ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <ReadOnly label="Network" value={client.wifi_ssid || "Not set"} />
            <ReadOnly label="Password" value={client.wifi_password ? "•".repeat(8) : "Not set"} />
          </>
        )}
      </Card>

      <Card title="Documents" subtitle="Upload PDFs or images for emergencies, instructions, wifi setup, etc.">
        <DocumentManager
          clientId={client.id}
          organizationId={client.organization_id}
          initialDocs={initialDocs}
          onChanged={() => router.refresh()}
        />
      </Card>

      <Card title="Notes for caregivers (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Anything caregivers should know — alarm code, parking, pet info..."
          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm resize-none"
        />
      </Card>

      {error && (
        <div className="bg-terracotta-400/10 border border-terracotta-400/30 text-terracotta-600 rounded-xl px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 sticky bottom-3 bg-cream-100/95 backdrop-blur p-3 rounded-2xl shadow-soft border border-cream-200">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl font-medium transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        {savedAt && (
          <p className="text-xs text-forest-600">
            Saved {savedAt.toLocaleTimeString()}
          </p>
        )}
      </div>
    </form>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
      <div className="relative">
        <h2 className="font-display text-base mb-1">{title}</h2>
        {subtitle && <p className="text-xs text-ink-500 mb-3">{subtitle}</p>}
        <div className="space-y-3 mt-3">{children}</div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
      <span className="text-sm text-ink-900">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition ${
          checked ? "bg-forest-600" : "bg-cream-200"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-soft transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-cream-200 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-ink-500">{label}</span>
      <span className="text-sm text-ink-900">{value}</span>
    </div>
  );
}

/* -------------------- ALLERGIES MANAGER -------------------- */

function AllergyManager({
  clientId,
  organizationId,
  initialAllergies,
  onChanged,
}: {
  clientId: string;
  organizationId: string;
  initialAllergies: Allergy[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState<Allergy["severity"]>("mild");
  const [allergyNotes, setAllergyNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("client_allergies").insert({
      client_id: clientId,
      organization_id: organizationId,
      name: name.trim(),
      severity,
      notes: allergyNotes.trim() || null,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setName("");
    setAllergyNotes("");
    setSeverity("mild");
    setAdding(false);
    onChanged();
  }

  async function remove(id: string) {
    if (!confirm("Remove this allergy?")) return;
    const supabase = createClient();
    await supabase.from("client_allergies").delete().eq("id", id);
    onChanged();
  }

  const groups: Allergy["severity"][] = ["critical", "mild", "minor"];
  const severityStyles: Record<Allergy["severity"], string> = {
    critical: "bg-terracotta-500/10 text-terracotta-700 border-terracotta-500/40",
    mild: "bg-yellow-50 text-yellow-800 border-yellow-300/50",
    minor: "bg-cream-50 text-ink-700 border-cream-200",
  };

  return (
    <div className="space-y-3">
      {initialAllergies.length === 0 ? (
        <p className="text-sm text-ink-500">No allergies added.</p>
      ) : (
        groups.map((sev) => {
          const items = initialAllergies.filter((a) => a.severity === sev);
          if (items.length === 0) return null;
          return (
            <div key={sev}>
              <p className="text-[10px] uppercase tracking-wider text-ink-500 mb-1.5 font-medium">
                {sev}
              </p>
              <ul className="space-y-1.5">
                {items.map((a) => (
                  <li
                    key={a.id}
                    className={`flex items-baseline justify-between gap-3 px-3 py-2 rounded-xl border ${severityStyles[a.severity]}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.name}</p>
                      {a.notes && (
                        <p className="text-xs opacity-80">{a.notes}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="text-xs hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}

      {adding ? (
        <div className="space-y-2 p-3 rounded-xl bg-cream-50 border border-cream-200">
          <Field label="Name" value={name} onChange={setName} placeholder="Penicillin" />
          <label className="block">
            <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
              Severity
            </span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Allergy["severity"])}
              className="w-full px-3 py-2 bg-white border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
            >
              <option value="critical">Critical (anaphylaxis risk)</option>
              <option value="mild">Mild</option>
              <option value="minor">Minor</option>
            </select>
          </label>
          <Field
            label="Notes (optional)"
            value={allergyNotes}
            onChange={setAllergyNotes}
            placeholder="Carries EpiPen in handbag"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setName("");
                setAllergyNotes("");
                setSeverity("mild");
              }}
              disabled={busy}
              className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={add}
              disabled={busy}
              className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              {busy ? "Adding..." : "Add allergy"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full bg-cream-50 hover:bg-cream-100 text-forest-600 border border-forest-500/30 py-2.5 rounded-xl text-sm font-medium transition"
        >
          + Add allergy
        </button>
      )}
    </div>
  );
}

/* -------------------- DOCUMENT MANAGER -------------------- */

function DocumentManager({
  clientId,
  organizationId,
  initialDocs,
  onChanged,
}: {
  clientId: string;
  organizationId: string;
  initialDocs: Document[];
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (10 MB max)");
      return;
    }

    setError(null);
    setUploading(true);

    const supabase = createClient();
    // Default to "general" for now; user can change per-doc after upload
    const category: Document["category"] = "general";
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const stamp = Date.now();
    const safeName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 60);
    const path = `${organizationId}/${clientId}/${stamp}-${safeName}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("client-documents")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("client_documents").insert({
      client_id: clientId,
      organization_id: organizationId,
      category,
      title: file.name,
      storage_path: path,
      mime_type: file.type,
      file_size_bytes: file.size,
    });

    if (dbError) {
      // Clean up uploaded file if metadata insert fails
      void supabase.storage.from("client-documents").remove([path]);
      setError(dbError.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    e.target.value = ""; // reset input so same file can be re-uploaded if needed
    onChanged();
  }

  async function changeCategory(id: string, category: Document["category"]) {
    const supabase = createClient();
    await supabase.from("client_documents").update({ category }).eq("id", id);
    onChanged();
  }

  async function downloadDoc(doc: Document) {
    const supabase = createClient();
    const { data, error: dlError } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(doc.storage_path, 60 * 5);
    if (dlError || !data?.signedUrl) {
      alert(dlError?.message ?? "Couldn't download");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function removeDoc(doc: Document) {
    if (!confirm(`Remove "${doc.title}"?`)) return;
    const supabase = createClient();
    await supabase.storage.from("client-documents").remove([doc.storage_path]);
    await supabase.from("client_documents").delete().eq("id", doc.id);
    onChanged();
  }

  const grouped = DOC_CATEGORIES.map((cat) => ({
    category: cat,
    docs: initialDocs.filter((d) => d.category === cat.value),
  }));

  return (
    <div className="space-y-3">
      {initialDocs.length === 0 ? (
        <p className="text-sm text-ink-500">No documents uploaded yet.</p>
      ) : (
        grouped.map(
          (g) =>
            g.docs.length > 0 && (
              <div key={g.category.value}>
                <p className="text-[10px] uppercase tracking-wider text-ink-500 mb-1.5 font-medium">
                  {g.category.label}
                </p>
                <ul className="space-y-1.5">
                  {g.docs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cream-50 border border-cream-200"
                    >
                      <button
                        type="button"
                        onClick={() => downloadDoc(d)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-sm font-medium text-ink-900 truncate">
                          {d.title}
                        </p>
                        <p className="text-xs text-ink-500">
                          {d.file_size_bytes
                            ? formatBytes(d.file_size_bytes)
                            : ""}
                          {d.mime_type ? ` · ${d.mime_type}` : ""}
                        </p>
                      </button>
                      <select
                        value={d.category}
                        onChange={(e) =>
                          changeCategory(
                            d.id,
                            e.target.value as Document["category"]
                          )
                        }
                        className="text-xs bg-white border border-cream-200 rounded px-1.5 py-1"
                      >
                        {DOC_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeDoc(d)}
                        className="text-xs text-terracotta-600 hover:underline shrink-0"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
        )
      )}

      <label className="block">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={upload}
          disabled={uploading}
          className="hidden"
        />
        <span
          className={`block w-full text-center bg-cream-50 hover:bg-cream-100 text-forest-600 border border-forest-500/30 py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
            uploading ? "opacity-50" : ""
          }`}
        >
          {uploading ? "Uploading..." : "+ Upload PDF or image"}
        </span>
      </label>
      <p className="text-[11px] text-ink-500 leading-snug">
        After uploading, set the category (Emergency, Instructions, Wi-Fi,
        General) using the dropdown next to the file. Max 10 MB. PDFs and
        images only.
      </p>
      {error && (
        <p className="text-terracotta-600 text-xs">{error}</p>
      )}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
