"use client";

export type PushPreferences = {
  messages: boolean;
  shift_assignments: boolean;
  trades: boolean;
  incidents: boolean;
  general: boolean;
  sounds_enabled: boolean;
  message_sound_enabled: boolean;
  urgent_incident_sound_enabled: boolean;
};

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
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
    throw new Error("Push notifications are not supported in this browser.");
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.error("[push-enable] missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
    throw new Error("Push notifications are not configured. Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
  }

  let applicationServerKey: ArrayBuffer;
  try {
    applicationServerKey = urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer;
  } catch (error) {
    console.error("[push-enable] invalid NEXT_PUBLIC_VAPID_PUBLIC_KEY", error);
    throw new Error("Push notifications are misconfigured. NEXT_PUBLIC_VAPID_PUBLIC_KEY is invalid.");
  }

  try {
    logStep("requesting permission");
    const permission = await withTimeout(
      Notification.requestPermission(),
      30_000,
      "Notification permission request timed out."
    );
    if (permission !== "granted") {
      console.error("[push-enable] permission not granted", permission);
      throw new Error(
        permission === "denied"
          ? "Notifications are blocked for this browser. Enable them in browser settings and try again."
          : "Notification permission was dismissed."
      );
    }

    logStep("registering service worker");
    const registration = await ensureServiceWorkerRegistration();

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
        body: JSON.stringify(subscription.toJSON()),
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
  return (await response.json()) as { enabled: boolean; endpoint: string | null };
}

export async function saveCurrentPushSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subscription.toJSON()),
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
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return await withTimeout(
      navigator.serviceWorker.register("/sw.js"),
      15_000,
      "Service worker registration timed out."
    );
  } catch (error) {
    console.error("[push-enable] service worker registration failed", error);
    throw new Error("Service worker registration failed. Refresh the app and try again.");
  }
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
