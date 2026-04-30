"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AcceptDeclineButtons({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(status: "accepted" | "declined") {
    setError(null);
    setLoading(status === "accepted" ? "accept" : "decline");
    const supabase = createClient();
    const update: {
      assignment_status: "accepted" | "declined";
      caregiver_id?: null;
    } = { assignment_status: status };
    if (status === "declined") update.caregiver_id = null;

    // Use .select() to confirm the row was actually updated; if RLS silently
    // blocks the update, we get back an empty array and can show a real error.
    const { data, error: updateError } = await supabase
      .from("shifts")
      .update(update)
      .eq("id", shiftId)
      .select("id, assignment_status");

    if (updateError) {
      setError(updateError.message);
      setLoading(null);
      return;
    }

    if (!data || data.length === 0) {
      setError(
        "Couldn't update the shift. Your account may not have permission. Try refreshing or contact the admin."
      );
      setLoading(null);
      return;
    }

    if (status === "declined") {
      router.push("/schedule");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="bg-terracotta-400/10 border border-terracotta-400/30 rounded-2xl p-4 mb-2">
      <p className="text-sm font-medium text-ink-900 mb-3 text-center">
        Accept this shift?
      </p>
      {error && (
        <div className="bg-terracotta-400/15 border border-terracotta-400/30 text-terracotta-600 rounded-xl px-3 py-2 text-xs mb-3">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => respond("declined")}
          disabled={loading !== null}
          className="flex-1 bg-white hover:bg-cream-50 text-ink-700 py-3 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {loading === "decline" ? "Declining..." : "Decline"}
        </button>
        <button
          onClick={() => respond("accepted")}
          disabled={loading !== null}
          className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {loading === "accept" ? "Accepting..." : "Accept shift"}
        </button>
      </div>
    </div>
  );
}
