"use client";

import type {
  NotificationCategoryPreferenceMap,
} from "@/lib/notification-preferences";
import { getVapidFingerprint } from "@/lib/vapid-helper";

const PUSH_DEVICE_ID_STORAGE_KEY = "caregiver-app:push-device-id";
const PUSH_SAVE_DIAGNOSTICS_STORAGE_KEY = "caregiver-app:last-push-save-diagnostics";
const PUSH_REFRESH_DIAGNOSTICS_STORAGE_KEY = "caregiver-app:last-push-refresh-diagnostics";

export type PushPreferences = {
  messages: boolean;
  shift_assignments: boolean;
  trades: boolean;
  incidents: boolean;
  general: boolean;
  sounds_enabled: boolean;
  message_sound_enabled: boolean;
  urgent_incident_sound_enabled: boolean;
  category_preferences: NotificationCategoryPreferenceMap;
  privacy_safe_bodies: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  urgent_override_quiet_hours: boolean;
};

type PushDebugValue = string | boolean | number | null;

export type PushSaveDiagnostics = Record<string, PushDebugValue>;
export type PushRefreshDiagnostics = Record<string, PushDebugValue>;

type PushSubscriptionSaveResponse = {
  error?: string;
  active?: boolean;
  endpointMatch?: boolean;
  keysMatch?: boolean;
  saveDiagnostics?: PushSaveDiagnostics;
};

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushDeviceId() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(PUSH_DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `push-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(PUSH_DEVICE_ID_STORAGE_KEY, id);
  return id;
}

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

function isIOSBrowser() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSecurePushContext() {
  return (
    typeof window !== "undefined" &&
    (window.isSecureContext || window.location.hostname === "localhost")
  );
}

export async function enablePushNotifications() {
  const logStep = (step: string, detail?: unknown) => {
    if (detail) {
      console.info(`[push-enable] ${step}`, detail);
    } else {
      console.info(`[push-enable] ${step}`);
    }
  };

  if (!isPushSupported()) {
    console.error("[push-enable] unsupported browser APIs");
    if (isIOSBrowser() && !isStandalonePwa()) {
      throw new Error("On iPhone or iPad, install the app to your Home Screen, open it from the Home Screen, then enable notifications.");
    }
    throw new Error("Push notifications are not supported on this device or browser.");
  }

  if (!isSecurePushContext()) {
    throw new Error("Push notifications require HTTPS. Open the secure app link and try again.");
  }

  const applicationServerKey = getApplicationServerKey();

  try {
    logStep("requesting permission");
    await withTimeout(
      Notification.requestPermission(),
      30_000,
      "Notification permission request timed out."
    );
    const permission = Notification.permission;
    if (permission !== "granted") {
      console.error("[push-enable] permission not granted", permission);
      throw new Error(
        permission === "denied"
          ? "Notifications are blocked in your browser settings."
          : "Notification permission was dismissed."
      );
    }

    logStep("registering service worker");
    const registration = await ensureServiceWorkerRegistration();
    if (!navigator.serviceWorker.controller) {
      console.info("[push-enable] service worker is active but has not controlled this page yet");
    }

    logStep("checking existing subscription");
    const existing = await withTimeout(
      registration.pushManager.getSubscription(),
      10_000,
      "Checking existing push subscription timed out."
    );

    logStep(existing ? "using existing subscription" : "creating subscription");
    const subscription =
      existing ??
      (await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }),
        20_000,
        "Browser push subscription timed out."
      ));

    logStep("saving subscription");
    const response = await withTimeout(
      fetch("/api/push/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildSubscriptionSavePayload(subscription)),
      }),
      15_000,
      "Saving push subscription timed out."
    );

    const saveResult = (await response.json().catch(() => null)) as PushSubscriptionSaveResponse | null;
    rememberPushSaveDiagnostics(saveResult?.saveDiagnostics);
    if (!response.ok) {
      const data = saveResult;
      console.error("[push-enable] database save failed", data);
      throwPushSaveError(data?.error ?? "Could not save push subscription.", data?.saveDiagnostics);
    }
    if (!saveResult?.active || !saveResult.endpointMatch || saveResult.keysMatch === false) {
      throwPushSaveError(
        "Browser subscription exists, but the server could not save it.",
        saveResult?.saveDiagnostics
      );
    }

    logStep("verifying saved subscription");
    const status = await getPushDeviceStatus(subscription.endpoint, getPushSubscriptionKeys(subscription));
    if (!status.enabled) {
      console.error("[push-enable] saved subscription was not found in database");
      throw new Error("Push subscription was not saved for this device.");
    }

    logStep("enabled");
    return subscription;
  } catch (error) {
    console.error("[push-enable] failed", error);
    throw error;
  }
}

export async function getPushDeviceStatus(
  endpoint?: string | null,
  currentKeys?: { p256dh: string; auth: string } | null
) {
  const params = new URLSearchParams();
  const deviceId = getPushDeviceId();
  if (deviceId) params.set("deviceId", deviceId);
  if (endpoint) params.set("endpoint", endpoint);
  if (currentKeys?.p256dh) params.set("p256dh", currentKeys.p256dh);
  if (currentKeys?.auth) params.set("auth", currentKeys.auth);
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/push/subscriptions${query}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not verify push subscription.");
  }
  return (await response.json()) as {
    enabled: boolean;
    deviceId: string | null;
    endpoint: string | null;
    active: boolean;
    activeColumn?: string | null;
    rawIsActive?: boolean | null;
    rawActive?: boolean | null;
    status?: string | null;
    selectedSubscriptionId?: string | null;
    serverSubscriptionExists: boolean;
    endpointMatch: boolean | null;
    keysPresent: boolean;
    keysMatch: boolean | null;
    lastSeenAt?: string | null;
    updatedAt?: string | null;
    platform?: string | null;
    vapidKeyFingerprint?: string | null;
    fingerprintStatus?: "missing" | "invalid_key" | "match" | "mismatch" | string | null;
    serverPublicKeyFingerprint?: string | null;
    serverPrivateKeyConfigured?: boolean;
    vapidSubjectConfigured?: boolean;
    serverKeyPairValid?: boolean;
    serverVapidError?: string | null;
  };
}

export async function saveCurrentPushSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildSubscriptionSavePayload(subscription)),
  });
  const data = (await response.json().catch(() => null)) as PushSubscriptionSaveResponse | null;
  rememberPushSaveDiagnostics(data?.saveDiagnostics);
  if (!response.ok) {
    throwPushSaveError(data?.error ?? "Could not save push subscription.", data?.saveDiagnostics);
  }
  if (!data?.active || !data.endpointMatch || data.keysMatch === false) {
    throwPushSaveError("Browser subscription exists, but the server could not save it.", data?.saveDiagnostics);
  }
}

export function getLastPushSaveDiagnostics() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PUSH_SAVE_DIAGNOSTICS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PushSaveDiagnostics;
  } catch {
    localStorage.removeItem(PUSH_SAVE_DIAGNOSTICS_STORAGE_KEY);
    return null;
  }
}

export function getLastPushRefreshDiagnostics() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PUSH_REFRESH_DIAGNOSTICS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PushRefreshDiagnostics;
  } catch {
    localStorage.removeItem(PUSH_REFRESH_DIAGNOSTICS_STORAGE_KEY);
    return null;
  }
}

function rememberPushSaveDiagnostics(diagnostics?: PushSaveDiagnostics | null) {
  if (typeof window === "undefined") return;
  if (!diagnostics) return;
  localStorage.setItem(PUSH_SAVE_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(diagnostics));
}

function rememberPushRefreshDiagnostics(diagnostics?: PushRefreshDiagnostics | null) {
  if (typeof window === "undefined") return;
  if (!diagnostics) return;
  localStorage.setItem(PUSH_REFRESH_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(diagnostics));
}

function throwPushSaveError(message: string, diagnostics?: PushSaveDiagnostics | null): never {
  const error = new Error(message) as Error & { saveDiagnostics?: PushSaveDiagnostics | null };
  error.saveDiagnostics = diagnostics;
  throw error;
}

async function hashForDiagnostics(value: string) {
  if (!globalThis.crypto?.subtle) return value.slice(-16);
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export function getPushSubscriptionApplicationServerKeyFingerprint(subscription: PushSubscription | null) {
  const key = subscription?.options?.applicationServerKey;
  if (!key) return null;
  return getVapidFingerprint(bufferToBase64Url(key));
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return;
  const registration = await ensureServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  const response = await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ endpoint: subscription?.endpoint, device_id: getPushDeviceId() }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not disable push notifications.");
  }
  await subscription?.unsubscribe();
}

async function ensureServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser.");
  }

  try {
    let registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) {
      registration = await withTimeout(
        navigator.serviceWorker.register("/sw.js"),
        15_000,
        "Service worker registration timed out."
      );
    } else if (registration.installing || registration.waiting) {
      registration.update().catch(() => {});
    }

    if (registration.installing) {
      await waitForServiceWorkerActivation(registration.installing);
    } else if (registration.waiting && !registration.active) {
      await waitForServiceWorkerActivation(registration.waiting);
    }

    const readyRegistration = await withTimeout(
      navigator.serviceWorker.ready,
      20_000,
      "Service worker is still starting. Please try again in a moment."
    );

    if (!readyRegistration.active) {
      throw new Error("Service worker is still starting. Please try again in a moment.");
    }

    return readyRegistration;
  } catch (error) {
    console.error("[push-enable] service worker registration failed", error);
    if (error instanceof Error && error.message.includes("still starting")) {
      throw error;
    }
    throw new Error("Service worker registration failed. Refresh the app and try again.");
  }
}

export async function refreshPushSubscription() {
  if (!isPushSupported()) {
    if (isIOSBrowser() && !isStandalonePwa()) {
      throw new Error("On iPhone or iPad, install the app to your Home Screen, open it from the Home Screen, then enable notifications.");
    }
    throw new Error("Push notifications are not supported on this device or browser.");
  }
  if (!isSecurePushContext()) {
    throw new Error("Push notifications require HTTPS. Open the secure app link and try again.");
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await withTimeout(
        Notification.requestPermission(),
        30_000,
        "Notification permission request timed out."
      );

  if (permission !== "granted" || Notification.permission !== "granted") {
    throw new Error(
      Notification.permission === "denied"
        ? "Notifications are blocked in your browser settings."
        : "Notification permission was dismissed."
    );
  }

  const registration = await ensureServiceWorkerRegistration();
  const refreshDiagnostics: PushRefreshDiagnostics = {
    deviceId: getPushDeviceId(),
    currentAppPublicKeyFingerprint: getVapidFingerprint(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    browserSubscriptionApplicationServerKeyFingerprintBefore: null,
    browserSubscriptionCreatedWithCurrentKeyBefore: null,
    oldEndpointHashBeforeRefresh: null,
    unsubscribeAttempted: false,
    unsubscribeReturned: null,
    getSubscriptionAfterUnsubscribeIsNull: null,
    newSubscribeAttempted: false,
    newEndpointHashAfterSubscribe: null,
    newEndpointDiffersFromOldEndpoint: null,
    browserSubscriptionApplicationServerKeyFingerprintAfter: null,
    browserSubscriptionCreatedWithCurrentKeyAfter: null,
    saveNewEndpointResult: "not_attempted",
    warning: null,
  };
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    refreshDiagnostics.oldEndpointHashBeforeRefresh = await hashForDiagnostics(existing.endpoint);
    const existingKeyFingerprint = getPushSubscriptionApplicationServerKeyFingerprint(existing);
    refreshDiagnostics.browserSubscriptionApplicationServerKeyFingerprintBefore = existingKeyFingerprint;
    refreshDiagnostics.browserSubscriptionCreatedWithCurrentKeyBefore =
      existingKeyFingerprint === null
        ? "Browser does not expose subscription applicationServerKey."
        : existingKeyFingerprint === refreshDiagnostics.currentAppPublicKeyFingerprint;
    refreshDiagnostics.unsubscribeAttempted = true;
    await fetch("/api/push/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: existing.endpoint, device_id: getPushDeviceId() }),
    }).catch(() => null);
    refreshDiagnostics.unsubscribeReturned = await existing.unsubscribe().catch(() => false);
  }

  const afterUnsubscribe = await registration.pushManager.getSubscription();
  refreshDiagnostics.getSubscriptionAfterUnsubscribeIsNull = afterUnsubscribe === null;
  if (afterUnsubscribe) {
    rememberPushRefreshDiagnostics(refreshDiagnostics);
    throw new Error(
      "The browser kept the old push subscription. Clear site data or browser notification permission and try again."
    );
  }

  refreshDiagnostics.newSubscribeAttempted = true;
  const subscription = await withTimeout(
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: getApplicationServerKey(),
    }),
    20_000,
    "Browser push subscription timed out."
  );
  refreshDiagnostics.newEndpointHashAfterSubscribe = await hashForDiagnostics(subscription.endpoint);
  refreshDiagnostics.newEndpointDiffersFromOldEndpoint =
    refreshDiagnostics.oldEndpointHashBeforeRefresh
      ? refreshDiagnostics.newEndpointHashAfterSubscribe !== refreshDiagnostics.oldEndpointHashBeforeRefresh
      : null;
  const newKeyFingerprint = getPushSubscriptionApplicationServerKeyFingerprint(subscription);
  refreshDiagnostics.browserSubscriptionApplicationServerKeyFingerprintAfter = newKeyFingerprint;
  refreshDiagnostics.browserSubscriptionCreatedWithCurrentKeyAfter =
    newKeyFingerprint === null
      ? "Browser does not expose subscription applicationServerKey."
      : newKeyFingerprint === refreshDiagnostics.currentAppPublicKeyFingerprint;
  if (refreshDiagnostics.newEndpointDiffersFromOldEndpoint === false) {
    refreshDiagnostics.warning =
      "Browser returned the same push endpoint after resubscribe. If test push fails, clear site data/notification permission and enable again.";
  }

  try {
    await saveCurrentPushSubscription(subscription);
    refreshDiagnostics.saveNewEndpointResult = "saved";
  } catch (error) {
    refreshDiagnostics.saveNewEndpointResult =
      error instanceof Error ? `failed: ${error.message}` : "failed";
    rememberPushRefreshDiagnostics(refreshDiagnostics);
    throw error;
  }
  rememberPushRefreshDiagnostics(refreshDiagnostics);
  return subscription;
}

function waitForServiceWorkerActivation(worker: ServiceWorker) {
  if (worker.state === "activated") return Promise.resolve();

  return withTimeout(
    new Promise<void>((resolve) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve();
      });
    }),
    20_000,
    "Service worker is still starting. Please try again in a moment."
  );
}

export async function getPushPreferences() {
  const response = await fetch("/api/push/preferences", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Could not load notification preferences.");
  }
  return (await response.json()) as PushPreferences;
}

export async function getCurrentBrowserPushSubscription() {
  if (!isPushSupported()) return null;
  const registration =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.ready);
  return registration.pushManager.getSubscription();
}

export function getPushSubscriptionKeys(subscription: PushSubscription | null) {
  if (!subscription) return null;
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh || bufferToBase64Url(subscription.getKey("p256dh"));
  const auth = json.keys?.auth || bufferToBase64Url(subscription.getKey("auth"));
  if (!p256dh || !auth) return null;
  return { p256dh, auth };
}

function buildSubscriptionSavePayload(subscription: PushSubscription) {
  return {
    ...subscription.toJSON(),
    device_id: getPushDeviceId(),
    platform: getClientPlatform(),
    vapid_key_fingerprint: getVapidFingerprint(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    vapid_public_key_fingerprint: getVapidFingerprint(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  };
}

function getClientPlatform() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
  if (ua.includes("android")) return "android";
  return "desktop";
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function savePushPreferences(update: Partial<PushPreferences>) {
  const response = await fetch("/api/push/preferences", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(update),
  });
  if (!response.ok) {
    throw new Error("Could not save notification preferences.");
  }
  return (await response.json()) as PushPreferences;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function bufferToBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getApplicationServerKey(): ArrayBuffer {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.error("[push-enable] missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
    throw new Error("Push notifications are not configured. Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
  }

  try {
    return urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer;
  } catch (error) {
    console.error("[push-enable] invalid NEXT_PUBLIC_VAPID_PUBLIC_KEY", error);
    throw new Error("Push notifications are misconfigured. NEXT_PUBLIC_VAPID_PUBLIC_KEY is invalid.");
  }
}
