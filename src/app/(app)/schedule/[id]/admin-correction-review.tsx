"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminCorrectionReview({
  request,
  shiftId,
  actorId,
}: {
  request: any;
  shiftId: string;
  actorId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);

  function formatTime(isoStr?: string | null) {
    if (!isoStr) return "N/A";
    const d = new Date(isoStr);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  async function handleReview(status: "approved" | "declined") {
    setSubmitting(true);
    try {
      const res = await fetch("/api/schedule/time-corrections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          status,
          adminNotes: response.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        alert(data?.error || `Failed to ${status} request.`);
        setSubmitting(false);
        return;
      }

      alert(`Time correction request ${status} successfully.`);
      setSubmitting(false);
      setShowReviewForm(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "An error occurred.");
      setSubmitting(false);
    }
  }

  if (request.status !== "pending") {
    return null;
  }

  return (
    <section className="bg-amber-50 border border-amber-300 rounded-3xl p-5 mt-4 space-y-4">
      <div>
        <h3 className="font-display text-sm font-bold text-amber-900">Caregiver Time Correction Request</h3>
        <p className="text-xs text-ink-600 mt-1">
          The caregiver has requested a correction for their check-in / check-out times. Approved corrections will reflect on the next invoice.
        </p>

        <div className="bg-white rounded-xl p-3 border border-amber-200 mt-3 text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-ink-500 font-semibold uppercase tracking-wider text-[9px]">Requested Check-In:</p>
              <p className="text-ink-900 font-bold">{formatTime(request.requested_check_in_time)}</p>
            </div>
            <div>
              <p className="text-ink-500 font-semibold uppercase tracking-wider text-[9px]">Requested Check-Out:</p>
              <p className="text-ink-900 font-bold">{formatTime(request.requested_check_out_time)}</p>
            </div>
          </div>
          <div>
            <p className="text-ink-500 font-semibold uppercase tracking-wider text-[9px] mb-1">Reason for request:</p>
            <p className="text-ink-900 italic font-medium">"{request.reason}"</p>
          </div>
        </div>
      </div>

      {!showReviewForm ? (
        <button
          onClick={() => setShowReviewForm(true)}
          className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-xs font-semibold transition text-center"
        >
          Review Time Correction
        </button>
      ) : (
        <div className="space-y-3 pt-2 border-t border-amber-200">
          <div>
            <label className="block text-xs font-semibold text-ink-750 mb-1">Admin Response / Notes (optional)</label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="e.g. Approved per phone call correction."
              className="w-full bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs text-ink-900 focus:outline-none focus:border-forest-500 min-h-[60px] resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowReviewForm(false)}
              className="bg-white hover:bg-cream-50 border border-cream-200 text-ink-700 px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => handleReview("declined")}
              disabled={submitting}
              className="bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={() => handleReview("approved")}
              disabled={submitting}
              className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              Approve & Correct Time
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
