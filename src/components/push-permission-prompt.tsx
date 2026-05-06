"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { enablePushNotifications, isPushSupported } from "@/lib/push-client";

const PROMPT_KEY = "caregiver-push-prompt";
const SNOOZE_DAYS = 7;

type PromptState = "hidden" | "ready" | "saving" | "denied" | "unsupported";

export default function PushPermissionPrompt() {
  const [state, setState] = useState<PromptState>("hidden");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      return;
    }
    if (recentlyPrompted()) return;

    const t = setTimeout(() => setState("ready"), 1800);
    return () => clearTimeout(t);
  }, []);

  async function enable() {
    markPrompted();
    setState("saving");
    setError(null);
    try {
      await enablePushNotifications();
      setState("hidden");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not enable notifications.";
      setError(message);
      setState(Notification.permission === "denied" ? "denied" : "ready");
    } finally {
      setState((current) => (current === "saving" ? "ready" : current));
    }
  }

  function dismiss() {
    markPrompted();
    setState("hidden");
  }

  if (state === "hidden" || state === "unsupported") return null;

  return (
    <div className="fixed left-3 right-3 bottom-24 z-40 max-w-md mx-auto pb-[env(safe-area-inset-bottom)]">
      <div className="bg-white border border-cream-200 rounded-3xl shadow-lifted p-4">
        <p className="font-display text-xl text-ink-900 mb-1">
          Get important alerts
        </p>
        <p className="text-sm text-ink-500 mb-4">
          Carer Vista Pro can send native notifications for messages, shift
          updates, trades, and urgent incidents.
        </p>
        {error && (
          <p className="text-xs text-terracotta-600 mb-3">{error}</p>
        )}
        {state === "denied" ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-terracotta-600">
              Notifications are blocked in this browser. You can enable them in
              browser or device settings, then manage options here.
            </p>
            <Link
              href="/me/notifications"
              className="w-full text-center bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-2xl text-sm font-medium transition"
            >
              Notification settings
            </Link>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={dismiss}
              className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2.5 rounded-2xl text-sm font-medium transition"
            >
              Not now
            </button>
            <button
              onClick={enable}
              disabled={state === "saving"}
              className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-2xl text-sm font-medium transition disabled:opacity-60"
            >
              {state === "saving" ? "Enabling..." : "Enable alerts"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function recentlyPrompted() {
  try {
    const raw = localStorage.getItem(PROMPT_KEY);
    if (!raw) return false;
    const days = (Date.now() - Number(raw)) / 86_400_000;
    return days < SNOOZE_DAYS;
  } catch {
    return false;
  }
}

function markPrompted() {
  try {
    localStorage.setItem(PROMPT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
