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
import { playNotificationTone } from "@/lib/notification-sounds";
import {
  NOTIFICATION_CATEGORY_OPTIONS,
  TONE_OPTIONS,
  normalizeCategoryPreferences,
  type NotificationCategoryPreference,
  type NotificationPreferenceCategory,
} from "@/lib/notification-preferences";

type PushDiagnostics = {
  browserPermission: string;
  serviceWorkerRegistered: boolean;
  serviceWorkerActive: boolean;
  subscriptionSaved: boolean;
  lastSubscriptionUpdate: string | null;
  platform: string;
  installedPwa: boolean;
  browser: string;
};

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
  const [prefs, setPrefs] = useState<PushPreferences>(normalizePrefs(initialPreferences));
  const [diagnostics, setDiagnostics] = useState<PushDiagnostics>({
    browserPermission: "unknown",
    serviceWorkerRegistered: false,
    serviceWorkerActive: false,
    subscriptionSaved: false,
    lastSubscriptionUpdate: null,
    platform: "unknown",
    installedPwa: false,
    browser: "unknown",
  });

  useEffect(() => {
    setPushSupported(isPushSupported());
    async function init() {
      try {
        const [status, p] = await Promise.all([
          getPushDeviceStatus(),
          getPushPreferences(),
        ]);
        setDeviceEnabled(status.enabled);
        setPrefs(normalizePrefs(p));
        await refreshDiagnostics(status);
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
        await refreshDiagnostics(status);
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

  async function updatePreferencePatch(update: Partial<PushPreferences>) {
    const next = normalizePrefs({ ...prefs, ...update });
    setPrefs(next);
    try {
      const saved = await savePushPreferences(update);
      setPrefs(normalizePrefs(saved));
    } catch {
      setPrefs(prefs);
    }
  }

  async function updateCategoryPreference(
    category: NotificationPreferenceCategory,
    patch: Partial<NotificationCategoryPreference>
  ) {
    if (
      category === "urgent_alerts" &&
      (patch.enabled === false || patch.pushEnabled === false) &&
      !window.confirm(
        "Urgent and emergency alerts may include time-sensitive safety information. Disable this only if you have another reliable alert path."
      )
    ) {
      return;
    }

    const categoryPreferences = normalizeCategoryPreferences(prefs.category_preferences);
    await updatePreferencePatch({
      category_preferences: {
        ...categoryPreferences,
        [category]: {
          ...categoryPreferences[category],
          ...patch,
        },
      },
    });
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
      const d = await res.json().catch(() => null);
      if (res.ok) {
        setTestMessage(
          `Test push accepted by browser push service (${d?.diagnostics?.delivered ?? 1} delivered). If it does not appear, check OS/browser notification settings, battery optimization, or Focus/Do Not Disturb.`
        );
      } else {
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
          await refreshDiagnostics();
        } else {
          setDeviceEnabled(false);
          await refreshDiagnostics();
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

  async function refreshDiagnostics(prefetchedStatus?: Awaited<ReturnType<typeof getPushDeviceStatus>>) {
    if (typeof window === "undefined") return;
    const nav = window.navigator as Navigator & { standalone?: boolean; userAgentData?: { platform?: string } };
    const installedPwa =
      nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    const browser = navigator.userAgent;
    let registration: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      registration = await navigator.serviceWorker.getRegistration("/");
    }
    const status = prefetchedStatus ?? (await getPushDeviceStatus().catch(() => null));
    setDiagnostics({
      browserPermission: "Notification" in window ? Notification.permission : "unsupported",
      serviceWorkerRegistered: !!registration,
      serviceWorkerActive: !!registration?.active,
      subscriptionSaved: !!status?.enabled,
      lastSubscriptionUpdate: status?.lastSeenAt ?? status?.updatedAt ?? null,
      platform: status?.platform ?? nav.userAgentData?.platform ?? (browser.includes("Android") ? "android" : browser.includes("iPhone") || browser.includes("iPad") ? "ios" : "desktop"),
      installedPwa,
      browser,
    });
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

        <div className="bg-white/70 border border-cream-200 rounded-2xl p-4 text-xs text-ink-600 mb-4">
          <p className="font-semibold text-ink-800 mb-2">Notification diagnostics</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            <Diag label="Browser permission" value={diagnostics.browserPermission} />
            <Diag label="Service worker registered" value={diagnostics.serviceWorkerRegistered ? "Yes" : "No"} />
            <Diag label="Service worker active" value={diagnostics.serviceWorkerActive ? "Yes" : "No"} />
            <Diag label="Push subscription saved" value={diagnostics.subscriptionSaved ? "Yes" : "No"} />
            <Diag
              label="Last subscription update"
              value={diagnostics.lastSubscriptionUpdate ? new Date(diagnostics.lastSubscriptionUpdate).toLocaleString() : "Not recorded"}
            />
            <Diag label="Platform/browser" value={`${diagnostics.platform} · ${diagnostics.browser.slice(0, 42)}`} />
            <Diag label="Installed PWA mode" value={diagnostics.installedPwa ? "Yes" : "No"} />
          </dl>
          <p className="mt-3 text-[11px] text-ink-500">
            If a test is accepted but does not appear, check OS notification permission, Focus or Do Not Disturb,
            Android battery optimization, expired subscriptions, and whether iPhone/iPad users opened the installed Home Screen app.
          </p>
        </div>

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
        <h2 className="font-display text-xl mb-2">Notification categories</h2>
        <p className="text-xs text-ink-500 mb-4">
          PWA push notifications cannot guarantee phone-level custom sounds. Tone choices below are in-app sounds that play after browser audio is allowed.
        </p>
        <div className="space-y-4">
          <ToggleRow
            label="Enable all in-app sounds"
            checked={prefs.sounds_enabled}
            onChange={(v) => updatePref("sounds_enabled", v)}
          />
          <ToggleRow
            label="Use privacy-safe push text"
            checked={prefs.privacy_safe_bodies}
            onChange={(v) => updatePreferencePatch({ privacy_safe_bodies: v })}
          />
          <ToggleRow
            label="Let urgent alerts bypass quiet hours"
            checked={prefs.urgent_override_quiet_hours}
            onChange={(v) => updatePreferencePatch({ urgent_override_quiet_hours: v })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-ink-700">
              Quiet hours start
              <input
                type="time"
                value={prefs.quiet_hours_start?.slice(0, 5) ?? ""}
                onChange={(event) =>
                  updatePreferencePatch({ quiet_hours_start: event.target.value || null })
                }
                className="mt-1 w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2"
              />
            </label>
            <label className="text-xs font-semibold text-ink-700">
              Quiet hours end
              <input
                type="time"
                value={prefs.quiet_hours_end?.slice(0, 5) ?? ""}
                onChange={(event) =>
                  updatePreferencePatch({ quiet_hours_end: event.target.value || null })
                }
                className="mt-1 w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2"
              />
            </label>
          </div>

          <div className="space-y-3 pt-2">
            {NOTIFICATION_CATEGORY_OPTIONS.map((category) => {
              const categoryPrefs = normalizeCategoryPreferences(prefs.category_preferences);
              const current = categoryPrefs[category.id];
              return (
                <div
                  key={category.id}
                  className="rounded-2xl border border-cream-200 bg-cream-50/60 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-ink-900">{category.label}</h3>
                      <p className="text-[11px] text-ink-500">{category.description}</p>
                    </div>
                    {category.urgent && (
                      <span className="rounded-full bg-terracotta-100 text-terracotta-700 px-2 py-1 text-[10px] font-semibold">
                        Safety
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ToggleRow
                      label="Enabled"
                      checked={current.enabled}
                      onChange={(v) => updateCategoryPreference(category.id, { enabled: v })}
                    />
                    <ToggleRow
                      label="Push"
                      checked={current.pushEnabled}
                      onChange={(v) => updateCategoryPreference(category.id, { pushEnabled: v })}
                    />
                    <ToggleRow
                      label="In-app sound"
                      checked={current.inAppSoundEnabled}
                      onChange={(v) =>
                        updateCategoryPreference(category.id, { inAppSoundEnabled: v })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                    <label className="text-xs font-semibold text-ink-700">
                      Tone
                      <select
                        value={current.tone}
                        onChange={(event) =>
                          updateCategoryPreference(category.id, {
                            tone: event.target.value as NotificationCategoryPreference["tone"],
                          })
                        }
                        className="mt-1 w-full bg-white border border-cream-200 rounded-xl px-3 py-2"
                      >
                        {TONE_OPTIONS.map((tone) => (
                          <option key={tone.id} value={tone.id}>
                            {tone.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-ink-700">
                      Volume ({Math.round(current.volume * 100)}%)
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={current.volume}
                        onChange={(event) =>
                          updateCategoryPreference(category.id, {
                            volume: Number(event.target.value),
                          })
                        }
                        className="mt-3 w-full accent-forest-600"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => playNotificationTone(current.tone, current.volume)}
                      className="bg-cream-200 hover:bg-cream-300 text-ink-700 px-3 py-2 rounded-xl text-xs font-semibold"
                    >
                      Play test
                    </button>
                  </div>
                  <ToggleRow
                    label="Allow quiet hours for this category"
                    checked={current.quietHoursAllowed}
                    onChange={(v) =>
                      updateCategoryPreference(category.id, { quietHoursAllowed: v })
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function normalizePrefs(prefs: PushPreferences): PushPreferences {
  return {
    ...prefs,
    category_preferences: normalizeCategoryPreferences(prefs.category_preferences),
    privacy_safe_bodies: prefs.privacy_safe_bodies ?? true,
    quiet_hours_start: prefs.quiet_hours_start ?? null,
    quiet_hours_end: prefs.quiet_hours_end ?? null,
    urgent_override_quiet_hours: prefs.urgent_override_quiet_hours ?? true,
  };
}

function Diag({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="font-medium text-ink-500">{label}</dt>
      <dd className="text-right text-ink-800">{value}</dd>
    </div>
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
