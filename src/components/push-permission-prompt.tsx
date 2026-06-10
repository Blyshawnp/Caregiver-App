"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { enablePushNotifications, isPushSupported } from "@/lib/push-client";

export const ALERT_PROMPT_DISMISSED_UNTIL_KEY = "cvp_alert_prompt_dismissed_until";
export const ALERT_PROMPT_SESSION_DISMISSED_KEY = "cvp_alert_prompt_session_dismissed";
export const ALERT_PROMPT_DISMISSED_EVENT = "cvp-alert-prompt-dismissed";

const LEGACY_PROMPT_KEY = "caregiver-push-prompt";
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
      notifyPromptClosed();
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
    notifyPromptClosed();
  }

  if (state === "hidden" || state === "unsupported") return null;

  return (
    <div className="fixed left-3 right-3 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-40 max-w-md mx-auto">
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
    if (sessionStorage.getItem(ALERT_PROMPT_SESSION_DISMISSED_KEY) === "true") {
      return true;
    }

    const dismissedUntil = localStorage.getItem(ALERT_PROMPT_DISMISSED_UNTIL_KEY);
    if (dismissedUntil) {
      const until = Number(dismissedUntil);
      if (!Number.isNaN(until) && Date.now() < until) return true;
    }

    const legacyRaw = localStorage.getItem(LEGACY_PROMPT_KEY);
    if (!legacyRaw) return false;
    const legacyDays = (Date.now() - Number(legacyRaw)) / 86_400_000;
    return legacyDays < SNOOZE_DAYS;
  } catch {
    return false;
  }
}

function markPrompted() {
  try {
    sessionStorage.setItem(ALERT_PROMPT_SESSION_DISMISSED_KEY, "true");
    localStorage.setItem(
      ALERT_PROMPT_DISMISSED_UNTIL_KEY,
      String(Date.now() + SNOOZE_DAYS * 86_400_000)
    );
  } catch {
    /* ignore */
  }
}

function notifyPromptClosed() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ALERT_PROMPT_DISMISSED_EVENT));
  window.dispatchEvent(new Event("push-prompt-dismissed"));
}
