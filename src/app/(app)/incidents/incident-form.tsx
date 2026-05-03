"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ShiftOption = {
  id: string;
  label: string;
};

export default function IncidentForm({ shifts }: { shifts: ShiftOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [shiftId, setShiftId] = useState(shifts[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const response = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        severity,
        shiftId: shiftId || null,
      }),
    });

    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(result?.error ?? "Could not submit incident.");
      setSaving(false);
      return;
    }

    setTitle("");
    setDescription("");
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-3xl shadow-soft p-5 mb-5 grain-overlay">
      <div className="relative space-y-3">
        <h2 className="font-display text-xl text-ink-900">Report incident</h2>
        <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={inputCls}>
          <option value="">No shift selected</option>
          {shifts.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {shift.label}
            </option>
          ))}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputCls}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title" maxLength={120} className={inputCls} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened?" rows={4} className={inputCls} />
        {error && <p className="text-sm text-terracotta-600">{error}</p>}
        <button disabled={saving || !title.trim() || !description.trim()} className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-medium transition disabled:opacity-60">
          {saving ? "Submitting..." : "Submit incident"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-2xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition text-sm";
