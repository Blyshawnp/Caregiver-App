"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResolveButton({ incidentId }: { incidentId: string }) {
  const [resolving, setResolving] = useState(false);
  const router = useRouter();

  async function resolve() {
    if (!confirm("Are you sure you want to resolve this incident?")) return;
    setResolving(true);
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("incidents")
      .update({ 
        status: "resolved", 
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id
      })
      .eq("id", incidentId);

    if (error) {
      alert("Error resolving incident: " + error.message);
      setResolving(false);
    } else {
      router.refresh();
    }
  }

  return (
    <button
      onClick={resolve}
      disabled={resolving}
      className="text-xs font-medium text-forest-600 hover:text-forest-700 bg-forest-50 px-2 py-1 rounded-md transition"
    >
      {resolving ? "Resolving..." : "Mark Resolved"}
    </button>
  );
}
