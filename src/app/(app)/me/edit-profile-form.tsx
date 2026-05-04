"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EditProfileForm({
  userId,
  initialName,
  initialPhone,
  initialBio,
  initialVehicle1MakeModel,
  initialVehicle1Color,
  initialVehicle2MakeModel,
  initialVehicle2Color,
  role,
}: {
  userId: string;
  initialName: string;
  initialPhone: string | null;
  initialBio: string | null;
  initialVehicle1MakeModel: string | null;
  initialVehicle1Color: string | null;
  initialVehicle2MakeModel: string | null;
  initialVehicle2Color: string | null;
  role: string;
}) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [vehicle1MakeModel, setVehicle1MakeModel] = useState(
    initialVehicle1MakeModel ?? ""
  );
  const [vehicle1Color, setVehicle1Color] = useState(initialVehicle1Color ?? "");
  const [vehicle2MakeModel, setVehicle2MakeModel] = useState(
    initialVehicle2MakeModel ?? ""
  );
  const [vehicle2Color, setVehicle2Color] = useState(initialVehicle2Color ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        vehicle_1_make_model:
          role === "caregiver" ? vehicle1MakeModel.trim() || null : null,
        vehicle_1_color: role === "caregiver" ? vehicle1Color.trim() || null : null,
        vehicle_2_make_model:
          role === "caregiver" ? vehicle2MakeModel.trim() || null : null,
        vehicle_2_color: role === "caregiver" ? vehicle2Color.trim() || null : null,
      })
      .eq("id", userId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(false);
    window.location.reload();
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-forest-600 hover:underline font-medium"
      >
        Edit profile
      </button>
    );
  }

  return (
    <form onSubmit={save} className="mt-4 bg-cream-50 border border-cream-200 rounded-2xl p-4 space-y-3">
      <label className="block">
        <span className="block text-xs uppercase tracking-wide text-ink-500 mb-1">Name</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
          required
        />
      </label>
      <label className="block">
        <span className="block text-xs uppercase tracking-wide text-ink-500 mb-1">Phone</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
          placeholder="555-123-4567"
        />
      </label>
      <label className="block">
        <span className="block text-xs uppercase tracking-wide text-ink-500 mb-1">About</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 bg-white border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500 resize-none"
          placeholder="Share helpful context for the care team."
        />
      </label>
      {role === "caregiver" && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-ink-500">Vehicles</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wide text-ink-500 mb-1">
                Car 1 color
              </span>
              <input
                value={vehicle1Color}
                onChange={(e) => setVehicle1Color(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
                placeholder="Silver"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wide text-ink-500 mb-1">
                Car 1 make/model
              </span>
              <input
                value={vehicle1MakeModel}
                onChange={(e) => setVehicle1MakeModel(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
                placeholder="Toyota Camry"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wide text-ink-500 mb-1">
                Car 2 color
              </span>
              <input
                value={vehicle2Color}
                onChange={(e) => setVehicle2Color(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
                placeholder="Blue"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-wide text-ink-500 mb-1">
                Car 2 make/model
              </span>
              <input
                value={vehicle2MakeModel}
                onChange={(e) => setVehicle2MakeModel(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
                placeholder="Honda CR-V"
              />
            </label>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-terracotta-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setFullName(initialName);
            setPhone(initialPhone ?? "");
            setBio(initialBio ?? "");
            setVehicle1MakeModel(initialVehicle1MakeModel ?? "");
            setVehicle1Color(initialVehicle1Color ?? "");
            setVehicle2MakeModel(initialVehicle2MakeModel ?? "");
            setVehicle2Color(initialVehicle2Color ?? "");
            setEditing(false);
            setError(null);
          }}
          className="flex-1 bg-white border border-cream-200 text-ink-700 py-2 rounded-xl text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !fullName.trim()}
          className="flex-1 bg-forest-600 text-cream-50 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}
