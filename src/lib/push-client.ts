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

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subscription.toJSON()),
  });

  return subscription;
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ endpoint: subscription?.endpoint }),
  });
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
