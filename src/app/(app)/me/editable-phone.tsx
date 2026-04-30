"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EditablePhone({
  initialPhone,
  userId,
}: {
  initialPhone: string | null;
  userId: string;
}) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const trimmed = phone.trim() || null;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ phone: trimmed })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex justify-between py-3 first:pt-0 last:pb-0 border-t border-cream-200 first:border-t-0">
        <dt className="text-ink-500">Phone</dt>
        <dd className="text-ink-900 font-medium text-right flex items-center gap-2">
          <span>{initialPhone || "Not set"}</span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-forest-600 hover:underline font-normal"
          >
            Edit
          </button>
        </dd>
      </div>
    );
  }

  return (
    <div className="py-3 border-t border-cream-200 first:border-t-0">
      <dt className="text-ink-500 mb-1.5">Phone</dt>
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="555-123-4567"
          autoFocus
          className="flex-1 px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
        />
        <button
          onClick={save}
          disabled={saving}
          className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => {
            setPhone(initialPhone ?? "");
            setEditing(false);
            setError(null);
          }}
          disabled={saving}
          className="bg-white hover:bg-cream-100 text-ink-700 border border-cream-200 px-3 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="text-terracotta-600 text-xs mt-1.5">{error}</p>
      )}
    </div>
  );
}
