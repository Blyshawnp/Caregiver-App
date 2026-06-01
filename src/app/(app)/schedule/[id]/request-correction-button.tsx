"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestCorrectionButton({
  shiftId,
  scheduledStart,
  scheduledEnd,
  existingCheckIn,
  existingCheckOut,
  existingRequest,
}: {
  shiftId: string;
  scheduledStart: string;
  scheduledEnd: string;
  existingCheckIn?: string | null;
  existingCheckOut?: string | null;
  existingRequest: any;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [checkInTime, setCheckInTime] = useState(() => {
    const d = existingCheckIn ? new Date(existingCheckIn) : new Date(scheduledStart);
    return toLocalISOString(d);
  });
  const [checkOutTime, setCheckOutTime] = useState(() => {
    const d = existingCheckOut ? new Date(existingCheckOut) : new Date(scheduledEnd);
    return toLocalISOString(d);
  });
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  function toLocalISOString(date: Date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/schedule/time-corrections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shiftId,
          requestedCheckInTime: new Date(checkInTime).toISOString(),
          requestedCheckOutTime: new Date(checkOutTime).toISOString(),
          reason,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        alert(data?.error || "Failed to submit request.");
        setSubmitting(false);
        return;
      }

      setMessage("Your time correction request has been sent to the admin for review. Corrections will reflect on the next invoice upon approval.");
      setSubmitting(false);
      setTimeout(() => {
        setIsOpen(false);
        router.refresh();
      }, 5000);
    } catch (err: any) {
      alert(err.message || "An error occurred.");
      setSubmitting(false);
    }
  }

  if (existingRequest) {
    const status = existingRequest.status;
    let statusText = "Pending Admin Review";
    let statusColor = "bg-amber-100 text-amber-800 border-amber-300";

    if (status === "approved") {
      statusText = "Approved (Time Corrected)";
      statusColor = "bg-forest-100 text-forest-800 border-forest-300";
    } else if (status === "declined") {
      statusText = `Declined: ${existingRequest.admin_notes || "No reason provided"}`;
      statusColor = "bg-terracotta-100 text-terracotta-800 border-terracotta-300";
    }

    return (
      <div className={`p-4 rounded-2xl border text-xs font-semibold ${statusColor}`}>
        <p className="font-bold uppercase tracking-wider text-[10px] mb-1">Time Correction Request</p>
        <p>{statusText}</p>
        {status === "approved" && (
          <p className="mt-1 text-ink-600 font-medium font-sans">
            Corrections will reflect on the next invoice.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="block w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition"
      >
        Request Time Correction
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95">
            <h3 className="font-display text-lg text-ink-900 mb-2">Request Time Correction</h3>
            <p className="text-xs text-ink-500 mb-4">
              If you forgot to check out or need to correct your hours, submit the correct check-in/out times. Any approved correction will reflect on the next invoice.
            </p>

            {message ? (
              <div className="bg-forest-50 border border-forest-200 rounded-2xl p-4 text-xs text-forest-800 font-semibold mb-4">
                {message}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink-750 mb-1">Check-in Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={checkInTime}
                      onChange={(e) => setCheckInTime(e.target.value)}
                      className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-xs text-ink-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-750 mb-1">Check-out Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={checkOutTime}
                      onChange={(e) => setCheckOutTime(e.target.value)}
                      className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-xs text-ink-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-750 mb-1">Reason for correction</label>
                  <textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Forgot to check out at 5 PM because lockbox was stuck. Check-in was correct at 9 AM."
                    className="w-full bg-cream-50 border border-cream-200 rounded-2xl px-3.5 py-2.5 text-xs text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 min-h-[90px] resize-none"
                  />
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setIsOpen(false)}
                    className="flex-1 bg-cream-50 hover:bg-cream-100 border border-cream-200 text-ink-700 py-2.5 rounded-xl text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !reason.trim()}
                    className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                  >
                    {submitting ? "Sending..." : "Submit Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
