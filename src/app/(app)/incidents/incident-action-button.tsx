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
      className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border shadow-soft transition active:scale-[0.98] disabled:opacity-60 ${
        action === "resolve"
          ? "text-forest-700 hover:text-forest-700 bg-forest-50 border-forest-600/20 hover:bg-forest-100"
          : "text-terracotta-600 hover:text-terracotta-600 bg-terracotta-400/10 border-terracotta-600/25 hover:bg-terracotta-400/15"
      }`}
    >
      {busy ? "Working..." : label}
    </button>
  );
}
