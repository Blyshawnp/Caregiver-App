"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { soundForNotificationKind } from "@/lib/push-categories";
import { playNotificationSound, playNotificationTone } from "@/lib/notification-sounds";
import { BellIcon } from "./icons";

export default function NotificationBell({
  initialCount,
  userId,
  label = "Notifications",
}: {
  initialCount: number;
  userId: string;
  label?: string;
}) {
  const [count, setCount] = useState(initialCount);
  const [activeUrgentAlert, setActiveUrgentAlert] = useState<{ id: string; title: string; body: string } | null>(null);
  const [soundIntervalId, setSoundIntervalId] = useState<number | null>(null);

  const acknowledgeAlert = () => {
    if (soundIntervalId) {
      window.clearInterval(soundIntervalId);
      setSoundIntervalId(null);
    }
    setActiveUrgentAlert(null);
  };

  useEffect(() => {
    return () => {
      if (soundIntervalId) {
        window.clearInterval(soundIntervalId);
      }
    };
  }, [soundIntervalId]);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    void refetchCount();

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
            const data = payload.new as {
              id: string;
              kind?: string;
              title?: string;
              body?: string;
            };
            const sound = soundForNotificationKind(data.kind || "general");
            void playNotificationSound(sound).catch(() => {});

            // Check if it is an urgent alert
            const isUrgent =
              data.kind === "urgent" ||
              data.kind === "urgent_alert" ||
              (data.kind &&
                (data.kind.includes("urgent") ||
                  data.kind.includes("emergency") ||
                  data.kind.includes("incident")));

            if (isUrgent) {
              const start = localStorage.getItem("pwa_quiet_hours_start");
              const end = localStorage.getItem("pwa_quiet_hours_end");
              const inQuiet = isQuietHoursNow(start, end);
              const bypass = localStorage.getItem("pwa_urgent_override_quiet_hours") !== "false";

              if (!inQuiet || bypass) {
                // Clear any existing interval before starting a new one
                if (soundIntervalId) {
                  window.clearInterval(soundIntervalId);
                  setSoundIntervalId(null);
                }

                setActiveUrgentAlert({
                  id: data.id || Math.random().toString(),
                  title: data.title || "Urgent Alert",
                  body: data.body || "Please check details.",
                });

                if (localStorage.getItem("pwa_urgent_alerts_repeat") === "true") {
                  let counter = 0;
                  const playAlert = () => {
                    const volume = localStorage.getItem("pwa_in_app_alert_volume")
                      ? parseFloat(localStorage.getItem("pwa_in_app_alert_volume")!)
                      : 0.9;
                    void playNotificationTone("urgent_tone", volume).catch(() => {});
                    counter++;
                    if (counter >= 10) {
                      // Stop repeating after 10 plays (approx 30s)
                      window.clearInterval(intervalId);
                    }
                  };
                  // Play immediately once
                  playAlert();
                  const intervalId = window.setInterval(playAlert, 3000);
                  setSoundIntervalId(intervalId);
                }
              }
            }

            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(data.title || "Carer Vista Pro", {
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
        .eq("is_read", false)
        .is("dismissed_at", null);
      setCount(c ?? 0);
    }

    function isQuietHoursNow(start: string | null, end: string | null) {
      if (!start || !end) return false;
      const toMinutes = (val: string) => {
        const [h, m] = val.split(":").map(Number);
        return !Number.isFinite(h) || !Number.isFinite(m) ? null : h * 60 + m;
      };
      const startMinutes = toMinutes(start);
      const endMinutes = toMinutes(end);
      if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return false;
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (startMinutes < endMinutes) {
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
      }
      return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }

    window.addEventListener("notifications:changed", refetchCount);
    window.addEventListener("focus", refetchCount);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const poll = window.setInterval(refetchCount, 30_000);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("notifications:changed", refetchCount);
      window.removeEventListener("focus", refetchCount);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void supabase.removeChannel(channel);
    };

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void refetchCount();
    }
  }, [userId, soundIntervalId]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  return (
    <>
      <Link
        href="/notifications"
        aria-label={label}
        className="relative w-10 h-10 rounded-full grid place-items-center text-ink-700 hover:bg-cream-200 transition active:scale-95"
      >
        <BellIcon size={20} />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-terracotta-500 text-cream-50 text-[10px] font-bold flex items-center justify-center px-1 border-2 border-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>

      {activeUrgentAlert && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-white/95 backdrop-blur-md border border-terracotta-200 rounded-3xl p-5 shadow-xl flex flex-col gap-3.5 ring-2 ring-terracotta-500/10">
          <div className="flex items-start gap-3">
            <span className="text-terracotta-600 text-2xl flex-shrink-0 animate-pulse">🚨</span>
            <div>
              <h4 className="font-display text-base font-bold text-ink-900 leading-snug">
                {activeUrgentAlert.title}
              </h4>
              <p className="text-xs text-ink-600 mt-1 leading-relaxed">{activeUrgentAlert.body}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={acknowledgeAlert}
            className="w-full bg-terracotta-600 hover:bg-terracotta-700 text-cream-50 py-2.5 rounded-2xl text-xs font-semibold shadow-soft active:scale-[0.98] transition"
          >
            Acknowledge & Mute
          </button>
        </div>
      )}
    </>
  );
}
