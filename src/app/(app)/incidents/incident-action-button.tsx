"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function IncidentActionButton({
  incidentId,
  action,
}: {
  incidentId: string;
  action: "resolve" | "archive";
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const label = action === "resolve" ? "Mark Resolved" : "Archive";

  async function runAction() {
    const prompt =
      action === "resolve"
        ? "Are you sure you want to resolve this incident?"
        : "Archive this incident? It will move out of the active list.";
    if (!confirm(prompt)) return;

    setBusy(true);
    const response = await fetch("/api/incidents/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentId, action }),
    });
    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    setBusy(false);
    if (!response.ok) {
      alert(result?.error ?? `Could not ${action} incident.`);
      return;
    }

    router.refresh();
  }

  return (
    <button
      onClick={runAction}
      disabled={busy}
      className={`text-xs font-medium px-2 py-1 rounded-md transition disabled:opacity-60 ${
        action === "resolve"
          ? "text-forest-600 hover:text-forest-700 bg-forest-50"
          : "text-terracotta-600 hover:text-terracotta-700 bg-terracotta-50"
      }`}
    >
      {busy ? "Working..." : label}
    </button>
  );
}
