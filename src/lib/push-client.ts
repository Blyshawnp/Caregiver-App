"use client";

import type {
  NotificationCategoryPreferenceMap,
} from "@/lib/notification-preferences";
import { getVapidFingerprint } from "@/lib/vapid-helper";

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

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
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
        body: JSON.stringify({
          ...subscription.toJSON(),
          vapid_key_fingerprint: getVapidFingerprint(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
        }),
      }),
      15_000,
      "Saving push subscription timed out."
    );

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      console.error("[push-enable] database save failed", data);
      throw new Error(data?.error ?? "Could not save push subscription.");
    }

    logStep("verifying saved subscription");
    const status = await getPushDeviceStatus(subscription.endpoint);
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

export async function getPushDeviceStatus(endpoint?: string | null) {
  const query = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : "";
  const response = await fetch(`/api/push/subscriptions${query}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not verify push subscription.");
  }
  return (await response.json()) as {
    enabled: boolean;
    endpoint: string | null;
    lastSeenAt?: string | null;
    updatedAt?: string | null;
    platform?: string | null;
    vapidKeyFingerprint?: string | null;
  };
}

export async function saveCurrentPushSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...subscription.toJSON(),
      vapid_key_fingerprint: getVapidFingerprint(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
    }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not save push subscription.");
  }
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
    body: JSON.stringify({ endpoint: subscription?.endpoint }),
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
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await fetch("/api/push/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: existing.endpoint }),
    }).catch(() => null);
    await existing.unsubscribe().catch(() => false);
  }

  const subscription = await withTimeout(
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: getApplicationServerKey(),
    }),
    20_000,
    "Browser push subscription timed out."
  );

  await saveCurrentPushSubscription(subscription);
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
