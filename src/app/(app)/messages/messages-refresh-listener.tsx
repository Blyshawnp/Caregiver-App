"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MessagesRefreshListener({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => router.refresh(), 150);
    };

    const incoming = supabase
      .channel(`messages-list-incoming-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        refreshSoon
      )
      .subscribe();

    const outgoing = supabase
      .channel(`messages-list-outgoing-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${userId}`,
        },
        refreshSoon
      )
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      void supabase.removeChannel(incoming);
      void supabase.removeChannel(outgoing);
    };
  }, [router, userId]);

  return null;
}
