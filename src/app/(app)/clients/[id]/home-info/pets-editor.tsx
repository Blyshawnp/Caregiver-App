"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Pet = {
  id?: string;
  name: string;
  pet_type: string;
  sex: "Male" | "Female" | "Unknown" | null;
  spayed_neutered: "Yes" | "No" | "Unknown" | null;
  photo_url: string | null;
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

export default function PetsEditor({
  clientId,
  initialPets,
  orgId,
}: {
  clientId: string;
  initialPets: Pet[];
  orgId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pets, setPets] = useState<Pet[]>(initialPets.length > 0 ? initialPets : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Unsaved changes warning prompt
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

  function addPet() {
    const newPet: Pet = {
      name: "",
      pet_type: "Dog",
      sex: "Unknown",
      spayed_neutered: "Unknown",
      photo_url: null,
      feeding_instructions: "",
      medication_instructions: "",
      behavior_notes: "",
      emergency_notes: "",
      supplies_location: "",
      vet_name: "",
      vet_phone: "",
      emergency_vet_phone: "",
      microchip_number: "",
      vaccine_info: "",
      show_to_caregivers: true,
    };
    setPets([...pets, newPet]);
    setIsDirty(true);
  }

  function removePet(idx: number) {
    const updated = [...pets];
    updated.splice(idx, 1);
    setPets(updated);
    setIsDirty(true);
  }

  function updatePetField(idx: number, field: keyof Pet, val: any) {
    const updated = [...pets];
    updated[idx] = { ...updated[idx], [field]: val };
    setPets(updated);
    setIsDirty(true);
  }

  async function handlePhotoUpload(idx: number, file: File | null) {
    if (!file) return;
    setUploadingIdx(idx);
    setError(null);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${orgId}/pets/${crypto.randomUUID()}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(path, file);

      if (uploadError || !data) {
        throw new Error(uploadError?.message ?? "Photo upload failed.");
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(data.path, 315360000);

      if (signedError || !signedData?.signedUrl) {
        throw new Error(signedError?.message ?? "Failed to generate signed URL.");
      }

      updatePetField(idx, "photo_url", signedData.signedUrl);
    } catch (err: any) {
      setError(err.message ?? "Failed to upload photo.");
    } finally {
      setUploadingIdx(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validate pets list before POST
    for (const pet of pets) {
      if (!pet.name.trim()) {
        setError("All pets must have a name.");
        setSaving(false);
        return;
      }
      const isDogOrCat = pet.pet_type === "Dog" || pet.pet_type === "Cat";
      if (isDogOrCat) {
        if (!pet.sex) {
          setError(`Sex is required for dog/cat: ${pet.name}.`);
          setSaving(false);
          return;
        }
        if (!pet.spayed_neutered) {
          setError(`Spayed/neutered status is required for dog/cat: ${pet.name}.`);
          setSaving(false);
          return;
        }
      }
    }

    const res = await fetch(`/api/clients/${clientId}/pets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pets }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => null);
      setError(result?.error ?? "Failed to save pet details.");
      setSaving(false);
      return;
    }

    setIsDirty(false);
    setSaving(false);
    startTransition(() => {
      router.refresh();
    });
  }

  const petTypes = ["Dog", "Cat", "Bird", "Fish", "Reptile", "Small mammal", "Rabbit", "Ferret", "Horse", "Farm animal", "Other"];
  const sexOptions = ["Male", "Female", "Unknown"];
  const spayedOptions = ["Yes", "No", "Unknown"];

  return (
    <form onSubmit={save} className="space-y-4">
      {/* Dirty unsaved alert */}
      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3.5 rounded-2xl flex justify-between items-center no-print">
          <span className="font-semibold">⚠️ You have unsaved changes in pet records.</span>
          <button
            type="submit"
            disabled={saving}
            className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-3 py-1 rounded-lg font-medium transition"
          >
            {saving ? "Saving..." : "Save Now"}
          </button>
        </div>
      )}

      {pets.map((pet, idx) => {
        const isDogOrCat = pet.pet_type === "Dog" || pet.pet_type === "Cat";
        return (
          <section
            key={idx}
            className="bg-white rounded-3xl shadow-soft p-5 border border-cream-200/50 grain-overlay relative"
          >
            {/* Remove pet button */}
            <button
              type="button"
              onClick={() => removePet(idx)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-cream-100 hover:bg-red-50 text-ink-500 hover:text-red-700 transition flex items-center justify-center font-bold text-xs"
              title="Remove pet"
            >
              ✕
            </button>

            <div className="relative space-y-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink-900 mb-2">
                Pet #{idx + 1}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Pet Name</label>
                  <input
                    type="text"
                    value={pet.name}
                    onChange={(e) => updatePetField(idx, "name", e.target.value)}
                    placeholder="e.g. Max, Bella"
                    className={inputCls}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Pet Type</label>
                  <select
                    value={pet.pet_type}
                    onChange={(e) => updatePetField(idx, "pet_type", e.target.value)}
                    className={inputCls}
                  >
                    {petTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sex & Neutered for Dog/Cat (Required) or Other (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
                    Sex {isDogOrCat && <span className="text-terracotta-700 font-bold">*</span>}
                  </label>
                  <select
                    value={pet.sex || "Unknown"}
                    onChange={(e) => updatePetField(idx, "sex", e.target.value)}
                    className={inputCls}
                    required={isDogOrCat}
                  >
                    {sexOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
                    Spayed / Neutered {isDogOrCat && <span className="text-terracotta-700 font-bold">*</span>}
                  </label>
                  <select
                    value={pet.spayed_neutered || "Unknown"}
                    onChange={(e) => updatePetField(idx, "spayed_neutered", e.target.value)}
                    className={inputCls}
                    required={isDogOrCat}
                  >
                    {spayedOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Photo upload */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Pet Photo</label>
                {pet.photo_url && (
                  <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-cream-200 shadow-sm mb-2 bg-cream-50">
                    <img
                      src={pet.photo_url}
                      alt={pet.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => updatePetField(idx, "photo_url", null)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(idx, e.target.files?.[0] ?? null)}
                  disabled={uploadingIdx === idx}
                  className="w-full text-xs text-ink-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-semibold file:bg-forest-50 file:text-forest-700 hover:file:bg-forest-100 cursor-pointer"
                />
                {uploadingIdx === idx && <p className="text-[10px] text-forest-700 mt-1">Uploading image...</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Feeding Instructions</label>
                  <textarea
                    value={pet.feeding_instructions || ""}
                    onChange={(e) => updatePetField(idx, "feeding_instructions", e.target.value)}
                    placeholder="e.g. 1 cup kibble at 8 AM and 5 PM."
                    className={inputCls}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Medication Instructions</label>
                  <textarea
                    value={pet.medication_instructions || ""}
                    onChange={(e) => updatePetField(idx, "medication_instructions", e.target.value)}
                    placeholder="e.g. 1 pill in peanut butter once daily."
                    className={inputCls}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Behavior Notes</label>
                  <textarea
                    value={pet.behavior_notes || ""}
                    onChange={(e) => updatePetField(idx, "behavior_notes", e.target.value)}
                    placeholder="e.g. Friendly, scares easily around vacuum cleaners."
                    className={inputCls}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Emergency Notes</label>
                  <textarea
                    value={pet.emergency_notes || ""}
                    onChange={(e) => updatePetField(idx, "emergency_notes", e.target.value)}
                    placeholder="e.g. Cage in emergency, leash location in laundry closet."
                    className={inputCls}
                    rows={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-cream-100 pt-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Location of supplies</label>
                  <input
                    type="text"
                    value={pet.supplies_location || ""}
                    onChange={(e) => updatePetField(idx, "supplies_location", e.target.value)}
                    placeholder="e.g. Kitchen pantry"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Vet Name</label>
                  <input
                    type="text"
                    value={pet.vet_name || ""}
                    onChange={(e) => updatePetField(idx, "vet_name", e.target.value)}
                    placeholder="e.g. Dr. Adams"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Vet Phone</label>
                  <input
                    type="tel"
                    value={pet.vet_phone || ""}
                    onChange={(e) => updatePetField(idx, "vet_phone", e.target.value)}
                    placeholder="555-444-3333"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Emergency Vet Phone</label>
                  <input
                    type="tel"
                    value={pet.emergency_vet_phone || ""}
                    onChange={(e) => updatePetField(idx, "emergency_vet_phone", e.target.value)}
                    placeholder="555-999-8888"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Microchip Number (Optional)</label>
                  <input
                    type="text"
                    value={pet.microchip_number || ""}
                    onChange={(e) => updatePetField(idx, "microchip_number", e.target.value)}
                    placeholder="e.g. 981022459"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Rabies / Vaccine Info (Optional)</label>
                  <input
                    type="text"
                    value={pet.vaccine_info || ""}
                    onChange={(e) => updatePetField(idx, "vaccine_info", e.target.value)}
                    placeholder="e.g. Rabies valid until Nov 2027"
                    className={inputCls}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink-500 pt-3 border-t border-cream-100">
                <input
                  type="checkbox"
                  checked={pet.show_to_caregivers}
                  onChange={(e) => updatePetField(idx, "show_to_caregivers", e.target.checked)}
                  className="w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
                />
                <span>Show Pet Records to Caregivers on shift</span>
              </label>
            </div>
          </section>
        );
      })}

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={addPet}
          className="w-full text-center bg-cream-50 hover:bg-cream-100 text-forest-600 border border-forest-500/30 py-3 rounded-2xl text-sm font-medium transition"
        >
          + Add Pet
        </button>

        {pets.length > 0 && (
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-medium transition disabled:opacity-60"
          >
            {saving ? "Saving Pet records..." : "Save Pet Records"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-terracotta-600 font-medium text-center">{error}</p>}
    </form>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-2xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition text-sm";
