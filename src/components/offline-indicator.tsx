"use client";

import { useEffect, useState } from "react";

export default function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-terracotta-500 text-cream-50 text-center py-1.5 text-xs font-medium pt-[env(safe-area-inset-top)]">
      You're offline. Some things may not work until you reconnect.
    </div>
  );
}
