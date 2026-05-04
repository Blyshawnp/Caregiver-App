"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EditProfileForm({
  userId,
  initialName,
  initialPhone,
}: {
  userId: string;
  initialName: string;
  initialPhone: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? "");
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
      {error && <p className="text-xs text-terracotta-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setFullName(initialName);
            setPhone(initialPhone ?? "");
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
