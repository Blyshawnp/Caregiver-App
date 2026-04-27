"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteShiftButton({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("shifts").delete().eq("id", shiftId);

    if (error) {
      alert(error.message);
      setDeleting(false);
      setConfirming(false);
      return;
    }

    router.push("/schedule");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="block w-full text-terracotta-600 hover:bg-terracotta-400/10 py-3.5 rounded-2xl font-medium transition"
      >
        Delete shift
      </button>
    );
  }

  return (
    <div className="bg-terracotta-400/10 border border-terracotta-400/30 rounded-2xl p-4">
      <p className="text-sm text-ink-900 mb-3 text-center">
        Delete this shift permanently?
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="flex-1 bg-white hover:bg-cream-50 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Yes, delete"}
        </button>
      </div>
    </div>
  );
}
