"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushSupported,
  savePushPreferences,
  type PushPreferences,
} from "@/lib/push-client";
import { playNotificationSound } from "@/lib/notification-sounds";

export default function NotificationSettings({
  initialPreferences,
}: {
  initialPreferences: PushPreferences;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(!!subscription))
      .catch(() => {});
  }, []);

  async function updatePreference(key: keyof PushPreferences, value: boolean) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setMessage(null);
    try {
      const saved = await savePushPreferences({ [key]: value });
      setPreferences(saved);
    } catch (error) {
      setPreferences(preferences);
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    }
  }

  async function enable() {
    setSaving(true);
    setMessage(null);
    try {
      await enablePushNotifications();
      setPermission(Notification.permission);
      setEnabled(true);
      setMessage("Push notifications are enabled on this device.");
    } catch (error) {
      setPermission(isPushSupported() ? Notification.permission : "unsupported");
      setMessage(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setSaving(false);
    }
  }

  async function disable() {
    setSaving(true);
    setMessage(null);
    try {
      await disablePushNotifications();
      setEnabled(false);
      setMessage("Push notifications are disabled on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <Link
        href="/me"
        className="text-sm text-forest-600 hover:underline mb-3 inline-block"
      >
        ← Back to Me
      </Link>

      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">
          Notification settings
        </h1>
        <p className="text-ink-500 text-sm">
          Choose what can alert this browser and which sounds the app should try
          to play while open.
        </p>
      </header>

      <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-1">
            This device
          </p>
          <p className="font-medium text-ink-900 mb-1">
            {permission === "unsupported"
              ? "Not supported"
              : permission === "denied"
                ? "Blocked by browser"
                : enabled
                  ? "Push enabled"
                  : "Push disabled"}
          </p>
          <p className="text-sm text-ink-500 mb-4">
            {permission === "denied"
              ? "Enable notifications in your browser or device settings, then return here."
              : "You can enable or disable this browser without affecting your other devices."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={enable}
              disabled={saving || permission === "unsupported" || permission === "denied"}
              className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-medium transition disabled:opacity-60"
            >
              {saving ? "Saving..." : "Enable this device"}
            </button>
            <button
              onClick={disable}
              disabled={saving || !enabled}
              className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-3 rounded-2xl text-sm font-medium transition disabled:opacity-60"
            >
              Disable
            </button>
          </div>
          {message && <p className="text-sm text-ink-500 mt-3">{message}</p>}
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
        <div className="relative flex flex-col gap-3">
          <ToggleRow
            label="Messages"
            description="New message alerts."
            checked={preferences.messages}
            onChange={(value) => updatePreference("messages", value)}
          />
          <ToggleRow
            label="Shift assignments"
            description="Shift updates, claims, releases, check-in flags, and checkout alerts."
            checked={preferences.shift_assignments}
            onChange={(value) => updatePreference("shift_assignments", value)}
          />
          <ToggleRow
            label="Trades"
            description="Trade offers, counters, approvals, and cancellations."
            checked={preferences.trades}
            onChange={(value) => updatePreference("trades", value)}
          />
          <ToggleRow
            label="Incidents"
            description="Incident and urgent safety alerts."
            checked={preferences.incidents}
            onChange={(value) => updatePreference("incidents", value)}
          />
          <ToggleRow
            label="General notifications"
            description="Other app alerts that do not fit a specific category."
            checked={preferences.general}
            onChange={(value) => updatePreference("general", value)}
          />
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
        <div className="relative flex flex-col gap-3">
          <ToggleRow
            label="Sounds"
            description="Best-effort in-app sounds while Caregiver is open."
            checked={preferences.sounds_enabled}
            onChange={(value) => updatePreference("sounds_enabled", value)}
          />
          <ToggleRow
            label="Message sound"
            description="A softer tone for new messages."
            checked={preferences.message_sound_enabled}
            onChange={(value) => updatePreference("message_sound_enabled", value)}
          />
          <ToggleRow
            label="Urgent incident sound"
            description="A repeated tone for urgent incident alerts."
            checked={preferences.urgent_incident_sound_enabled}
            onChange={(value) =>
              updatePreference("urgent_incident_sound_enabled", value)
            }
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => playNotificationSound("message")}
              className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2.5 rounded-2xl text-sm font-medium transition"
            >
              Test message
            </button>
            <button
              onClick={() => playNotificationSound("urgent")}
              className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-2.5 rounded-2xl text-sm font-medium transition"
            >
              Test urgent
            </button>
          </div>
          <p className="text-xs text-ink-500">
            Browsers may block sounds until you interact with the page. Native
            push notifications use the operating system notification sound.
          </p>
        </div>
      </section>
    </main>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-cream-200 last:border-b-0 pb-3 last:pb-0">
      <span>
        <span className="block font-medium text-ink-900">{label}</span>
        <span className="block text-xs text-ink-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-forest-600 shrink-0"
      />
    </label>
  );
}
