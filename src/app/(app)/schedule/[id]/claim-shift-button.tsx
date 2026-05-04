"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendNotificationEvent } from "@/lib/notify-client";

export default function ClaimShiftButton({
  shiftId,
  caregiverId: _caregiverId,
}: {
  shiftId: string;
  caregiverId: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const { data, error: updateError } = await supabase.rpc("claim_open_shift", {
      p_shift_id: shiftId,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }
    if (!data) {
      setError("Someone else may have already picked up this trade. Refreshing...");
      setTimeout(() => window.location.reload(), 1500);
      return;
    }

    void sendNotificationEvent({
      type: "shift_claimed",
      shiftId,
    });

    window.location.href = `/schedule/${shiftId}`;
  }

  return (
    <div className="space-y-2">
      <button
        onClick={claim}
        disabled={submitting}
        className="block w-full bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition active:scale-[0.99]"
      >
        {submitting ? "Picking up..." : "Pick up this trade"}
      </button>
      {error && (
        <p className="text-terracotta-600 text-xs text-center">{error}</p>
      )}
    </div>
  );
}
