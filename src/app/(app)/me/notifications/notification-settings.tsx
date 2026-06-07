"use client";

import { useEffect, useState } from "react";
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentBrowserPushSubscription,
  getLastPushRefreshDiagnostics,
  getLastPushSaveDiagnostics,
  getPushDeviceId,
  getPushDeviceStatus,
  getPushPreferences,
  getPushSubscriptionApplicationServerKeyFingerprint,
  getPushSubscriptionKeys,
  isPushSupported,
  refreshPushSubscription,
  saveCurrentPushSubscription,
  savePushPreferences,
  type PushPreferences,
  type PushRefreshDiagnostics,
  type PushSaveDiagnostics,
} from "@/lib/push-client";
import { playNotificationTone } from "@/lib/notification-sounds";
import {
  NOTIFICATION_CATEGORY_OPTIONS,
  TONE_OPTIONS,
  normalizeCategoryPreferences,
  type NotificationCategoryPreference,
  type NotificationPreferenceCategory,
} from "@/lib/notification-preferences";
import { getVapidFingerprint } from "@/lib/vapid-helper";

type PushDiagnostics = {
  browserPermission: string;
  serviceWorkerRegistered: boolean;
  serviceWorkerActive: boolean;
  browserSubscriptionExists: boolean;
  deviceId: string;
  subscriptionSaved: boolean;
  subscriptionActive: boolean;
  activeColumn: string | null;
  rawIsActive: boolean | null;
  rawActive: boolean | null;
  statusValue: string | null;
  selectedSubscriptionId: string | null;
  subscriptionEndpointPresent: boolean;
  subscriptionKeysPresent: boolean;
  subscriptionKeysMatch: boolean | null;
  endpointMatch: boolean | null;
  vapidKeyMatch: boolean;
  currentAppPublicKeyFingerprint: string;
  browserSubscriptionApplicationServerKeyFingerprint: string | null;
  browserSubscriptionCreatedWithCurrentKey: boolean | null;
  savedSubscriptionFingerprint: string | null;
  savedSubscriptionFingerprintStatus: string | null;
  serverSenderPublicKeyFingerprint: string | null;
  serverPrivateKeyConfigured: boolean;
  vapidSubjectConfigured: boolean;
  serverKeyPairValid: boolean;
  serverVapidError: string | null;
  serverVapidMismatch: boolean;
  lastSubscriptionUpdate: string | null;
  lastTestPushResult: string | null;
  lastTestProviderStatus: string | null;
  platform: string;
  installedPwa: boolean;
  browser: string;
  lastSaveDiagnostics: PushSaveDiagnostics | null;
  lastRefreshDiagnostics: PushRefreshDiagnostics | null;
  installPromptDismissedUntil?: string | null;
  installPromptNeverShow?: boolean;
  installedPwaMode?: boolean;
  // Local display test fields
  localDisplayTestAttempted: string;
  localDisplayTestResult: string;
  localDisplayTestError: string | null;
  // Service Worker Trace fields
  swInstallTime: string;
  swActivateTime: string;
  lastSwPushReceivedTime: string;
  lastSwPushPayload: string;
  lastSwPushParseResult: string;
  lastSwPushParseError: string | null;
  lastSwShowNotificationAttemptedTime: string;
  lastSwShowNotificationResult: string;
  lastSwShowNotificationError: string | null;
  lastSwNotificationTitle: string;
  lastSwNotificationTag: string;
  lastSwClickTime: string;
  lastSwClickUrl: string;
  // Install Prompt Advanced fields
  installPromptInstalledPwaModeDetected: boolean | null;
  installPromptBeforeinstallpromptAvailable: boolean | null;
  installPromptNeverShowVal: boolean | null;
  installPromptDismissedUntilVal: string | null;
  installPromptSessionDismissed: boolean | null;
  installPromptCurrentRoute: string | null;
  installPromptReasonHidden: string | null;
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [swStatus, setSwStatus] = useState<
    | "checking"
    | "unsupported"
    | "installing"
    | "needs_refresh"
    | "ready"
    | "permission_needed"
    | "ready_to_subscribe"
  >("checking");

  const [localTestLoading, setLocalTestLoading] = useState(false);
  const [localTestMessage, setLocalTestMessage] = useState<string | null>(null);

  const [diagnostics, setDiagnostics] = useState<PushDiagnostics>({
    browserPermission: "unknown",
    serviceWorkerRegistered: false,
    serviceWorkerActive: false,
    browserSubscriptionExists: false,
    deviceId: "",
    subscriptionSaved: false,
    subscriptionActive: false,
    activeColumn: null,
    rawIsActive: null,
    rawActive: null,
    statusValue: null,
    selectedSubscriptionId: null,
    subscriptionEndpointPresent: false,
    subscriptionKeysPresent: false,
    subscriptionKeysMatch: null,
    endpointMatch: null,
    vapidKeyMatch: false,
    currentAppPublicKeyFingerprint: "",
    browserSubscriptionApplicationServerKeyFingerprint: null,
    browserSubscriptionCreatedWithCurrentKey: null,
    savedSubscriptionFingerprint: null,
    savedSubscriptionFingerprintStatus: null,
    serverSenderPublicKeyFingerprint: null,
    serverPrivateKeyConfigured: false,
    vapidSubjectConfigured: false,
    serverKeyPairValid: false,
    serverVapidError: null,
    serverVapidMismatch: false,
    lastSubscriptionUpdate: null,
    lastTestPushResult: "Not run",
    lastTestProviderStatus: null,
    platform: "unknown",
    installedPwa: false,
    browser: "unknown",
    lastSaveDiagnostics: null,
    lastRefreshDiagnostics: null,
    installPromptDismissedUntil: null,
    installPromptNeverShow: false,
    installedPwaMode: false,
    // Local display test fields
    localDisplayTestAttempted: "None",
    localDisplayTestResult: "Not run",
    localDisplayTestError: null,
    // Service Worker Trace fields
    swInstallTime: "Not recorded",
    swActivateTime: "Not recorded",
    lastSwPushReceivedTime: "Not recorded",
    lastSwPushPayload: "None",
    lastSwPushParseResult: "Not run",
    lastSwPushParseError: null,
    lastSwShowNotificationAttemptedTime: "Not recorded",
    lastSwShowNotificationResult: "Not run",
    lastSwShowNotificationError: null,
    lastSwNotificationTitle: "None",
    lastSwNotificationTag: "None",
    lastSwClickTime: "Not recorded",
    lastSwClickUrl: "None",
    // Install Prompt Advanced fields
    installPromptInstalledPwaModeDetected: null,
    installPromptBeforeinstallpromptAvailable: null,
    installPromptNeverShowVal: null,
    installPromptDismissedUntilVal: null,
    installPromptSessionDismissed: null,
    installPromptCurrentRoute: null,
    installPromptReasonHidden: null,
  });

  const [inAppAlertSound, setInAppAlertSound] = useState("default");
  const [inAppAlertVolume, setInAppAlertVolume] = useState(0.8);
  const [urgentAlertsRepeat, setUrgentAlertsRepeat] = useState(true);

  // Monitor service worker controller change and readiness
  async function updateSwStatus() {
    if (!isPushSupported()) {
      setSwStatus("unsupported");
      return;
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) {
        setSwStatus("installing");
        navigator.serviceWorker.register("/sw.js")
          .then(() => updateSwStatus())
          .catch(() => setSwStatus("unsupported"));
        return;
      }

      if (reg.installing) {
        setSwStatus("installing");
        reg.installing.addEventListener("statechange", () => updateSwStatus());
        return;
      }

      if (reg.waiting && !reg.active) {
        setSwStatus("installing");
        reg.waiting.addEventListener("statechange", () => updateSwStatus());
        return;
      }

      if (!reg.active) {
        setSwStatus("installing");
        return;
      }

      // Active. Check controller.
      if (!navigator.serviceWorker.controller) {
        setSwStatus("needs_refresh");
        return;
      }

      // Controller is ready. Check notification permission.
      if (Notification.permission === "default") {
        setSwStatus("permission_needed");
      } else if (Notification.permission === "denied") {
        setSwStatus("unsupported");
      } else {
        setSwStatus("ready_to_subscribe");
      }
    } catch {
      setSwStatus("unsupported");
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    updateSwStatus();
    const handleControllerChange = () => {
      updateSwStatus();
      refreshDiagnostics();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  useEffect(() => {
    setPushSupported(isPushSupported());
    
    if (typeof window !== "undefined") {
      setInAppAlertSound(localStorage.getItem("pwa_in_app_alert_sound") || "default");
      setInAppAlertVolume(localStorage.getItem("pwa_in_app_alert_volume") ? parseFloat(localStorage.getItem("pwa_in_app_alert_volume")!) : 0.8);
      setUrgentAlertsRepeat(localStorage.getItem("pwa_urgent_alerts_repeat") !== "false");
    }

    async function init() {
      try {
        const [status, p] = await Promise.all([
          getPushDeviceStatus(),
          getPushPreferences(),
        ]);
        setDeviceEnabled(status.enabled);
        setPrefs(normalizePrefs(p));
        
        if (typeof window !== "undefined") {
          if (p.quiet_hours_start) localStorage.setItem("pwa_quiet_hours_start", p.quiet_hours_start);
          if (p.quiet_hours_end) localStorage.setItem("pwa_quiet_hours_end", p.quiet_hours_end);
          localStorage.setItem("pwa_urgent_override_quiet_hours", String(p.urgent_override_quiet_hours ?? true));
        }

        await refreshDiagnostics(status);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  function mapErrorToSafeReason(err: any): string {
    const msg = err?.message || String(err);
    if (msg.includes("unsupported") || msg.includes("not supported")) return "unsupported";
    if (msg.includes("HTTPS")) return "unsupported";
    if (msg.includes("blocked") || msg.includes("dismissed") || msg.includes("permission")) return "permission denied";
    if (msg.includes("registration") || msg.includes("timed out") && msg.includes("register")) return "registration failed";
    if (msg.includes("still starting") || msg.includes("active worker missing")) return "active worker missing";
    if (msg === "page_not_controlled" || msg.includes("controller")) return "page not controlled yet";
    if (msg.includes("subscribe") || msg.includes("subscription timed out")) return "subscribe failed";
    if (msg.includes("save") || msg.includes("Save") || msg.includes("database") || msg.includes("server could not save")) return "save failed";
    return msg;
  }

  async function toggleDevice() {
    setSaving(true);
    setError(null);
    try {
      if (deviceEnabled) {
        await disablePushNotifications();
        setDeviceEnabled(false);
        await refreshDiagnostics();
      } else {
        const subscription = await enablePushNotifications();
        const status = await getPushDeviceStatus(subscription.endpoint, getPushSubscriptionKeys(subscription));
        setDeviceEnabled(status.enabled);
        await refreshDiagnostics(status);
        if (!status.enabled) {
          setError("Notifications were permitted, but this device subscription was not saved.");
        }
      }
    } catch (err) {
      setError(mapErrorToSafeReason(err));
    } finally {
      setSaving(false);
      updateSwStatus();
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

    if (typeof window !== "undefined") {
      if (update.quiet_hours_start !== undefined) {
        if (update.quiet_hours_start) localStorage.setItem("pwa_quiet_hours_start", update.quiet_hours_start);
        else localStorage.removeItem("pwa_quiet_hours_start");
      }
      if (update.quiet_hours_end !== undefined) {
        if (update.quiet_hours_end) localStorage.setItem("pwa_quiet_hours_end", update.quiet_hours_end);
        else localStorage.removeItem("pwa_quiet_hours_end");
      }
      if (update.urgent_override_quiet_hours !== undefined) {
        localStorage.setItem("pwa_urgent_override_quiet_hours", String(update.urgent_override_quiet_hours));
      }
    }

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
      const currentSubscription = await getCurrentBrowserPushSubscription();
      const currentKeys = getPushSubscriptionKeys(currentSubscription);
      if (currentSubscription) {
        await saveCurrentPushSubscription(currentSubscription);
      }
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getPushDeviceId(),
          endpoint: currentSubscription?.endpoint ?? null,
          keys: currentKeys,
          browserSubscriptionExists: Boolean(currentSubscription),
          appPublicKeyFingerprint: getPushSubscriptionApplicationServerKeyFingerprint(currentSubscription),
        }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok) {
        localStorage.setItem("pwa_last_test_push_result", "success");
        localStorage.removeItem("pwa_last_test_push_provider_status");
        setTestMessage(
          `Test push accepted by browser push service (${d?.diagnostics?.delivered ?? 1} delivered). If it does not appear, check OS/browser notification settings, battery optimization, or Focus/Do Not Disturb.`
        );
      } else {
        const errCode = d?.code || "unknown_error";
        const providerStatus = d?.diagnostics?.failures?.[0]?.status;
        localStorage.setItem("pwa_last_test_push_result", errCode);
        if (providerStatus) {
          localStorage.setItem("pwa_last_test_push_provider_status", String(providerStatus));
        } else {
          localStorage.removeItem("pwa_last_test_push_provider_status");
        }
        throw new Error(d?.error || "Failed to send test push.");
      }
    } catch (err: any) {
      setTestMessage(`❌ Error: ${err.message}`);
    } finally {
      setTestLoading(false);
      await refreshDiagnostics();
    }
  }

  async function handleManualCheck() {
    setLoading(true);
    setError(null);
    setTestMessage(null);
    try {
      const subscription = await refreshPushSubscription();

      const status = await getPushDeviceStatus(subscription.endpoint, getPushSubscriptionKeys(subscription));
      if (!status.enabled) {
        throw new Error("Refresh did not complete. Please enable alerts again.");
      }

      const nowStr = new Date().toISOString();
      localStorage.setItem("pwa_last_subscription_check", nowStr);
      setLastCheck(new Date(nowStr).toLocaleString());
      setDeviceEnabled(true);
      await refreshDiagnostics(status);

      const testRes = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getPushDeviceId(),
          endpoint: subscription.endpoint,
          keys: getPushSubscriptionKeys(subscription),
          browserSubscriptionExists: true,
          appPublicKeyFingerprint: getPushSubscriptionApplicationServerKeyFingerprint(subscription),
        }),
      });
      const testData = await testRes.json().catch(() => null);
      if (testRes.ok) {
        localStorage.setItem("pwa_last_test_push_result", "success");
        localStorage.removeItem("pwa_last_test_push_provider_status");
        setTestMessage(
          `Subscription refreshed and test push accepted (${testData?.diagnostics?.delivered ?? 1} delivered).`
        );
      } else {
        const errCode = testData?.code || "unknown_error";
        const providerStatus = testData?.diagnostics?.failures?.[0]?.status;
        localStorage.setItem("pwa_last_test_push_result", errCode);
        if (providerStatus) {
          localStorage.setItem("pwa_last_test_push_provider_status", String(providerStatus));
        } else {
          localStorage.removeItem("pwa_last_test_push_provider_status");
        }
        throw new Error(testData?.error || "Subscription refreshed, but test push failed.");
      }
    } catch (err: any) {
      setError(mapErrorToSafeReason(err));
      localStorage.setItem("pwa_last_test_push_result", "unknown_error");
    } finally {
      setLoading(false);
      await refreshDiagnostics();
    }
  }

  async function handleLocalDisplayTest() {
    setLocalTestLoading(true);
    setLocalTestMessage(null);
    try {
      if (!isPushSupported()) {
        throw new Error("Push notifications are not supported on this device.");
      }
      const reg = await navigator.serviceWorker.ready;
      if (!reg) {
        throw new Error("Service worker registration not found.");
      }

      await reg.showNotification("Test notification", {
        body: "Local notification display works.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "local-display-test",
      });

      localStorage.setItem("pwa_local_test_attempted", new Date().toISOString());
      localStorage.setItem("pwa_local_test_result", "success");
      localStorage.removeItem("pwa_local_test_error");

      setLocalTestMessage(
        "Local notification display request sent successfully! If it did not appear, check Windows/Chrome notification settings."
      );
    } catch (err: any) {
      const errMsg = err.message || String(err);
      localStorage.setItem("pwa_local_test_attempted", new Date().toISOString());
      localStorage.setItem("pwa_local_test_result", "failed");
      localStorage.setItem("pwa_local_test_error", errMsg);
      setLocalTestMessage(`❌ Local display test failed: ${errMsg}`);
    } finally {
      setLocalTestLoading(false);
      await refreshDiagnostics();
    }
  }

  async function refreshDiagnostics(prefetchedStatus?: Awaited<ReturnType<typeof getPushDeviceStatus>>) {
    if (typeof window === "undefined") return;
    const nav = window.navigator as Navigator & { standalone?: boolean; userAgentData?: { platform?: string } };
    const installedPwa =
      nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    const browser = navigator.userAgent;
    let registration: ServiceWorkerRegistration | undefined;
    let sub: PushSubscription | null = null;
    if ("serviceWorker" in navigator) {
      registration = await navigator.serviceWorker.getRegistration("/");
      if (registration) {
        sub = await registration.pushManager.getSubscription();
      }
    }
    const browserKeys = getPushSubscriptionKeys(sub);
    const status = prefetchedStatus ?? (await getPushDeviceStatus(sub?.endpoint, browserKeys).catch(() => null));
    
    const currentFingerprint = getVapidFingerprint(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    const browserApplicationServerKeyFingerprint = getPushSubscriptionApplicationServerKeyFingerprint(sub);
    const dbFingerprint = status?.vapidKeyFingerprint ?? null;
    const serverFingerprint = status?.serverPublicKeyFingerprint ?? null;
    const serverKeyPairValid = status?.serverKeyPairValid ?? false;
    const savedKeyMatchesApp = Boolean(dbFingerprint && currentFingerprint && dbFingerprint === currentFingerprint);
    const serverKeyMatchesApp = Boolean(serverFingerprint && currentFingerprint && serverFingerprint === currentFingerprint);
    const serverVapidMismatch = Boolean(
      status &&
        ((serverFingerprint && currentFingerprint && serverFingerprint !== currentFingerprint) ||
          (!serverKeyPairValid &&
            (status.serverPrivateKeyConfigured || status.vapidSubjectConfigured || Boolean(serverFingerprint))))
    );
    const vapidKeyMatch = savedKeyMatchesApp && serverKeyMatchesApp && serverKeyPairValid;
    
    const endpointPresent = !!sub?.endpoint;
    const browserKeysPresent = !!sub?.getKey?.("p256dh") && !!sub?.getKey?.("auth");
    const serverKeysPresent = status?.keysPresent ?? false;
    const subscriptionKeysMatch = status?.keysMatch ?? (browserKeysPresent && serverKeysPresent ? null : false);
    
    const lastTest = localStorage.getItem("pwa_last_test_push_result");
    const lastProviderStatus = localStorage.getItem("pwa_last_test_push_provider_status");
    const lastSaveDiagnostics = getLastPushSaveDiagnostics();
    const lastRefreshDiagnostics = getLastPushRefreshDiagnostics();

    const dismissedUntil = localStorage.getItem("caregiver-app:pwa-install-dismissed-until") ||
      localStorage.getItem("caregiver_app_pwa_install_dismissed_until");
    const neverShow = localStorage.getItem("caregiver-app:pwa-install-never-show") === "true" ||
      localStorage.getItem("caregiver_app_pwa_install_never_show") === "true";

    // Load Local Display Test diagnostics
    const localAttempted = localStorage.getItem("pwa_local_test_attempted") || "None";
    const localResult = localStorage.getItem("pwa_local_test_result") || "Not run";
    const localError = localStorage.getItem("pwa_local_test_error") || "None";

    // Load Service Worker trace logs from caches
    let swTrace: Record<string, any> = {};
    if ("caches" in window) {
      try {
        const cache = await window.caches.open("sw-trace-cache");
        const match = await cache.match("https://caregiver-app/sw-trace.json");
        if (match) {
          swTrace = await match.json().catch(() => ({}));
        }
      } catch (err) {
        console.warn("Could not read SW trace cache", err);
      }
    }

    // Load Install Prompt advanced diagnostics
    let installDiag: any = {};
    try {
      const stored = localStorage.getItem("caregiver-app:install-prompt-diagnostics");
      if (stored) {
        installDiag = JSON.parse(stored);
      }
    } catch {}

    setDiagnostics({
      browserPermission: "Notification" in window ? Notification.permission : "unsupported",
      serviceWorkerRegistered: !!registration,
      serviceWorkerActive: !!registration?.active,
      browserSubscriptionExists: !!sub,
      deviceId: getPushDeviceId(),
      subscriptionSaved: !!status?.serverSubscriptionExists,
      subscriptionActive: !!status?.active,
      activeColumn: status?.activeColumn ?? null,
      rawIsActive: status?.rawIsActive ?? null,
      rawActive: status?.rawActive ?? null,
      statusValue: status?.status ?? null,
      selectedSubscriptionId: status?.selectedSubscriptionId ?? null,
      subscriptionEndpointPresent: endpointPresent,
      subscriptionKeysPresent: browserKeysPresent && serverKeysPresent,
      subscriptionKeysMatch,
      endpointMatch: status?.endpointMatch ?? null,
      vapidKeyMatch,
      currentAppPublicKeyFingerprint: currentFingerprint || "Not configured",
      browserSubscriptionApplicationServerKeyFingerprint: browserApplicationServerKeyFingerprint,
      browserSubscriptionCreatedWithCurrentKey:
        browserApplicationServerKeyFingerprint && currentFingerprint
          ? browserApplicationServerKeyFingerprint === currentFingerprint
          : null,
      savedSubscriptionFingerprint: dbFingerprint,
      savedSubscriptionFingerprintStatus: status?.fingerprintStatus ?? null,
      serverSenderPublicKeyFingerprint: serverFingerprint,
      serverPrivateKeyConfigured: status?.serverPrivateKeyConfigured ?? false,
      vapidSubjectConfigured: status?.vapidSubjectConfigured ?? false,
      serverKeyPairValid,
      serverVapidError: status?.serverVapidError ?? null,
      serverVapidMismatch,
      lastSubscriptionUpdate: status?.lastSeenAt ?? status?.updatedAt ?? null,
      lastTestPushResult: lastTest ? describeTestResult(lastTest, serverVapidMismatch) : "Not run",
      lastTestProviderStatus: lastProviderStatus,
      platform: status?.platform ?? nav.userAgentData?.platform ?? (browser.includes("Android") ? "android" : browser.includes("iPhone") || browser.includes("iPad") ? "ios" : "desktop"),
      installedPwa,
      browser,
      lastSaveDiagnostics,
      lastRefreshDiagnostics,
      installPromptDismissedUntil: dismissedUntil ? new Date(parseInt(dismissedUntil, 10)).toLocaleString() : "None",
      installPromptNeverShow: neverShow,
      installedPwaMode: installedPwa,
      // Local display test fields
      localDisplayTestAttempted: localAttempted,
      localDisplayTestResult: localResult,
      localDisplayTestError: localError === "None" ? null : localError,
      // Service Worker Trace fields
      swInstallTime: swTrace.installTime ? new Date(swTrace.installTime).toLocaleString() : "Not recorded",
      swActivateTime: swTrace.activateTime ? new Date(swTrace.activateTime).toLocaleString() : "Not recorded",
      lastSwPushReceivedTime: swTrace.lastPushReceivedTime ? new Date(swTrace.lastPushReceivedTime).toLocaleString() : "Not recorded",
      lastSwPushPayload: swTrace.lastPushPayload || "None",
      lastSwPushParseResult: swTrace.lastPushParseResult || "Not run",
      lastSwPushParseError: swTrace.lastPushParseError || null,
      lastSwShowNotificationAttemptedTime: swTrace.lastShowNotificationAttemptedTime ? new Date(swTrace.lastShowNotificationAttemptedTime).toLocaleString() : "Not recorded",
      lastSwShowNotificationResult: swTrace.lastShowNotificationResult || "Not run",
      lastSwShowNotificationError: swTrace.lastShowNotificationError || null,
      lastSwNotificationTitle: swTrace.lastNotificationTitle || "None",
      lastSwNotificationTag: swTrace.lastSwNotificationTag || swTrace.lastNotificationTag || "None",
      lastSwClickTime: swTrace.lastClickTime ? new Date(swTrace.lastClickTime).toLocaleString() : "Not recorded",
      lastSwClickUrl: swTrace.lastClickUrl || "None",
      // Install Prompt Advanced fields
      installPromptInstalledPwaModeDetected: installDiag.installedPwaModeDetected ?? null,
      installPromptBeforeinstallpromptAvailable: installDiag.beforeinstallpromptAvailable ?? null,
      installPromptNeverShowVal: installDiag.installPromptNeverShow ?? null,
      installPromptDismissedUntilVal: installDiag.installPromptDismissedUntil ? new Date(installDiag.installPromptDismissedUntil).toLocaleString() : null,
      installPromptSessionDismissed: installDiag.sessionDismissed ?? null,
      installPromptCurrentRoute: installDiag.currentRoute ?? null,
      installPromptReasonHidden: installDiag.reasonPromptIsHidden ?? null,
    });
  }

  function copyDiagnosticsToClipboard() {
    try {
      const dataToCopy = {
        ...diagnostics,
        swStatus,
      };
      navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      alert("Diagnostics copied to clipboard!");
    } catch {
      alert("Could not copy diagnostics.");
    }
  }

  function describeTestResult(code: string, trueServerMismatch = false) {
    switch (code) {
      case "success": return "Success";
      case "expired_subscription": return "Subscription expired (404/410)";
      case "invalid_vapid_key": return "Notification key mismatch (401/403)";
      case "server_vapid_mismatch":
        return trueServerMismatch ? "Server notification key mismatch" : "Saved subscription stale or inactive";
      case "server_push_not_configured": return "Server push not configured";
      case "stale_subscription_key": return "Device subscription key changed";
      case "saved_subscription_inactive": return "Saved subscription inactive";
      case "saved_subscription_keys_stale": return "Saved subscription keys stale";
      case "push_provider_403_after_valid_subscription": return "Provider rejected signed request (403)";
      case "no_subscription":
      case "no_active_subscription":
        return "No active subscription";
      case "service_worker_missing": return "Service worker missing";
      default: return `Failed (${code})`;
    }
  }

  function getOverallStatus() {
    if (!supported || diagnostics.browserPermission === "unsupported") {
      return { label: "Browser unsupported", color: "text-terracotta-600 font-semibold" };
    }
    if (diagnostics.browserPermission === "denied") {
      return { label: "Permission denied", color: "text-terracotta-600 font-semibold" };
    }
    if (swStatus === "installing") {
      return { label: "Service worker installing", color: "text-amber-600 font-semibold animate-pulse" };
    }
    if (swStatus === "needs_refresh" || !diagnostics.serviceWorkerActive) {
      return { label: "Service worker active but page needs refresh", color: "text-amber-600 font-semibold" };
    }
    if (!diagnostics.serviceWorkerRegistered) {
      return { label: "Service worker issue", color: "text-terracotta-600 font-semibold" };
    }

    const lastTest = typeof window !== "undefined" ? localStorage.getItem("pwa_last_test_push_result") : null;
    if (diagnostics.serverVapidMismatch) {
      return { label: "Server key mismatch", color: "text-terracotta-600 font-semibold" };
    }
    if (lastTest === "server_push_not_configured") {
      return { label: "Server push not configured", color: "text-terracotta-600 font-semibold" };
    }
    if (diagnostics.browserSubscriptionExists && diagnostics.subscriptionSaved && !diagnostics.subscriptionActive) {
      return { label: "Saved subscription inactive", color: "text-amber-600 font-semibold" };
    }
    if (diagnostics.browserSubscriptionExists && diagnostics.endpointMatch === false) {
      return { label: "Endpoint mismatch", color: "text-amber-600 font-semibold" };
    }
    if (diagnostics.browserSubscriptionExists && diagnostics.endpointMatch && diagnostics.subscriptionKeysMatch === false) {
      return { label: "Saved subscription keys stale", color: "text-amber-600 font-semibold" };
    }
    if (diagnostics.savedSubscriptionFingerprintStatus === "invalid_key") {
      return { label: "Needs refresh", color: "text-amber-600 font-semibold" };
    }
    const hasMismatch =
      deviceEnabled &&
      diagnostics.subscriptionSaved &&
      (diagnostics.vapidKeyMatch === false ||
        diagnostics.endpointMatch === false ||
        diagnostics.subscriptionKeysMatch === false ||
        !diagnostics.subscriptionActive);

    if (
      hasMismatch ||
      lastTest === "invalid_vapid_key" ||
      lastTest === "saved_subscription_keys_stale" ||
      lastTest === "provider_rejected_subscription" ||
      lastTest === "expired_subscription" ||
      diagnostics.lastSubscriptionUpdate === "invalid_key"
    ) {
      return { label: "Needs refresh", color: "text-amber-600 font-semibold" };
    }

    if (diagnostics.browserSubscriptionExists && !diagnostics.subscriptionActive) {
      return { label: "Needs save/refresh", color: "text-amber-600 font-semibold" };
    }

    if (!deviceEnabled || !diagnostics.subscriptionSaved || !diagnostics.subscriptionActive) {
      return { label: "Not subscribed", color: "text-ink-500 font-semibold" };
    }

    if (lastTest === "success") {
      return { label: "Active and test passed", color: "text-forest-700 font-semibold" };
    }

    return { label: "Active but test not recently run", color: "text-forest-700 font-semibold" };
  }

  const overallStatus = getOverallStatus();
  const showServerMismatchWarning = deviceEnabled && diagnostics.serverVapidMismatch;
  const showInactiveWarning =
    !showServerMismatchWarning &&
    diagnostics.browserSubscriptionExists &&
    diagnostics.subscriptionSaved &&
    !diagnostics.subscriptionActive;
  const showEndpointMismatchWarning =
    !showServerMismatchWarning &&
    diagnostics.browserSubscriptionExists &&
    diagnostics.endpointMatch === false;
  const showKeysStaleWarning =
    !showServerMismatchWarning &&
    diagnostics.browserSubscriptionExists &&
    diagnostics.endpointMatch === true &&
    diagnostics.subscriptionKeysMatch === false;
  const showInvalidFingerprintWarning =
    !showServerMismatchWarning &&
    diagnostics.savedSubscriptionFingerprintStatus === "invalid_key";
  const showMismatchWarning =
    !showServerMismatchWarning &&
    !showInactiveWarning &&
    !showEndpointMismatchWarning &&
    !showKeysStaleWarning &&
    !showInvalidFingerprintWarning &&
    deviceEnabled &&
    diagnostics.subscriptionSaved &&
    diagnostics.vapidKeyMatch === false;

  const lastTest = typeof window !== "undefined" ? localStorage.getItem("pwa_last_test_push_result") : null;
  const hasPushNoTrace =
    lastTest === "success" &&
    (!diagnostics.lastSwPushReceivedTime || diagnostics.lastSwPushReceivedTime === "Not recorded");

  const hasPushTraceButNoDisplay =
    lastTest === "success" &&
    diagnostics.lastSwPushReceivedTime &&
    diagnostics.lastSwPushReceivedTime !== "Not recorded" &&
    diagnostics.lastSwShowNotificationResult === "success";

  const saveDiagnosticsRows = diagnostics.lastSaveDiagnostics
    ? [
        ["App commit/version", diagnostics.lastSaveDiagnostics.appCommit],
        ["Current device ID", diagnostics.lastSaveDiagnostics.deviceId],
        ["Current browser endpoint hash", diagnostics.lastSaveDiagnostics.browserEndpointHash],
        ["Current browser p256dh hash", diagnostics.lastSaveDiagnostics.browserP256dhHash],
        ["Current browser auth hash", diagnostics.lastSaveDiagnostics.browserAuthHash],
        ["Selected DB row before save", diagnostics.lastSaveDiagnostics.selectedDbRowBeforeSave],
        ["DB row is_active before save", diagnostics.lastSaveDiagnostics.dbRowIsActiveBeforeSave],
        ["DB row endpoint hash before save", diagnostics.lastSaveDiagnostics.dbRowEndpointHashBeforeSave],
        ["DB row p256dh hash before save", diagnostics.lastSaveDiagnostics.dbRowP256dhHashBeforeSave],
        ["DB row auth hash before save", diagnostics.lastSaveDiagnostics.dbRowAuthHashBeforeSave],
        ["Update by ID attempted", diagnostics.lastSaveDiagnostics.updateByIdAttempted],
        ["Supabase update error", diagnostics.lastSaveDiagnostics.supabaseUpdateError],
        ["Before-read error", diagnostics.lastSaveDiagnostics.beforeReadError],
        ["After-read error", diagnostics.lastSaveDiagnostics.afterReadError],
        ["Updated row ID returned by Supabase", diagnostics.lastSaveDiagnostics.updatedRowIdReturnedBySupabase],
        ["DB row is_active after save", diagnostics.lastSaveDiagnostics.dbRowIsActiveAfterSave],
        ["DB row endpoint hash after save", diagnostics.lastSaveDiagnostics.dbRowEndpointHashAfterSave],
        ["DB row p256dh hash after save", diagnostics.lastSaveDiagnostics.dbRowP256dhHashAfterSave],
        ["DB row auth hash after save", diagnostics.lastSaveDiagnostics.dbRowAuthHashAfterSave],
        ["Endpoint matches after save", diagnostics.lastSaveDiagnostics.endpointMatchesAfterSave],
        ["p256dh matches after save", diagnostics.lastSaveDiagnostics.p256dhMatchesAfterSave],
        ["auth matches after save", diagnostics.lastSaveDiagnostics.authMatchesAfterSave],
        ["Fingerprint matches after save", diagnostics.lastSaveDiagnostics.fingerprintMatchesAfterSave],
        ["After-save row ID", diagnostics.lastSaveDiagnostics.afterSaveRowId],
        ["Updated row equals after-save row", diagnostics.lastSaveDiagnostics.updatedRowEqualsAfterRow],
        ["Policy/RLS warning", diagnostics.lastSaveDiagnostics.policyWarning],
      ]
    : [];
  const refreshDiagnosticsRows = diagnostics.lastRefreshDiagnostics
    ? [
        ["Current device ID", diagnostics.lastRefreshDiagnostics.deviceId],
        ["Current app public key fingerprint", diagnostics.lastRefreshDiagnostics.currentAppPublicKeyFingerprint],
        ["Browser subscription app key before", diagnostics.lastRefreshDiagnostics.browserSubscriptionApplicationServerKeyFingerprintBefore],
        ["Browser subscription used current key before", diagnostics.lastRefreshDiagnostics.browserSubscriptionCreatedWithCurrentKeyBefore],
        ["Old endpoint hash before refresh", diagnostics.lastRefreshDiagnostics.oldEndpointHashBeforeRefresh],
        ["Unsubscribe attempted", diagnostics.lastRefreshDiagnostics.unsubscribeAttempted],
        ["Unsubscribe returned", diagnostics.lastRefreshDiagnostics.unsubscribeReturned],
        ["getSubscription after unsubscribe is null", diagnostics.lastRefreshDiagnostics.getSubscriptionAfterUnsubscribeIsNull],
        ["New subscribe attempted", diagnostics.lastRefreshDiagnostics.newSubscribeAttempted],
        ["New endpoint hash after subscribe", diagnostics.lastRefreshDiagnostics.newEndpointHashAfterSubscribe],
        ["New endpoint differs from old endpoint", diagnostics.lastRefreshDiagnostics.newEndpointDiffersFromOldEndpoint],
        ["Browser subscription app key after", diagnostics.lastRefreshDiagnostics.browserSubscriptionApplicationServerKeyFingerprintAfter],
        ["Browser subscription used current key after", diagnostics.lastRefreshDiagnostics.browserSubscriptionCreatedWithCurrentKeyAfter],
        ["Save new endpoint result", diagnostics.lastRefreshDiagnostics.saveNewEndpointResult],
        ["Refresh warning", diagnostics.lastRefreshDiagnostics.warning],
      ]
    : [];

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

        {showServerMismatchWarning && (
          <div className="bg-terracotta-50 border border-terracotta-200 p-4 rounded-2xl text-xs text-terracotta-700 font-semibold mb-4">
            Server notification key does not match the app notification key. Check deployment environment variables.
          </div>
        )}

        {showInactiveWarning && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800 font-semibold mb-4">
            The app saved this device&apos;s subscription, but it is marked inactive. Refresh should reactivate it.
          </div>
        )}

        {showEndpointMismatchWarning && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800 font-semibold mb-4">
            Browser subscription exists, but the saved server endpoint does not match this device. Refresh notifications needs to save the current endpoint.
          </div>
        )}

        {showKeysStaleWarning && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800 font-semibold mb-4">
            The saved push subscription keys for this device are stale. Refresh notifications needs to update the saved subscription keys.
          </div>
        )}

        {showInvalidFingerprintWarning && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800 font-semibold mb-4">
            The saved server subscription was marked invalid. Refresh notifications should replace it with a new active subscription.
          </div>
        )}

        {showMismatchWarning && (
          <div className="bg-terracotta-50 border border-terracotta-200 p-4 rounded-2xl text-xs text-terracotta-700 font-semibold mb-4 animate-pulse">
            ⚠️ This device needs to refresh notifications because the app notification key changed.
          </div>
        )}

        {hasPushNoTrace && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-850 mb-4 leading-relaxed">
            📢 <strong>Notice:</strong> The push provider accepted the message, but this browser did not report receiving the push event yet. Try with the app closed, then opened, and check OS/browser notification settings.
          </div>
        )}

        {hasPushTraceButNoDisplay && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-850 mb-4 leading-relaxed">
            📢 <strong>Notice:</strong> The browser reports that it displayed the notification, but the OS/browser may be suppressing it. Check system-level Focus/Do Not Disturb settings.
          </div>
        )}

        {diagnostics.localDisplayTestResult === "success" && (
          <div className="bg-cream-50 border border-cream-200 p-4 rounded-2xl text-xs text-ink-700 mb-4 leading-relaxed">
            ℹ️ <strong>Notice:</strong> Your browser accepted the display request, but Windows/Chrome may be suppressing notifications. Check Windows notification settings for Chrome and the installed app.
          </div>
        )}

        <div className="bg-cream-50 p-4 rounded-2xl text-xs space-y-2 mb-4 border border-cream-200">
          <p className="font-medium text-ink-700">
            <strong>Notification status:</strong>{" "}
            <span className={overallStatus.color}>{overallStatus.label}</span>
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
        {localTestMessage && <p className="text-xs text-ink-700 font-semibold mb-3">{localTestMessage}</p>}

        {!supported ? (
          <div className="bg-cream-50 p-4 rounded-2xl text-sm text-ink-700">
            Push notifications are not supported in this browser or device.
          </div>
        ) : (
          <div className="space-y-2.5 mb-4">
            {swStatus === "needs_refresh" && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800 font-semibold mb-2.5 space-y-2">
                <p>Notifications are almost ready. Refresh this page once, then enable alerts.</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-xl text-xs font-semibold transition"
                >
                  🔄 Refresh page
                </button>
              </div>
            )}

            <button
              onClick={toggleDevice}
              disabled={saving || swStatus === "installing" || swStatus === "needs_refresh"}
              className={`w-full py-3.5 rounded-2xl font-medium transition active:scale-[0.98] ${
                deviceEnabled
                  ? "bg-cream-200 text-ink-700 hover:bg-cream-300"
                  : "bg-forest-600 text-cream-50 hover:bg-forest-700 shadow-soft"
              }`}
            >
              {saving ? "Updating..." : deviceEnabled ? "Disable on this device" : "Enable on this device"}
            </button>

            {deviceEnabled && swStatus !== "needs_refresh" && (
              <div className="flex flex-col gap-2 pt-1.5">
                <div className="flex gap-2">
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
                    disabled={loading}
                    className="bg-cream-200 hover:bg-cream-300 text-ink-750 px-4 py-2.5 rounded-xl text-xs font-semibold transition"
                  >
                    Refresh subscription
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleLocalDisplayTest}
                  disabled={localTestLoading}
                  className="w-full bg-cream-250 hover:bg-cream-350 text-ink-750 py-2.5 rounded-xl text-xs font-semibold transition"
                >
                  {localTestLoading ? "Testing display..." : "Test local notification display"}
                </button>
              </div>
            )}

            {!deviceEnabled && (swStatus === "ready_to_subscribe" || swStatus === "permission_needed") && (
              <button
                type="button"
                onClick={handleLocalDisplayTest}
                disabled={localTestLoading}
                className="w-full bg-cream-250 hover:bg-cream-350 text-ink-750 py-2.5 rounded-xl text-xs font-semibold transition mt-2"
              >
                {localTestLoading ? "Testing display..." : "Test local notification display"}
              </button>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-cream-200">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-forest-600 hover:text-forest-700 font-semibold flex items-center gap-1 focus:outline-none"
          >
            <span>{showAdvanced ? "Hide details" : "Show details"}</span>
            <span>Advanced diagnostics</span>
          </button>
          {showAdvanced && (
            <div className="bg-white/70 border border-cream-200 rounded-2xl p-4 text-xs text-ink-600 mt-3">
              <div className="flex justify-between items-center mb-2.5">
                <p className="font-semibold text-ink-800">Notification diagnostics</p>
                <button
                  type="button"
                  onClick={copyDiagnosticsToClipboard}
                  className="bg-cream-200 hover:bg-cream-300 text-ink-750 px-2 py-1 rounded text-[10px] font-semibold transition"
                >
                  Copy diagnostics
                </button>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                <Diag label="Browser permission" value={diagnostics.browserPermission} />
                <Diag label="Service worker registered" value={diagnostics.serviceWorkerRegistered ? "Yes" : "No"} />
                <Diag label="Service worker active" value={diagnostics.serviceWorkerActive ? "Yes" : "No"} />
                <Diag label="Browser push subscription exists" value={diagnostics.browserSubscriptionExists ? "Yes" : "No"} />
                <Diag label="Browser endpoint present" value={diagnostics.subscriptionEndpointPresent ? "Yes" : "No"} />
                <Diag label="Saved server subscription exists" value={diagnostics.subscriptionSaved ? "Yes" : "No"} />
                <Diag label="Saved server subscription active" value={diagnostics.subscriptionActive ? "Yes" : "No"} />
                <Diag label="Canonical active column" value={diagnostics.activeColumn || "Not reported"} />
                <Diag label="Raw is_active value" value={diagnostics.rawIsActive === null ? "Not present" : diagnostics.rawIsActive ? "true" : "false"} />
                <Diag label="Raw active value" value={diagnostics.rawActive === null ? "Not present" : diagnostics.rawActive ? "true" : "false"} />
                <Diag label="Status value" value={diagnostics.statusValue || "Not present"} />
                <Diag label="Selected subscription row" value={diagnostics.selectedSubscriptionId || "Not selected"} />
                <Diag label="Device ID" value={diagnostics.deviceId || "Not available"} />
                <Diag label="Endpoint match" value={diagnostics.endpointMatch === null ? "Not checked" : diagnostics.endpointMatch ? "Yes" : "No"} />
                <Diag label="Subscription keys present" value={diagnostics.subscriptionKeysPresent ? "Yes" : "No"} />
                <Diag label="Subscription keys match current browser subscription" value={diagnostics.subscriptionKeysMatch === null ? "Not checked" : diagnostics.subscriptionKeysMatch ? "Yes" : "No"} />
                <Diag label="VAPID key match" value={diagnostics.vapidKeyMatch ? "Yes" : "No"} />
                <Diag label="App public key fingerprint" value={diagnostics.currentAppPublicKeyFingerprint || "Not configured"} />
                <Diag label="Browser subscription app key" value={diagnostics.browserSubscriptionApplicationServerKeyFingerprint || "Browser does not expose subscription applicationServerKey"} />
                <Diag label="Browser subscription used current key" value={diagnostics.browserSubscriptionCreatedWithCurrentKey === null ? "Not checked" : diagnostics.browserSubscriptionCreatedWithCurrentKey ? "Yes" : "No"} />
                <Diag label="Saved subscription fingerprint" value={diagnostics.savedSubscriptionFingerprint || "Not saved"} />
                <Diag label="Saved fingerprint status" value={diagnostics.savedSubscriptionFingerprintStatus || "Not checked"} />
                <Diag label="Server sender fingerprint" value={diagnostics.serverSenderPublicKeyFingerprint || "Not configured"} />
                <Diag label="Server private key configured" value={diagnostics.serverPrivateKeyConfigured ? "Yes" : "No"} />
                <Diag label="VAPID subject configured" value={diagnostics.vapidSubjectConfigured ? "Yes" : "No"} />
                <Diag label="Server VAPID key pair valid" value={diagnostics.serverKeyPairValid ? "Yes" : "No"} />
                <Diag label="Server VAPID error" value={diagnostics.serverVapidError || "None"} />
                <Diag
                  label="Last subscription update"
                  value={diagnostics.lastSubscriptionUpdate ? new Date(diagnostics.lastSubscriptionUpdate).toLocaleString() : "Not recorded"}
                />
                <Diag label="Last test push result" value={diagnostics.lastTestPushResult || "Not run"} />
                <Diag label="Last provider status" value={diagnostics.lastTestProviderStatus || "Not recorded"} />
                <Diag label="Platform/browser" value={`${diagnostics.platform} · ${diagnostics.browser.slice(0, 42)}`} />
                <Diag label="Installed PWA mode" value={diagnostics.installedPwa ? "Yes" : "No"} />
                <Diag label="Install prompt dismissed until" value={diagnostics.installPromptDismissedUntil || "None"} />
                <Diag label="Install prompt never show" value={diagnostics.installPromptNeverShow ? "Yes" : "No"} />
                <Diag label="Installed PWA mode detected" value={diagnostics.installedPwaMode ? "Yes" : "No"} />

                {/* Local Display Test Diagnostics */}
                <Diag label="Local display test attempted" value={diagnostics.localDisplayTestAttempted} />
                <Diag label="Local display test result" value={diagnostics.localDisplayTestResult} />
                <Diag label="Local display test error" value={diagnostics.localDisplayTestError || "None"} />

                {/* Service Worker Lifecycle & Trace Logs */}
                <Diag label="SW install time" value={diagnostics.swInstallTime} />
                <Diag label="SW activate time" value={diagnostics.swActivateTime} />
                <Diag label="Last SW push received time" value={diagnostics.lastSwPushReceivedTime} />
                <Diag label="Last SW push payload" value={diagnostics.lastSwPushPayload.slice(0, 50)} />
                <Diag label="Last SW push parse result" value={diagnostics.lastSwPushParseResult} />
                <Diag label="Last SW push parse error" value={diagnostics.lastSwPushParseError || "None"} />
                <Diag label="Last SW show attempted time" value={diagnostics.lastSwShowNotificationAttemptedTime} />
                <Diag label="Last SW show result" value={diagnostics.lastSwShowNotificationResult} />
                <Diag label="Last SW show error" value={diagnostics.lastSwShowNotificationError || "None"} />
                <Diag label="Last SW notification title" value={diagnostics.lastSwNotificationTitle} />
                <Diag label="Last SW notification tag" value={diagnostics.lastSwNotificationTag} />
                <Diag label="Last SW notification click time" value={diagnostics.lastSwClickTime} />
                <Diag label="Last SW notification click url" value={diagnostics.lastSwClickUrl} />

                {/* Install Prompt advanced diagnostics */}
                <Diag label="Install prompt PWA mode detected" value={diagnostics.installPromptInstalledPwaModeDetected === null ? "Not checked" : diagnostics.installPromptInstalledPwaModeDetected ? "Yes" : "No"} />
                <Diag label="Install prompt beforeinstallprompt" value={diagnostics.installPromptBeforeinstallpromptAvailable === null ? "Not checked" : diagnostics.installPromptBeforeinstallpromptAvailable ? "Yes" : "No"} />
                <Diag label="Install prompt neverShow" value={diagnostics.installPromptNeverShowVal === null ? "Not checked" : diagnostics.installPromptNeverShowVal ? "Yes" : "No"} />
                <Diag label="Install prompt dismissedUntil" value={diagnostics.installPromptDismissedUntilVal || "None"} />
                <Diag label="Install prompt sessionDismissed" value={diagnostics.installPromptSessionDismissed === null ? "Not checked" : diagnostics.installPromptSessionDismissed ? "Yes" : "No"} />
                <Diag label="Install prompt current route" value={diagnostics.installPromptCurrentRoute || "None"} />
                <Diag label="Install prompt reason hidden" value={diagnostics.installPromptReasonHidden || "None"} />
              </dl>
              {saveDiagnosticsRows.length > 0 && (
                <div className="mt-4 border-t border-cream-200 pt-3">
                  <p className="font-semibold text-ink-800 mb-2">Last save attempt</p>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    {saveDiagnosticsRows.map(([label, value]) => (
                      <Diag key={String(label)} label={String(label)} value={formatDiagnosticValue(value)} />
                    ))}
                  </dl>
                </div>
              )}
              {refreshDiagnosticsRows.length > 0 && (
                <div className="mt-4 border-t border-cream-200 pt-3">
                  <p className="font-semibold text-ink-800 mb-2">Last refresh attempt</p>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    {refreshDiagnosticsRows.map(([label, value]) => (
                      <Diag key={String(label)} label={String(label)} value={formatDiagnosticValue(value)} />
                    ))}
                  </dl>
                </div>
              )}
              <p className="mt-3 text-[11px] text-ink-500">
                If a test is accepted but does not appear, check OS notification permission, Focus or Do Not Disturb,
                Android battery optimization, expired subscriptions, and whether iPhone/iPad users opened the installed Home Screen app.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-3xl p-6 shadow-soft grain-overlay">
        <h2 className="font-display text-xl mb-1">In-app Alert Sound Settings</h2>
        <p className="text-xs text-ink-500 mb-4">
          Configure sounds played when you receive alerts while the app is open.
        </p>
        <div className="bg-cream-50 p-4 rounded-2xl border border-cream-200 text-xs mb-4 text-ink-600 leading-relaxed">
          📢 <strong>Note:</strong> Your device controls the sound for native push notifications. Carer Vista Pro can play louder in-app alert sounds while the app is open, but your phone or computer controls the sound used for system push notifications.
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-semibold text-ink-700">
            Default In-app Alert Sound
            <select
              value={inAppAlertSound}
              onChange={(e) => {
                const val = e.target.value;
                setInAppAlertSound(val);
                localStorage.setItem("pwa_in_app_alert_sound", val);
              }}
              className="mt-1 block w-full bg-white border border-cream-200 rounded-xl px-3 py-2 text-sm text-ink-850 focus:outline-none focus:border-forest-500"
            >
              <option value="default">Default</option>
              <option value="soft_chime">Soft chime</option>
              <option value="bell">Loud chime</option>
              <option value="repeating_chime">Repeating chime</option>
              <option value="urgent_tone">Urgent tone</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-ink-700">
            Alert Sound Volume ({Math.round(inAppAlertVolume * 100)}%)
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={inAppAlertVolume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setInAppAlertVolume(val);
                localStorage.setItem("pwa_in_app_alert_volume", String(val));
              }}
              className="mt-2 w-full accent-forest-600"
            />
          </label>

          <ToggleRow
            label="Repeat urgent alerts until acknowledged"
            checked={urgentAlertsRepeat}
            onChange={(v) => {
              setUrgentAlertsRepeat(v);
              localStorage.setItem("pwa_urgent_alerts_repeat", String(v));
            }}
          />

          <button
            type="button"
            onClick={() => playNotificationTone(inAppAlertSound as any, inAppAlertVolume)}
            className="w-full bg-cream-200 hover:bg-cream-300 text-ink-700 py-2.5 rounded-xl text-xs font-semibold transition"
          >
            🔊 Play Test Alert Sound
          </button>
        </div>
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
                            tone: event.target.value as any,
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

function formatDiagnosticValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
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
