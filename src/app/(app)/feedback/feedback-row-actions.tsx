"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function FeedbackRowActions({
  feedbackId,
  feedbackType,
  caregiverId,
  status,
}: {
  feedbackId: string;
  feedbackType: string;
  caregiverId: string | null;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function handleAction(action: "review" | "resolve" | "dismiss" | "share") {
    setLoadingAction(action);
    const res = await fetch("/api/feedback/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackId, action }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => null);
      alert(result?.error ?? `Failed to perform action: ${action}`);
      setLoadingAction(null);
      return;
    }

    startTransition(() => {
      router.refresh();
      setLoadingAction(null);
    });
  }

  const isPositive = feedbackType === "commendation" || feedbackType === "appreciation";
  const canShare = isPositive && caregiverId && status !== "shared_with_caregiver" && status !== "resolved" && status !== "dismissed";

  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-cream-100">
      {status === "submitted" && (
        <button
          onClick={() => handleAction("review")}
          disabled={isPending}
          className="text-xs bg-forest-50 text-forest-700 hover:bg-forest-100 px-3 py-1.5 rounded-xl font-medium transition disabled:opacity-50"
        >
          {loadingAction === "review" ? "Reviewing..." : "Mark Reviewed"}
        </button>
      )}

      {status !== "resolved" && status !== "dismissed" && (
        <>
          <button
            onClick={() => handleAction("resolve")}
            disabled={isPending}
            className="text-xs bg-forest-600 hover:bg-forest-700 text-cream-50 px-3 py-1.5 rounded-xl font-medium transition disabled:opacity-50"
          >
            {loadingAction === "resolve" ? "Resolving..." : "Resolve"}
          </button>
          <button
            onClick={() => handleAction("dismiss")}
            disabled={isPending}
            className="text-xs bg-cream-100 hover:bg-cream-200 text-ink-700 px-3 py-1.5 rounded-xl font-medium transition disabled:opacity-50"
          >
            {loadingAction === "dismiss" ? "Dismissing..." : "Dismiss"}
          </button>
        </>
      )}

      {canShare && (
        <button
          onClick={() => handleAction("share")}
          disabled={isPending}
          className="text-xs bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 px-3 py-1.5 rounded-xl font-medium transition disabled:opacity-50"
        >
          {loadingAction === "share" ? "Sharing..." : "Share with Caregiver"}
        </button>
      )}
    </div>
  );
}
