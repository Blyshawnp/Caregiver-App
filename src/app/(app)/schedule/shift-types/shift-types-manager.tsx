"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ShiftType = { id: string; name: string; color: string };

export default function ShiftTypesManager({ shiftTypes }: { shiftTypes: ShiftType[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#0D6587");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function createType(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const response = await fetch("/api/shift-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, color: newColor }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) {
      setError(result?.error ?? "Could not add shift type.");
      return;
    }
    setNewName("");
    setNewColor("#0D6587");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createType} className="bg-white rounded-3xl p-5 shadow-soft space-y-3">
        <h2 className="font-display text-xl text-ink-900">Add shift type</h2>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Overnight"
            className="px-3 py-2.5 bg-cream-50 border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
            maxLength={80}
            required
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-11 w-14 rounded-xl border border-cream-200 bg-cream-50"
            aria-label="Shift type color"
          />
        </div>
        {error && <p className="text-sm text-terracotta-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-2xl text-sm font-medium transition disabled:opacity-60"
        >
          {saving ? "Saving..." : "Add shift type"}
        </button>
      </form>

      <ul className="space-y-2">
        {shiftTypes.map((type) => (
          <li key={type.id}>
            <ShiftTypeRow type={type} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShiftTypeRow({ type }: { type: ShiftType }) {
  const router = useRouter();
  const [name, setName] = useState(type.name);
  const [color, setColor] = useState(type.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/shift-types", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: type.id, name, color }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) {
      setError(result?.error ?? "Could not save shift type.");
      return;
    }
    router.refresh();
  }

  const changed = name.trim() !== type.name || color !== type.color;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-soft">
      <div className="grid grid-cols-[auto_1fr_auto] gap-3 items-center">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-12 rounded-xl border border-cream-200 bg-cream-50"
          aria-label={`${type.name} color`}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
          maxLength={80}
        />
        <button
          onClick={save}
          disabled={saving || !changed || !name.trim()}
          className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-3 py-2 rounded-xl text-xs font-medium transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-terracotta-600 mt-2">{error}</p>}
    </div>
  );
}
