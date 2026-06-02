"use client";

import { useEffect } from "react";
import { isPushSupported } from "@/lib/push-client";

export default function PwaHealthCheck() {
  useEffect(() => {
    async function checkSubscription() {
      if (!isPushSupported()) return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          // Send to server to refresh/update last_seen_at
          await fetch("/api/push/subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sub.toJSON()),
          });
          localStorage.setItem("pwa_last_subscription_check", new Date().toISOString());
        }
      } catch (err) {
        console.error("Failed to auto-refresh push subscription:", err);
      }
    }
    
    // Run the check on load/mount
    checkSubscription();
  }, []);

  return null;
}
