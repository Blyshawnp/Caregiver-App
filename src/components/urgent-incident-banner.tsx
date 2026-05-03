"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { StarOfLifeIcon } from "./icons";

export default function UrgentIncidentBanner({ organizationId }: { organizationId: string }) {
  const [incident, setIncident] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchUrgent() {
      const { data } = await supabase
        .from("incidents")
        .select("id, title")
        .eq("organization_id", organizationId)
        .eq("severity", "urgent")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setIncident(data);
    }

    void fetchUrgent();

    const channel = supabase
      .channel("urgent-incidents")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incidents",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          void fetchUrgent();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId]);

  if (!incident) return null;

  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <Link
        href={`/incidents?incident=${incident.id}`}
        className="flex items-center gap-3 bg-red-600 text-cream-50 p-4 rounded-2xl shadow-soft animate-pulse transition active:scale-[0.98]"
      >
        <div className="shrink-0 w-10 h-10 rounded-xl bg-white/20 grid place-items-center">
          <StarOfLifeIcon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">Urgent Alert</p>
          <p className="font-display text-lg truncate">{incident.title}</p>
        </div>
        <span className="text-sm font-medium underline underline-offset-4">View</span>
      </Link>
    </div>
  );
}
