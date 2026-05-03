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
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("Push notifications are not configured.");
  }

  const permission = await withTimeout(
    Notification.requestPermission(),
    30_000,
    "Notification permission request timed out."
  );
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this browser. Enable them in browser settings and try again."
        : "Notification permission was dismissed."
    );
  }

  const registration = await withTimeout(
    navigator.serviceWorker.ready,
    15_000,
    "Service worker was not ready. Refresh the app and try again."
  );
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

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
    throw new Error(data?.error ?? "Could not save push subscription.");
  }

  const status = await getPushDeviceStatus(subscription.endpoint);
  if (!status.enabled) {
    throw new Error("Push subscription was not saved for this device.");
  }

  return subscription;
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
  const registration = await navigator.serviceWorker.ready;
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
