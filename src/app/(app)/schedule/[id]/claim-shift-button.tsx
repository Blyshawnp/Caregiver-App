"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendNotificationEvent } from "@/lib/notify-client";

export default function ClaimShiftButton({
  shiftId,
  organizationId,
  caregiverId,
  caregiverName,
  releasedById,
  shiftStart,
  clientName,
}: {
  shiftId: string;
  organizationId: string;
  caregiverId: string;
  caregiverName: string;
  releasedById: string | null;
  shiftStart: string;
  clientName: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    // Re-assign the shift to me, mark as accepted, clear release flag
    const { data, error: updateError } = await supabase
      .from("shifts")
      .update({
        caregiver_id: caregiverId,
        assignment_status: "accepted",
        is_released: false,
        released_at: null,
        released_by: null,
        release_reason: null,
      })
      .eq("id", shiftId)
      .eq("is_released", true) // safety: only update if still released
      .select("id");

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }
    if (!data || data.length === 0) {
      setError("Someone else may have already claimed this shift. Refreshing...");
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
        {submitting ? "Claiming..." : "Claim this shift"}
      </button>
      {error && (
        <p className="text-terracotta-600 text-xs text-center">{error}</p>
      )}
    </div>
  );
}
