"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CaregiverOption = {
  id: string;
  full_name: string | null;
};

export default function ForceAssignButton({
  shiftId,
  caregivers,
  currentCaregiverId,
}: {
  shiftId: string;
  caregivers: CaregiverOption[];
  currentCaregiverId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [caregiverId, setCaregiverId] = useState(currentCaregiverId ?? "");
  const [reason, setReason] = useState("");
  const [overrideConfirm, setOverrideConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overriding = !!currentCaregiverId && caregiverId !== currentCaregiverId;
  const canSubmit = caregiverId && reason.trim().length >= 5 && (!overriding || overrideConfirm === "ASSIGN");

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const response = await fetch("/api/schedule/force-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId, caregiverId, reason }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setError(result?.error ?? "Could not force assign this shift.");
      setSaving(false);
      return;
    }

    router.refresh();
    setOpen(false);
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition"
      >
        Force assign / accept shift
      </button>
    );
  }

  return (
    <div className="bg-white border border-cream-200 rounded-2xl p-4 shadow-soft space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink-900">Assign caregiver with reason</p>
        <p className="text-xs text-ink-500 mt-0.5">
          Use this only for admin support when a caregiver cannot accept normally. The assignment is logged and the caregiver is notified.
        </p>
      </div>
      <label className="block text-xs font-semibold text-ink-700">
        Caregiver
        <select
          value={caregiverId}
          onChange={(event) => setCaregiverId(event.target.value)}
          className="mt-1 w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-600"
        >
          <option value="">Select caregiver</option>
          {caregivers.map((caregiver) => (
            <option key={caregiver.id} value={caregiver.id}>
              {caregiver.full_name ?? "Caregiver"}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-semibold text-ink-700">
        Reason
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-600"
          rows={3}
          placeholder="Example: Caregiver called and confirmed by phone."
        />
      </label>
      {overriding && (
        <label className="block text-xs font-semibold text-terracotta-700">
          This overrides the current caregiver. Type ASSIGN to confirm.
          <input
            value={overrideConfirm}
            onChange={(event) => setOverrideConfirm(event.target.value)}
            className="mt-1 w-full bg-terracotta-50 border border-terracotta-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-terracotta-500"
          />
        </label>
      )}
      {error && <p className="text-xs text-terracotta-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={saving}
          className="flex-1 bg-cream-100 hover:bg-cream-200 text-ink-800 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit || saving}
          className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-60"
        >
          {saving ? "Assigning..." : "Assign and accept"}
        </button>
      </div>
    </div>
  );
}
