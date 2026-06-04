"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RestartTutorialButton() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function restart() {
    setSaving(true);
    await fetch("/api/tutorial/complete", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    setSaving(false);
    router.push("/home");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={restart}
      disabled={saving}
      className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
    >
      {saving ? "Restarting..." : "Restart tutorial"}
    </button>
  );
}
