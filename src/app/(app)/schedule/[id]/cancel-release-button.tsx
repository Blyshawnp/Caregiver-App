"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CancelReleaseButton({
  shiftId,
  caregiverId,
}: {
  shiftId: string;
  caregiverId: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

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
      .eq("is_released", true)
      .select("id");

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }
    if (!data || data.length === 0) {
      setError("Someone may have already claimed this. Refreshing...");
      setTimeout(() => window.location.reload(), 1500);
      return;
    }

    window.location.href = `/schedule/${shiftId}`;
  }

  return (
    <div className="space-y-2">
      <button
        onClick={cancel}
        disabled={submitting}
        className="block w-full bg-white hover:bg-cream-50 text-forest-600 border border-forest-500/30 py-3 rounded-2xl font-medium text-center transition shadow-soft text-sm disabled:opacity-50"
      >
        {submitting ? "Taking back..." : "Take this shift back"}
      </button>
      {error && (
        <p className="text-terracotta-600 text-xs text-center">{error}</p>
      )}
    </div>
  );
}
