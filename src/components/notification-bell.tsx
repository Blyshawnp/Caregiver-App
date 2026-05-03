"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { soundForNotificationKind } from "@/lib/push-categories";
import { playNotificationSound } from "@/lib/notification-sounds";
import { BellIcon } from "./icons";

export default function NotificationBell({
  initialCount,
  userId,
}: {
  initialCount: number;
  userId: string;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`realtime-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          void refetchCount();

          if (payload.eventType === "INSERT") {
             const data = payload.new as { kind?: string; title?: string; body?: string };
             const sound = soundForNotificationKind(data.kind || "general");
             void playNotificationSound(sound).catch(() => {});

             if ("Notification" in window && Notification.permission === "granted") {
                new Notification(data.title || "Caregiver", {
                  body: data.body || "",
                  icon: "/icon-192.png",
                });
             }
          }
        }
      )
      .subscribe();

    async function refetchCount() {
      const { count: c } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("is_read", false);
      setCount(c ?? 0);
    }

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link
      href="/notifications"
      className="relative w-10 h-10 rounded-full grid place-items-center text-ink-700 hover:bg-cream-200 transition active:scale-95"
    >
      <BellIcon size={20} />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-terracotta-500 text-cream-50 text-[10px] font-bold flex items-center justify-center px-1 border-2 border-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
