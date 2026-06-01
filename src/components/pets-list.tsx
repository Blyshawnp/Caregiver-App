"use client";

import { useState } from "react";
import Image from "next/image";

export type Pet = {
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

type PetsListProps = {
  pets: Pet[];
  readOnly?: boolean;
  onEdit?: (pet: Pet, index: number) => void;
  onRemove?: (index: number) => void;
  onAdd?: () => void;
};

export default function PetsList({
  pets,
  readOnly = false,
  onEdit,
  onRemove,
  onAdd,
}: PetsListProps) {
  const [selectedPetIdx, setSelectedPetIdx] = useState<number | null>(null);

  const selectedPet = selectedPetIdx !== null ? pets[selectedPetIdx] : null;

  function getTypeBadgeStyles(type: string) {
    switch (type) {
      case "Dog":
        return "bg-amber-50 text-amber-800 border-amber-200/50";
      case "Cat":
        return "bg-orange-50 text-orange-850 border-orange-200/50";
      case "Bird":
        return "bg-sky-50 text-sky-800 border-sky-200/50";
      case "Fish":
        return "bg-teal-50 text-teal-800 border-teal-200/50";
      case "Reptile":
        return "bg-emerald-50 text-emerald-800 border-emerald-200/50";
      case "Rabbit":
      case "Ferret":
      case "Small mammal":
        return "bg-purple-50 text-purple-800 border-purple-200/50";
      case "Horse":
      case "Farm animal":
        return "bg-stone-100 text-stone-850 border-stone-300/40";
      default:
        return "bg-cream-200 text-ink-700 border-cream-300/50";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-lg font-bold text-ink-900">Pets</h2>
        {!readOnly && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2 rounded-2xl text-xs font-semibold transition active:scale-[0.98] shadow-sm flex items-center gap-1.5"
          >
            <span>+</span> Add Pet
          </button>
        )}
      </div>

      {pets.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 shadow-soft text-center border border-cream-200/40 grain-overlay">
          <div className="w-14 h-14 rounded-2xl bg-cream-100 grid place-items-center mx-auto mb-4 text-ink-400">
            <PawPrintIcon className="w-7 h-7 text-ink-400" />
          </div>
          <p className="text-sm text-ink-500 font-medium">No pets added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pets.map((pet, idx) => {
            const hasMeds = !!pet.medication_instructions?.trim();
            const hasEmerg = !!pet.emergency_notes?.trim();

            return (
              <article
                key={idx}
                onClick={() => setSelectedPetIdx(idx)}
                className="bg-white rounded-3xl border border-cream-200/50 shadow-soft overflow-hidden hover:shadow-medium cursor-pointer transition-all duration-250 active:scale-[0.99] hover:bg-cream-50/20 group flex flex-col h-full"
              >
                {/* Photo Header */}
                <div className="relative h-44 w-full bg-cream-100 shrink-0 overflow-hidden">
                  {pet.photo_url ? (
                    <img
                      src={pet.photo_url}
                      alt={pet.name}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center bg-gradient-to-br from-cream-100 to-cream-200 text-forest-600/30">
                      <PawPrintIcon className="w-12 h-12 text-forest-600/20 group-hover:scale-[1.05] transition-transform duration-300" />
                    </div>
                  )}

                  {/* Floating type badge */}
                  <span
                    className={`absolute top-3 left-3 border text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shadow-sm z-10 ${getTypeBadgeStyles(
                      pet.pet_type
                    )}`}
                  >
                    {pet.pet_type}
                  </span>
                </div>

                {/* Content Body */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-sans text-xl font-bold text-ink-900 group-hover:text-forest-700 transition-colors">
                      {pet.name}
                    </h3>
                    <p className="text-xs text-ink-400 mt-0.5 capitalize">
                      {pet.sex || "Unknown sex"}
                      {pet.spayed_neutered && ` · ${pet.spayed_neutered === "Yes" ? "Spayed/Neutered" : "Intact"}`}
                    </p>
                  </div>

                  {/* Warning / indicator badges */}
                  {(hasMeds || hasEmerg) && (
                    <div className="flex flex-wrap gap-1.5 mt-3.5 pt-3 border-t border-cream-100/60">
                      {hasMeds && (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-100 text-[9px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-lg">
                          💊 Needs Meds
                        </span>
                      )}
                      {hasEmerg && (
                        <span className="inline-flex items-center gap-1 bg-terracotta-500/10 text-terracotta-700 border border-terracotta-450/15 text-[9px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-lg">
                          ⚠️ Emerg Notes
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL DIALOG */}
      {selectedPet && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-lifted border border-cream-200/50 flex flex-col animate-scale-in">
            {/* Modal Photo Header */}
            <div className="relative h-60 w-full bg-cream-200 shrink-0">
              {selectedPet.photo_url ? (
                <img
                  src={selectedPet.photo_url}
                  alt={selectedPet.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center bg-gradient-to-br from-cream-100 to-cream-200">
                  <PawPrintIcon className="w-16 h-16 text-forest-600/20" />
                </div>
              )}
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedPetIdx(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center font-bold text-sm shadow-md transition-all active:scale-[0.9]"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Info */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <header>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`border text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shadow-xs ${getTypeBadgeStyles(
                      selectedPet.pet_type
                    )}`}
                  >
                    {selectedPet.pet_type}
                  </span>
                  <span className="text-xs text-ink-500">
                    {selectedPet.sex || "Unknown"} sex ·{" "}
                    {selectedPet.spayed_neutered === "Yes"
                      ? "Spayed/Neutered"
                      : selectedPet.spayed_neutered === "No"
                        ? "Intact"
                        : "Unknown status"}
                  </span>
                </div>
                <h3 className="font-sans text-3xl font-bold text-ink-900 leading-tight">
                  {selectedPet.name}
                </h3>
              </header>

              {/* Specific info items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailItem
                  label="Feeding instructions"
                  value={selectedPet.feeding_instructions}
                  icon="🥣"
                />
                <DetailItem
                  label="Medication instructions"
                  value={selectedPet.medication_instructions}
                  icon="💊"
                  tone={selectedPet.medication_instructions ? "danger" : "normal"}
                />
                <DetailItem
                  label="Behavior notes"
                  value={selectedPet.behavior_notes}
                  icon="🐾"
                />
                <DetailItem
                  label="Emergency notes"
                  value={selectedPet.emergency_notes}
                  icon="⚠️"
                  tone={selectedPet.emergency_notes ? "warning" : "normal"}
                />
                <DetailItem
                  label="Location of supplies"
                  value={selectedPet.supplies_location}
                  icon="🔑"
                />
                <DetailItem
                  label="Vaccines / Rabies info"
                  value={selectedPet.vaccine_info}
                  icon="🛡️"
                />
              </div>

              {/* Vet Details */}
              <div className="bg-cream-50 rounded-2xl p-4 border border-cream-200/50 space-y-3">
                <p className="text-xs uppercase tracking-wider font-bold text-ink-500">
                  🩺 Veterinary Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-ink-400">Primary Vet</p>
                    <p className="font-medium text-ink-900">
                      {selectedPet.vet_name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-400">Phone</p>
                    {selectedPet.vet_phone ? (
                      <a
                        href={`tel:${selectedPet.vet_phone}`}
                        className="font-medium text-forest-700 hover:underline"
                      >
                        {selectedPet.vet_phone}
                      </a>
                    ) : (
                      <p className="text-ink-950">—</p>
                    )}
                  </div>
                  {selectedPet.emergency_vet_phone && (
                    <div className="sm:col-span-2 pt-2 border-t border-cream-200/60">
                      <p className="text-xs text-terracotta-600 font-bold">
                        🚨 Emergency Clinic Phone
                      </p>
                      <a
                        href={`tel:${selectedPet.emergency_vet_phone}`}
                        className="font-semibold text-terracotta-700 hover:underline text-base"
                      >
                        {selectedPet.emergency_vet_phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-ink-400 pt-4 border-t border-cream-100">
                <span>
                  Microchip #:{" "}
                  <strong className="text-ink-700">
                    {selectedPet.microchip_number || "—"}
                  </strong>
                </span>
                <span>
                  {selectedPet.show_to_caregivers ? (
                    <span className="text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                      ✓ Shown to Caregivers
                    </span>
                  ) : (
                    <span className="text-ink-500 font-medium bg-cream-200 px-2 py-0.5 rounded-md">
                      ✕ Hidden from Caregivers
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-cream-50 p-4 border-t border-cream-200 rounded-b-3xl flex gap-3">
              {!readOnly && onEdit && onRemove && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(selectedPet, selectedPetIdx!);
                      setSelectedPetIdx(null);
                    }}
                    className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-semibold transition active:scale-[0.98] shadow-sm text-center"
                  >
                    Edit Pet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Are you sure you want to remove ${selectedPet.name}?`
                        )
                      ) {
                        onRemove(selectedPetIdx!);
                        setSelectedPetIdx(null);
                      }
                    }}
                    className="bg-terracotta-500/10 hover:bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-2xl text-sm font-semibold transition active:scale-[0.98]"
                  >
                    Remove
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelectedPetIdx(null)}
                className="bg-white hover:bg-cream-200 text-ink-700 border border-cream-300/60 px-5 py-3 rounded-2xl text-sm font-medium transition active:scale-[0.98] shrink-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
  icon,
  tone = "normal",
}: {
  label: string;
  value: string | null;
  icon: string;
  tone?: "normal" | "warning" | "danger";
}) {
  if (!value?.trim()) return null;

  const bgStyles = {
    normal: "bg-cream-50 border-cream-200/50 text-ink-850",
    warning: "bg-amber-50 border-amber-200/50 text-amber-900",
    danger: "bg-red-50 border-red-200/50 text-red-900",
  };

  return (
    <div className={`rounded-2xl border p-3.5 space-y-1 ${bgStyles[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 flex items-center gap-1.5 leading-none mb-1">
        <span>{icon}</span> {label}
      </p>
      <p className="text-sm font-medium whitespace-pre-line leading-relaxed">
        {value}
      </p>
    </div>
  );
}

function PawPrintIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="14" r="4" />
      <circle cx="6.5" cy="10" r="2.5" />
      <circle cx="17.5" cy="10" r="2.5" />
      <circle cx="8" cy="5" r="2" />
      <circle cx="16" cy="5" r="2" />
    </svg>
  );
}
