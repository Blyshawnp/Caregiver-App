"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

    // Subscribe to inserts on notifications for this user.
    // When a new notification arrives, bump the badge count and try to
    // play a soft sound + a system notification (if permission granted).
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          setCount((c) => c + 1);

          // Try to play a short beep (best effort, may be blocked)
          try {
            const audio = new Audio(
              "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
            );
            void audio.play().catch(() => {});
          } catch {
            /* ignore */
          }

          // Try a system-level notification (requires permission already granted)
          try {
            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              const data = payload.new as {
                title?: string;
                body?: string;
              };
              new Notification(data.title ?? "Caregiver", {
                body: data.body ?? "",
                icon: "/icon-192.png",
                badge: "/icon-192.png",
              });
            }
          } catch {
            /* ignore */
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          // When marking-as-read happens, refetch count to stay accurate
          void refetchCount();
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

  // Sync if initialCount changes (page navigation re-renders parent)
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  return (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className="relative w-10 h-10 rounded-full grid place-items-center text-ink-700 hover:bg-cream-200 transition active:scale-95"
    >
      <BellIcon size={20} />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-terracotta-500 text-cream-50 text-[10px] font-medium flex items-center justify-center px-1">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
