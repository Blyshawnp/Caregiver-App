"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type GuideData = {
  enabled: boolean;
  visible_to_caregivers: boolean;
  visible_to_family: boolean;
  requires_acknowledgment: boolean;
  medical_emergency_plan: string | null;
  fall_plan: string | null;
  fire_evacuation_plan: string | null;
  severe_weather_plan: string | null;
  power_outage_plan: string | null;
  pet_evacuation_plan: string | null;
  supplies_location: string | null;
  backup_contact_instructions: string | null;
  mobility_equipment: string | null;
  oxygen_fire_risk: string | null;
  access_notes: string | null;
  hospital_preference: string | null;
  other_instructions: string | null;
};

type ClientType = {
  preferred_hospital_name: string | null;
  preferred_hospital_address: string | null;
  preferred_hospital_phone: string | null;
};

export default function EmergencyGuideEditor({
  clientId,
  initialGuide,
  client,
}: {
  clientId: string;
  initialGuide: GuideData | null;
  client: ClientType;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialGuide?.enabled ?? false);
  const [visCaregivers, setVisCaregivers] = useState(initialGuide?.visible_to_caregivers ?? true);
  const [visFamily, setVisFamily] = useState(initialGuide?.visible_to_family ?? true);
  const [reqAck, setReqAck] = useState(initialGuide?.requires_acknowledgment ?? false);

  const [medical, setMedical] = useState(initialGuide?.medical_emergency_plan ?? "");
  const [fall, setFall] = useState(initialGuide?.fall_plan ?? "");
  const [fire, setFire] = useState(initialGuide?.fire_evacuation_plan ?? "");
  const [weather, setWeather] = useState(initialGuide?.severe_weather_plan ?? "");
  const [power, setPower] = useState(initialGuide?.power_outage_plan ?? "");
  const [pet, setPet] = useState(initialGuide?.pet_evacuation_plan ?? "");
  const [supplies, setSupplies] = useState(initialGuide?.supplies_location ?? "");
  const [backup, setBackup] = useState(initialGuide?.backup_contact_instructions ?? "");
  const [mobility, setMobility] = useState(initialGuide?.mobility_equipment ?? "");
  const [oxygen, setOxygen] = useState(initialGuide?.oxygen_fire_risk ?? "");
  const [access, setAccess] = useState(initialGuide?.access_notes ?? "");
  const [hospital, setHospital] = useState(initialGuide?.hospital_preference ?? "");
  const [other, setOther] = useState(initialGuide?.other_instructions ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Unsaved changes prompt
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Track edits
  function handleFieldChange(setter: (val: string) => void, val: string) {
    setter(val);
    setIsDirty(true);
  }

  function handleCheckboxChange(setter: (val: boolean) => void, val: boolean) {
    setter(val);
    setIsDirty(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/clients/${clientId}/emergency-guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        visible_to_caregivers: visCaregivers,
        visible_to_family: visFamily,
        requires_acknowledgment: reqAck,
        medical_emergency_plan: medical,
        fall_plan: fall,
        fire_evacuation_plan: fire,
        severe_weather_plan: weather,
        power_outage_plan: power,
        pet_evacuation_plan: pet,
        supplies_location: supplies,
        backup_contact_instructions: backup,
        mobility_equipment: mobility,
        oxygen_fire_risk: oxygen,
        access_notes: access,
        hospital_preference: hospital,
        other_instructions: other,
      }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => null);
      setError(result?.error ?? "Failed to save emergency guide.");
      setSaving(false);
      return;
    }

    setIsDirty(false);
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Unsaved changes warning bar */}
      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3.5 rounded-2xl flex justify-between items-center no-print">
          <span className="font-semibold">⚠️ You have unsaved changes.</span>
          <button
            type="submit"
            disabled={saving}
            className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-3 py-1 rounded-lg font-medium transition"
          >
            {saving ? "Saving..." : "Save Now"}
          </button>
        </div>
      )}

      {/* Guide Settings */}
      <section className="bg-white rounded-3xl shadow-soft p-5 border border-cream-200/50 grain-overlay">
        <div className="relative space-y-4">
          <h2 className="font-display text-base font-bold text-ink-900 mb-2">Emergency Guide Settings</h2>

          <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-ink-800">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleCheckboxChange(setEnabled, e.target.checked)}
              className="w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
            />
            <span>Enable Emergency Preparedness Guide for this client</span>
          </label>

          {enabled && (
            <div className="pl-6 space-y-3 pt-2 border-t border-cream-100">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-ink-700">
                <input
                  type="checkbox"
                  checked={visCaregivers}
                  onChange={(e) => handleCheckboxChange(setVisCaregivers, e.target.checked)}
                  className="w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
                />
                <span>Visible to Caregivers</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-ink-700">
                <input
                  type="checkbox"
                  checked={visFamily}
                  onChange={(e) => handleCheckboxChange(setVisFamily, e.target.checked)}
                  className="w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
                />
                <span>Visible to Family Users</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-ink-700">
                <input
                  type="checkbox"
                  checked={reqAck}
                  onChange={(e) => handleCheckboxChange(setReqAck, e.target.checked)}
                  className="w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
                />
                <span>Requires read acknowledgment from assigned caregivers</span>
              </label>
            </div>
          )}
        </div>
      </section>

      {/* Guide Plans */}
      {enabled && (
        <section className="bg-white rounded-3xl shadow-soft p-5 border border-cream-200/50 grain-overlay space-y-4">
          <div className="relative space-y-4">
            <h2 className="font-display text-base font-bold text-ink-900 mb-2">Preparedness Action Plans</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Medical Emergency Plan</label>
                <textarea
                  value={medical}
                  onChange={(e) => handleFieldChange(setMedical, e.target.value)}
                  placeholder="e.g. Call 911, retrieve DNR from binder, retrieve hypoglycemia kit."
                  className={inputCls}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Fall Plan</label>
                <textarea
                  value={fall}
                  onChange={(e) => handleFieldChange(setFall, e.target.value)}
                  placeholder="e.g. Check for pain, do not lift immediately if injured, call for assist."
                  className={inputCls}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Fire Evacuation Plan</label>
                <textarea
                  value={fire}
                  onChange={(e) => handleFieldChange(setFire, e.target.value)}
                  placeholder="e.g. Roll wheelchair to front exit, use rear sliding doors if front blocked."
                  className={inputCls}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Severe Weather Plan</label>
                <textarea
                  value={weather}
                  onChange={(e) => handleFieldChange(setWeather, e.target.value)}
                  placeholder="e.g. Move client away from windows to the interior hallway."
                  className={inputCls}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Power Outage Plan</label>
                <textarea
                  value={power}
                  onChange={(e) => handleFieldChange(setPower, e.target.value)}
                  placeholder="e.g. Connect backup battery to oxygen concentrator, candles in cabinet."
                  className={inputCls}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Pet Evacuation Plan</label>
                <textarea
                  value={pet}
                  onChange={(e) => handleFieldChange(setPet, e.target.value)}
                  placeholder="e.g. Place cat in carrier located in laundry closet, leash dog."
                  className={inputCls}
                  rows={3}
                />
              </div>
            </div>

            <div className="border-t border-cream-100 pt-4 space-y-4">
              <h3 className="font-display text-sm font-bold text-ink-800">Support Details & Equipment</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Emergency Supplies Location</label>
                  <input
                    type="text"
                    value={supplies}
                    onChange={(e) => handleFieldChange(setSupplies, e.target.value)}
                    placeholder="e.g. Pantry shelf, emergency flashlight in nightstand"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Backup Contact Instructions</label>
                  <input
                    type="text"
                    value={backup}
                    onChange={(e) => handleFieldChange(setBackup, e.target.value)}
                    placeholder="e.g. Call primary contact, if unreachable call Sarah"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Mobility Equipment Instructions</label>
                  <input
                    type="text"
                    value={mobility}
                    onChange={(e) => handleFieldChange(setMobility, e.target.value)}
                    placeholder="e.g. Walker required for all transfers, slide board in closet"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Oxygen / Fire Risk Notes</label>
                  <input
                    type="text"
                    value={oxygen}
                    onChange={(e) => handleFieldChange(setOxygen, e.target.value)}
                    placeholder="e.g. Oxygen in use. No smoking or open flames allowed."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Door / Lockbox / Access Notes (Emergency Only)</label>
                  <input
                    type="text"
                    value={access}
                    onChange={(e) => handleFieldChange(setAccess, e.target.value)}
                    placeholder="e.g. Lockbox code is 4321, key inside opens side kitchen door"
                    className={inputCls}
                  />
                  <p className="text-[10px] text-ink-500 mt-1">⚠️ Enter emergency-specific entry instructions here. For non-emergency/standard parking or entry notes, please add them in General Info.</p>
                </div>

                <div className="bg-cream-50 border border-cream-200 rounded-2xl p-4 text-xs space-y-1">
                  <span className="font-semibold block text-ink-500 uppercase tracking-wide text-[10px]">Preferred Hospital (Managed in General Info)</span>
                  {client.preferred_hospital_name ? (
                    <div>
                      <p className="text-ink-900 font-bold">{client.preferred_hospital_name}</p>
                      {client.preferred_hospital_address && <p className="text-ink-600">{client.preferred_hospital_address}</p>}
                      {client.preferred_hospital_phone && <p className="text-ink-600 font-mono">{client.preferred_hospital_phone}</p>}
                    </div>
                  ) : (
                    <p className="text-ink-400 italic">No preferred hospital configured under General & Home Info.</p>
                  )}
                  <Link href="?tab=info" className="text-forest-600 hover:underline font-semibold block mt-1.5">
                    ← Edit under General & Home Info
                  </Link>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Other Instructions</label>
                <textarea
                  value={other}
                  onChange={(e) => handleFieldChange(setOther, e.target.value)}
                  placeholder="Any additional emergency preparedness rules..."
                  className={inputCls}
                  rows={2}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-terracotta-600 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-medium transition disabled:opacity-60"
      >
        {saving ? "Saving changes..." : "Save Emergency Guide Settings"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-2xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition text-sm";
