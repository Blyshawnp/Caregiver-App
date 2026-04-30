"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReleaseShiftButton({
  shiftId,
  organizationId,
  caregiverId,
  caregiverName,
  shiftStart,
  clientName,
}: {
  shiftId: string;
  organizationId: string;
  caregiverId: string;
  caregiverName: string;
  shiftStart: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function release() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    // Mark shift as released and clear caregiver assignment
    const { data, error: updateError } = await supabase
      .from("shifts")
      .update({
        is_released: true,
        released_at: new Date().toISOString(),
        released_by: caregiverId,
        release_reason: reason.trim() || null,
        caregiver_id: null,
        assignment_status: null,
      })
      .eq("id", shiftId)
      .select("id");

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }
    if (!data || data.length === 0) {
      setError("Could not release the shift. Try refreshing.");
      setSubmitting(false);
      return;
    }

    // Notify all OTHER caregivers and admins in the org
    try {
      const { data: recipients } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .neq("id", caregiverId)
        .in("role", ["admin", "caregiver"]);

      if (recipients && recipients.length > 0) {
        const date = new Date(shiftStart);
        const dateStr = date.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const timeStr = date.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });
        const reasonSuffix = reason.trim() ? ` (${reason.trim()})` : "";
        const body = `${caregiverName} released their ${dateStr} ${timeStr} shift with ${clientName}${reasonSuffix}. Tap to claim it.`;

        await supabase.from("notifications").insert(
          recipients.map((r) => ({
            organization_id: organizationId,
            recipient_id: r.id,
            kind: "shift_released",
            title: "Shift available",
            body,
            link: `/schedule/${shiftId}`,
            related_shift_id: shiftId,
          }))
        );
      }
    } catch {
      /* notifications are best effort */
    }

    window.location.href = `/schedule/${shiftId}`;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="block w-full bg-white hover:bg-cream-50 text-terracotta-600 border border-terracotta-400/30 py-3 rounded-2xl font-medium text-center transition shadow-soft text-sm"
      >
        Release this shift
      </button>
    );
  }

  return (
    <div className="bg-terracotta-400/10 border border-terracotta-400/30 rounded-2xl p-4">
      <p className="text-sm font-medium text-ink-900 mb-1">
        Release this shift?
      </p>
      <p className="text-xs text-ink-700 mb-3">
        It'll be available for any teammate to claim. Everyone gets notified.
        You can take it back if no one claims it yet.
      </p>

      <label className="block mb-3">
        <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
          Reason (optional)
        </span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Sick, doctor's appointment"
          maxLength={140}
          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
        />
      </label>

      {error && <p className="text-terracotta-600 text-xs mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={submitting}
          className="flex-1 bg-white hover:bg-cream-50 text-ink-700 border border-cream-200 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={release}
          disabled={submitting}
          className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {submitting ? "Releasing..." : "Release shift"}
        </button>
      </div>
    </div>
  );
}
