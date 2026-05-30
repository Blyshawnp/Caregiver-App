"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type PrintRequestItem = {
  id: string;
  document_id: string;
  requested_by: string;
  requested_at: string;
  status: string;
  reason: string | null;
  documents: { title: string } | null;
  profiles: { full_name: string } | null;
};

export default function PrintRequestsList({
  requests,
}: {
  requests: PrintRequestItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [denialReason, setDenialReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function handleReview(
    requestItem: PrintRequestItem,
    status: "approved" | "denied"
  ) {
    if (status === "denied" && !denialReason.trim()) {
      alert("A denial reason is required.");
      return;
    }

    setLoading(requestItem.id);
    const res = await fetch("/api/documents/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: requestItem.document_id,
        action: "review_print",
        targetUserId: requestItem.requested_by,
        status,
        reason: status === "denied" ? denialReason : null,
      }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => null);
      alert(result?.error ?? "Failed to update print request.");
      setLoading(null);
      return;
    }

    startTransition(() => {
      setDenyingId(null);
      setDenialReason("");
      setLoading(null);
      router.refresh();
    });
  }

  const pendingRequests = requests.filter((r) => r.status === "requested");

  if (pendingRequests.length === 0) return null;

  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 mb-5 border border-cream-200/50 grain-overlay">
      <div className="relative">
        <h2 className="font-display text-lg font-semibold text-ink-900 mb-3 flex items-center gap-2">
          <span>🖨️</span>
          <span>Pending Print Requests ({pendingRequests.length})</span>
        </h2>

        <ul className="space-y-3">
          {pendingRequests.map((req) => (
            <li
              key={req.id}
              className="bg-cream-50/50 p-4 rounded-2xl border border-cream-200/50 text-sm flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-ink-800">
                    {req.profiles?.full_name ?? "User"}
                  </p>
                  <p className="text-xs text-ink-500">
                    Requested to print: <span className="font-medium text-ink-700">{req.documents?.title ?? "Document"}</span>
                  </p>
                  <p className="text-[10px] text-ink-400">
                    {new Date(req.requested_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleReview(req, "approved")}
                    disabled={isPending || loading !== null}
                    className="text-xs bg-forest-600 hover:bg-forest-700 text-cream-50 px-3 py-1.5 rounded-xl font-medium transition disabled:opacity-50"
                  >
                    {loading === req.id ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={() => {
                      if (denyingId === req.id) {
                        setDenyingId(null);
                      } else {
                        setDenyingId(req.id);
                        setDenialReason("");
                      }
                    }}
                    disabled={isPending || loading !== null}
                    className="text-xs bg-cream-200 hover:bg-cream-300 text-ink-700 px-3 py-1.5 rounded-xl font-medium transition disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
              </div>

              {denyingId === req.id && (
                <div className="mt-2 bg-white p-3 rounded-xl border border-cream-200 flex flex-col gap-2">
                  <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wider">
                    Denial Reason (Required)
                  </label>
                  <input
                    type="text"
                    value={denialReason}
                    onChange={(e) => setDenialReason(e.target.value)}
                    placeholder="Enter reason for denial..."
                    className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-xs text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500/20 transition"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setDenyingId(null)}
                      className="text-[10px] bg-cream-100 hover:bg-cream-200 text-ink-700 px-2.5 py-1 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReview(req, "denied")}
                      disabled={!denialReason.trim() || isPending}
                      className="text-[10px] bg-terracotta-600 hover:bg-terracotta-700 text-cream-50 px-2.5 py-1 rounded-lg font-medium transition disabled:opacity-50"
                    >
                      Submit Denial
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
