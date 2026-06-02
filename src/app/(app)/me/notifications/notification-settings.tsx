"use client";

import { useEffect, useState } from "react";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushDeviceStatus,
  getPushPreferences,
  isPushSupported,
  savePushPreferences,
  type PushPreferences,
} from "@/lib/push-client";
import { playNotificationSound } from "@/lib/notification-sounds";

export default function NotificationSettings({ 
  initialPreferences 
}: { 
  initialPreferences: PushPreferences 
}) {
  const [supported, setPushSupported] = useState(false);
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PushPreferences>(initialPreferences);

  useEffect(() => {
    setPushSupported(isPushSupported());
    async function init() {
      try {
        const [status, p] = await Promise.all([
          getPushDeviceStatus(),
          getPushPreferences(),
        ]);
        setDeviceEnabled(status.enabled);
        setPrefs(p);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function toggleDevice() {
    setSaving(true);
    setError(null);
    try {
      if (deviceEnabled) {
        await disablePushNotifications();
        setDeviceEnabled(false);
      } else {
        await enablePushNotifications();
        const status = await getPushDeviceStatus();
        setDeviceEnabled(status.enabled);
        if (!status.enabled) {
          setError("Notifications were permitted, but this device subscription was not saved.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update device.");
    } finally {
      setSaving(false);
    }
  }

  async function updatePref(key: keyof PushPreferences, val: boolean) {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    try {
      await savePushPreferences({ [key]: val });
    } catch {
      setPrefs(prefs);
    }
  }

  const [testLoading, setTestLoading] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pwa_last_subscription_check");
      if (stored) {
        setLastCheck(new Date(stored).toLocaleString());
      }
    }
  }, [deviceEnabled]);

  async function handleSendTest() {
    setTestLoading(true);
    setTestMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (res.ok) {
        setTestMessage("✅ Test push notification dispatched! Please check your device.");
      } else {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Failed to send test push.");
      }
    } catch (err: any) {
      setTestMessage(`❌ Error: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  }

  async function handleManualCheck() {
    setLoading(true);
    setError(null);
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sub.toJSON()),
          });
          const nowStr = new Date().toISOString();
          localStorage.setItem("pwa_last_subscription_check", nowStr);
          setLastCheck(new Date(nowStr).toLocaleString());
          setDeviceEnabled(true);
        } else {
          setDeviceEnabled(false);
          setError("No active browser push subscription found. Click Enable below.");
        }
      } else {
        setError("Service Worker not ready.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to refresh subscription.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink-900">Notifications</h1>
        <p className="text-ink-500 text-sm">Manage how you get alerts.</p>
      </header>

      <section className="bg-white rounded-3xl p-6 shadow-soft grain-overlay">
        <h2 className="font-display text-xl mb-1">Push Alerts</h2>
        <p className="text-xs text-ink-500 mb-4">
          Enable native notifications on this device to stay updated instantly.
        </p>

        <div className="bg-cream-50 p-4 rounded-2xl text-xs space-y-2 mb-4 border border-cream-200">
          <p className="font-medium text-ink-700">
            <strong>Notification status:</strong>{" "}
            {!supported ? (
              <span className="text-terracotta-600 font-semibold">Unsupported on this device</span>
            ) : deviceEnabled ? (
              <span className="text-forest-700 font-semibold">🟢 Active & Registered on this device</span>
            ) : (
              <span className="text-ink-500 font-semibold">⚪ Not active on this device</span>
            )}
          </p>
          {lastCheck && (
            <p className="text-ink-500">
              <strong>Last subscription check:</strong> {lastCheck}
            </p>
          )}
        </div>

        {loading && <p className="text-xs text-ink-500 mb-3">Checking this device...</p>}
        {error && <p className="text-xs text-terracotta-600 mb-3">{error}</p>}
        {testMessage && <p className="text-xs text-ink-700 font-semibold mb-3">{testMessage}</p>}

        {!supported ? (
          <div className="bg-cream-50 p-4 rounded-2xl text-sm text-ink-700">
            Push notifications are not supported in this browser or device.
          </div>
        ) : (
          <div className="space-y-2.5">
            <button
              onClick={toggleDevice}
              disabled={saving}
              className={`w-full py-3.5 rounded-2xl font-medium transition active:scale-[0.98] ${
                deviceEnabled
                  ? "bg-cream-200 text-ink-700 hover:bg-cream-300"
                  : "bg-forest-600 text-cream-50 hover:bg-forest-700 shadow-soft"
              }`}
            >
              {saving ? "Updating..." : deviceEnabled ? "Disable on this device" : "Enable on this device"}
            </button>

            {deviceEnabled && (
              <div className="flex gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={testLoading}
                  className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {testLoading ? "Sending test..." : "Send test notification"}
                </button>
                <button
                  type="button"
                  onClick={handleManualCheck}
                  className="bg-cream-200 hover:bg-cream-300 text-ink-750 px-4 py-2.5 rounded-xl text-xs font-semibold transition"
                >
                  Refresh subscription
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl p-6 shadow-soft grain-overlay">
        <h2 className="font-display text-xl mb-4">Alert Types</h2>
        <div className="space-y-4">
          <ToggleRow
            label="Messages"
            checked={prefs.messages}
            onChange={(v) => updatePref("messages", v)}
          />
          <ToggleRow
            label="Shift assignments"
            checked={prefs.shift_assignments}
            onChange={(v) => updatePref("shift_assignments", v)}
          />
          <ToggleRow
            label="Incidents"
            checked={prefs.incidents}
            onChange={(v) => updatePref("incidents", v)}
          />
          <ToggleRow
            label="Shift trades"
            checked={prefs.trades}
            onChange={(v) => updatePref("trades", v)}
          />
        </div>
      </section>

      <section className="bg-white rounded-3xl p-6 shadow-soft grain-overlay">
        <h2 className="font-display text-xl mb-4">Sounds</h2>
        <div className="space-y-4">
          <ToggleRow
            label="Enable notification sounds"
            checked={prefs.sounds_enabled}
            onChange={(v) => updatePref("sounds_enabled", v)}
          />
          <div className="pt-2 flex gap-2">
            <button
              onClick={() => playNotificationSound("message")}
              className="text-[10px] bg-cream-100 text-ink-700 px-3 py-1.5 rounded-full font-medium"
            >
              Test Message
            </button>
            <button
              onClick={() => playNotificationSound("urgent")}
              className="text-[10px] bg-cream-100 text-ink-700 px-3 py-1.5 rounded-full font-medium"
            >
              Test Urgent
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-ink-900">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? "bg-forest-600" : "bg-cream-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
