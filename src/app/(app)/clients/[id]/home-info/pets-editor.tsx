"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PetsList, { type Pet } from "@/components/pets-list";

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

  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: "add" | "edit";
    index: number | null;
    pet: Pet;
  }>({
    isOpen: false,
    mode: "add",
    index: null,
    pet: getEmptyPet(),
  });

  const [uploading, setUploading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  function getEmptyPet(): Pet {
    return {
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
  }

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

  function handleAddClick() {
    setModalError(null);
    setModalState({
      isOpen: true,
      mode: "add",
      index: null,
      pet: getEmptyPet(),
    });
  }

  function handleEditClick(pet: Pet, index: number) {
    setModalError(null);
    setModalState({
      isOpen: true,
      mode: "edit",
      index,
      pet: { ...pet },
    });
  }

  function handleRemoveClick(index: number) {
    const updated = [...pets];
    updated.splice(index, 1);
    setPets(updated);
    setIsDirty(true);
  }

  function updateModalPetField(field: keyof Pet, val: any) {
    setModalState((prev) => ({
      ...prev,
      pet: { ...prev.pet, [field]: val },
    }));
  }

  async function handlePhotoUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setModalError(null);

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

      updateModalPetField("photo_url", signedData.signedUrl);
    } catch (err: any) {
      setModalError(err.message ?? "Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  }

  function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);

    const { pet, mode, index } = modalState;

    if (!pet.name.trim()) {
      setModalError("Pet name is required.");
      return;
    }

    const isDogOrCat = pet.pet_type === "Dog" || pet.pet_type === "Cat";
    if (isDogOrCat) {
      if (!pet.sex) {
        setModalError(`Sex is required for ${pet.pet_type}s.`);
        return;
      }
      if (!pet.spayed_neutered) {
        setModalError(`Spayed/neutered status is required for ${pet.pet_type}s.`);
        return;
      }
    }

    const updatedPets = [...pets];
    if (mode === "add") {
      updatedPets.push(pet);
    } else if (mode === "edit" && index !== null) {
      updatedPets[index] = pet;
    }

    setPets(updatedPets);
    setIsDirty(true);
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }

  async function save() {
    setSaving(true);
    setError(null);

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

  const modalPet = modalState.pet;
  const isDogOrCat = modalPet.pet_type === "Dog" || modalPet.pet_type === "Cat";

  return (
    <div className="space-y-6">
      {/* Dirty unsaved alert */}
      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3.5 rounded-2xl flex justify-between items-center no-print">
          <span className="font-semibold">⚠️ You have unsaved changes in pet records.</span>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-1.5 rounded-xl font-medium transition active:scale-[0.98] shadow-sm shrink-0"
          >
            {saving ? "Saving..." : "Save Now"}
          </button>
        </div>
      )}

      {/* Reusable premium PetsList */}
      <PetsList
        pets={pets}
        readOnly={false}
        onAdd={handleAddClick}
        onEdit={handleEditClick}
        onRemove={handleRemoveClick}
      />

      {pets.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || !isDirty}
            className="w-full bg-forest-600 hover:bg-forest-700 disabled:bg-cream-300 disabled:text-ink-300 text-cream-50 py-3.5 rounded-2xl text-sm font-semibold transition shadow-soft disabled:shadow-none active:scale-[0.99] no-print"
          >
            {saving ? "Saving Pet records..." : "Save Pet Records"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-terracotta-600 font-medium text-center">{error}</p>}

      {/* EDIT/ADD MODAL OVERLAY */}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print animate-fade-in">
          <form
            onSubmit={handleModalSubmit}
            className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-lifted border border-cream-200/50 flex flex-col animate-scale-in"
          >
            {/* Modal Title Header */}
            <div className="p-6 border-b border-cream-200 flex items-center justify-between">
              <h3 className="font-sans text-xl font-bold text-ink-900">
                {modalState.mode === "add" ? "Add New Pet" : `Edit ${modalPet.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                className="w-7 h-7 rounded-full bg-cream-100 hover:bg-cream-200 text-ink-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Scroll Area */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-left">
              {/* Pet Name & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Pet Name
                  </label>
                  <input
                    type="text"
                    value={modalPet.name}
                    onChange={(e) => updateModalPetField("name", e.target.value)}
                    placeholder="e.g. Max, Bella"
                    className={inputCls}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Pet Type
                  </label>
                  <select
                    value={modalPet.pet_type}
                    onChange={(e) => updateModalPetField("pet_type", e.target.value)}
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

              {/* Sex & Spayed options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Sex {isDogOrCat && <span className="text-terracotta-700 font-bold">*</span>}
                  </label>
                  <select
                    value={modalPet.sex || "Unknown"}
                    onChange={(e) => updateModalPetField("sex", e.target.value)}
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
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Spayed / Neutered {isDogOrCat && <span className="text-terracotta-700 font-bold">*</span>}
                  </label>
                  <select
                    value={modalPet.spayed_neutered || "Unknown"}
                    onChange={(e) => updateModalPetField("spayed_neutered", e.target.value)}
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

              {/* Photo Upload Area */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                  Pet Photo
                </label>
                {modalPet.photo_url && (
                  <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-cream-200 shadow-sm mb-2 bg-cream-50">
                    <img
                      src={modalPet.photo_url}
                      alt={modalPet.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => updateModalPetField("photo_url", null)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                  className="w-full text-xs text-ink-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-forest-50 file:text-forest-700 hover:file:bg-forest-100 cursor-pointer"
                />
                {uploading && <p className="text-[10px] text-forest-700 mt-1">Uploading image...</p>}
              </div>

              {/* Care instructions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Feeding Instructions
                  </label>
                  <textarea
                    value={modalPet.feeding_instructions || ""}
                    onChange={(e) => updateModalPetField("feeding_instructions", e.target.value)}
                    placeholder="e.g. 1 cup kibble at 8 AM."
                    className={inputCls}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Medication Instructions
                  </label>
                  <textarea
                    value={modalPet.medication_instructions || ""}
                    onChange={(e) => updateModalPetField("medication_instructions", e.target.value)}
                    placeholder="e.g. 1 pill once daily."
                    className={inputCls}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Behavior Notes
                  </label>
                  <textarea
                    value={modalPet.behavior_notes || ""}
                    onChange={(e) => updateModalPetField("behavior_notes", e.target.value)}
                    placeholder="e.g. Friendly, scares easily."
                    className={inputCls}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Emergency Notes
                  </label>
                  <textarea
                    value={modalPet.emergency_notes || ""}
                    onChange={(e) => updateModalPetField("emergency_notes", e.target.value)}
                    placeholder="e.g. Leash in laundry closet."
                    className={inputCls}
                    rows={2}
                  />
                </div>
              </div>

              {/* Vet, location details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-cream-100 pt-3.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Location of supplies
                  </label>
                  <input
                    type="text"
                    value={modalPet.supplies_location || ""}
                    onChange={(e) => updateModalPetField("supplies_location", e.target.value)}
                    placeholder="e.g. Kitchen pantry"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Vet Name
                  </label>
                  <input
                    type="text"
                    value={modalPet.vet_name || ""}
                    onChange={(e) => updateModalPetField("vet_name", e.target.value)}
                    placeholder="Dr. Adams"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Vet Phone
                  </label>
                  <input
                    type="tel"
                    value={modalPet.vet_phone || ""}
                    onChange={(e) => updateModalPetField("vet_phone", e.target.value)}
                    placeholder="555-444-3333"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Emergency Vet Phone
                  </label>
                  <input
                    type="tel"
                    value={modalPet.emergency_vet_phone || ""}
                    onChange={(e) => updateModalPetField("emergency_vet_phone", e.target.value)}
                    placeholder="555-999-8888"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Microchip Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={modalPet.microchip_number || ""}
                    onChange={(e) => updateModalPetField("microchip_number", e.target.value)}
                    placeholder="e.g. 981022459"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5">
                    Rabies / Vaccine Info (Optional)
                  </label>
                  <input
                    type="text"
                    value={modalPet.vaccine_info || ""}
                    onChange={(e) => updateModalPetField("vaccine_info", e.target.value)}
                    placeholder="Rabies valid until Nov 2027"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Caregiver Visibility checkbox */}
              <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink-500 pt-3 border-t border-cream-100">
                <input
                  type="checkbox"
                  checked={modalPet.show_to_caregivers}
                  onChange={(e) => updateModalPetField("show_to_caregivers", e.target.checked)}
                  className="w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
                />
                <span>Show Pet Records to Caregivers on shift</span>
              </label>

              {modalError && (
                <p className="text-xs text-red-600 font-bold text-center mt-2">{modalError}</p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="bg-cream-50 p-4 border-t border-cream-200 rounded-b-3xl flex gap-3">
              <button
                type="submit"
                disabled={uploading}
                className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-semibold transition active:scale-[0.98] shadow-sm disabled:opacity-50"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                className="bg-white hover:bg-cream-200 text-ink-700 border border-cream-300/60 px-5 py-3 rounded-2xl text-sm font-medium transition active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-2xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition text-sm";
