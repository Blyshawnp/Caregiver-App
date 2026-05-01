"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendNotificationEvent } from "@/lib/notify-client";

export default function ForceCheckOutButton({
  shiftId,
  checkInId,
  caregiverName,
  organizationId,
  caregiverId,
}: {
  shiftId: string;
  checkInId: string;
  caregiverName: string;
  organizationId: string;
  caregiverId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function force() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const update = {
      check_out_time: new Date().toISOString(),
      check_out_within_geofence: false,
      flagged_outside_geofence: true,
      flag_reason:
        reason.trim() ||
        "Manually checked out by admin (auto-checkout did not fire)",
    };

    const { data: written, error } = await supabase
      .from("check_ins")
      .update(update)
      .eq("id", checkInId)
      .select("id");

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    if (!written || written.length === 0) {
      setError("Could not update. Try refreshing.");
      setSubmitting(false);
      return;
    }

    void sendNotificationEvent({
      type: "force_check_out",
      shiftId,
      reason,
    });

    window.location.href = `/schedule/${shiftId}`;
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="block w-full bg-white hover:bg-cream-50 text-terracotta-600 py-3.5 rounded-2xl font-medium text-center transition shadow-soft"
      >
        Force check out
      </button>
    );
  }

  return (
    <div className="bg-terracotta-400/10 border border-terracotta-400/30 rounded-2xl p-4">
      <p className="text-sm font-medium text-ink-900 mb-1">
        Force check out {caregiverName.split(" ")[0]}?
      </p>
      <p className="text-xs text-ink-700 mb-3">
        Use this only if auto-checkout failed and they're no longer on duty.
        Hours worked will be calculated up to right now.
      </p>

      <label className="block mb-3">
        <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
          Reason (optional)
        </span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Forgot to check out"
          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
          maxLength={140}
        />
      </label>

      {error && (
        <p className="text-terracotta-600 text-xs mb-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={submitting}
          className="flex-1 bg-white hover:bg-cream-50 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={force}
          disabled={submitting}
          className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {submitting ? "Checking out..." : "Yes, check out"}
        </button>
      </div>
    </div>
  );
}
