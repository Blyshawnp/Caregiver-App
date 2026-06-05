import crypto from "crypto";
import { categoryForNotificationKind, soundForNotificationKind } from "@/lib/push-categories";
import {
  DEFAULT_CATEGORY_PREFERENCES,
  normalizeCategoryPreferences,
  preferenceCategoryForNotificationKind,
  toneForNotificationKind,
  type NotificationCategoryPreferenceMap,
} from "@/lib/notification-preferences";
import type { createAdminClient } from "@/lib/supabase/admin";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NotificationPreferenceRow = {
  messages: boolean;
  shift_assignments: boolean;
  trades: boolean;
  incidents: boolean;
  general: boolean;
  category_preferences: NotificationCategoryPreferenceMap | null;
  privacy_safe_bodies: boolean | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  urgent_override_quiet_hours: boolean | null;
};

type NotificationRow = {
  recipient_id: string;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  related_shift_id?: string | null;
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
export type PushDeliveryResult = {
  attempted: number;
  delivered: number;
  failed: number;
  disabled: number;
  skipped: "not_configured" | "no_notifications" | "no_subscriptions" | null;
  failures: Array<{ status: number; endpointHost: string; reason?: string }>;
};

const DEFAULT_PREFS: NotificationPreferenceRow = {
  messages: true,
  shift_assignments: true,
  trades: true,
  incidents: true,
  general: true,
  category_preferences: DEFAULT_CATEGORY_PREFERENCES,
  privacy_safe_bodies: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
  urgent_override_quiet_hours: true,
};

export async function sendPushForNotifications(
  admin: SupabaseAdmin,
  notifications: NotificationRow[]
): Promise<PushDeliveryResult> {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject || notifications.length === 0) {
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      disabled: 0,
      skipped: notifications.length === 0 ? "no_notifications" : "not_configured",
      failures: [],
    };
  }

  const recipientIds = Array.from(
    new Set(notifications.map((row) => row.recipient_id))
  );

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("is_active", true)
    .in("user_id", recipientIds);

  const activeSubscriptions = (subscriptions ?? []).filter(Boolean);
  if (activeSubscriptions.length === 0) {
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      disabled: 0,
      skipped: "no_subscriptions",
      failures: [],
    };
  }

  const { data: preferenceRows } = await admin
    .from("notification_preferences")
    .select("user_id, messages, shift_assignments, trades, incidents, general, category_preferences, privacy_safe_bodies, quiet_hours_start, quiet_hours_end, urgent_override_quiet_hours")
    .in("user_id", recipientIds);

  const prefsByUser = new Map<string, NotificationPreferenceRow>();
  for (const row of preferenceRows ?? []) {
    prefsByUser.set(row.user_id, row);
  }

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const subscription of activeSubscriptions) {
    const list = subscriptionsByUser.get(subscription.user_id) ?? [];
    list.push(subscription);
    subscriptionsByUser.set(subscription.user_id, list);
  }

  const disabledIds: string[] = [];
  const invalidKeyIds: string[] = [];
  const failures: PushDeliveryResult["failures"] = [];
  let attempted = 0;
  let delivered = 0;

  await Promise.all(
    notifications.flatMap((notification) => {
      const category = categoryForNotificationKind(notification.kind);
      const prefs = prefsByUser.get(notification.recipient_id) ?? DEFAULT_PREFS;
      if (!prefs[category]) return [];
      const preferenceCategory = preferenceCategoryForNotificationKind(notification.kind);
      const categoryPreferences = normalizeCategoryPreferences(prefs.category_preferences);
      const categoryPref = categoryPreferences[preferenceCategory];
      if (!categoryPref.enabled || !categoryPref.pushEnabled) return [];
      if (
        categoryPref.quietHoursAllowed &&
        isQuietHoursNow(prefs.quiet_hours_start, prefs.quiet_hours_end) &&
        !(preferenceCategory === "urgent_alerts" && prefs.urgent_override_quiet_hours !== false)
      ) {
        return [];
      }

      const userSubscriptions =
        subscriptionsByUser.get(notification.recipient_id) ?? [];

      return userSubscriptions.map(async (subscription) => {
        attempted += 1;
        const payloadTone = categoryPref.inAppSoundEnabled
          ? categoryPref.tone
          : "silent";
        const result = await sendWebPush(subscription, {
          title: notification.title,
          body:
            prefs.privacy_safe_bodies === false
              ? notification.body ?? ""
              : "Open the app to view details.",
          url: notification.link ?? "/notifications",
          tag: notification.kind,
          sound: payloadTone === "default" ? toneForNotificationKind(notification.kind) : payloadTone,
          legacySound: soundForNotificationKind(notification.kind),
          relatedShiftId: notification.related_shift_id ?? null,
        });

        if (result.status === 404 || result.status === 410) {
          disabledIds.push(subscription.id);
        } else if (result.status === 401 || result.status === 403) {
          invalidKeyIds.push(subscription.id);
        }
        if (result.ok) {
          delivered += 1;
        } else {
          failures.push({
            status: result.status,
            endpointHost: new URL(subscription.endpoint).host,
            reason: reasonForPushStatus(result.status),
          });
        }
      });
    })
  );

  if (disabledIds.length > 0) {
    await admin
      .from("push_subscriptions")
      .update({
        is_active: false,
        disabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", disabledIds);
  }

  if (invalidKeyIds.length > 0) {
    await admin
      .from("push_subscriptions")
      .update({
        is_active: false,
        vapid_key_fingerprint: "invalid_key",
        disabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", invalidKeyIds);
  }

  return {
    attempted,
    delivered,
    failed: failures.length,
    disabled: disabledIds.length + invalidKeyIds.length,
    skipped: null,
    failures,
  };
}

function isQuietHoursNow(start: string | null, end: string | null) {
  if (!start || !end) return false;
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return false;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: Record<string, unknown>
) {
  const endpoint = new URL(subscription.endpoint);
  const vapidPublicKey =
    process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
  const subject = process.env.VAPID_SUBJECT!;
  let body: Buffer;
  try {
    body = encryptPayload(
      JSON.stringify(payload),
      subscription.p256dh,
      subscription.auth
    );
  } catch {
    return new Response("Invalid push subscription keys", {
      status: 400,
      statusText: "Invalid Subscription",
    });
  }

  const jwt = createVapidJwt(endpoint.origin, subject, vapidPublicKey, vapidPrivateKey);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: "2419200",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      Urgency:
        payload.sound === "urgent" || payload.sound === "urgent_alert"
          ? "high"
          : "normal",
    },
    body: new Uint8Array(body),
  });

  return response;
}

function reasonForPushStatus(status: number) {
  if (status === 404 || status === 410) return "Subscription expired or was removed by the browser push service.";
  if (status === 400) return "Browser push service rejected the subscription or payload.";
  if (status === 401 || status === 403) return "VAPID authentication failed or the subscription was created with older notification keys.";
  if (status === 429) return "Browser push service rate-limited this endpoint.";
  return "Browser push service rejected the test notification.";
}

function encryptPayload(
  payload: string,
  receiverPublicKeyBase64Url: string,
  authSecretBase64Url: string
) {
  const receiverPublicKey = base64UrlToBuffer(receiverPublicKeyBase64Url);
  const authSecret = base64UrlToBuffer(authSecretBase64Url);
  const salt = crypto.randomBytes(16);
  const ecdh = crypto.createECDH("prime256v1");
  const serverPublicKey = ecdh.generateKeys();
  const sharedSecret = ecdh.computeSecret(receiverPublicKey);

  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    receiverPublicKey,
    serverPublicKey,
  ]);
  const prk = hmac(authSecret, sharedSecret);
  const ikm = hmac(prk, keyInfo);
  const cek = hkdf(ikm, salt, "Content-Encoding: aes128gcm\0", 16);
  const nonce = hkdf(ikm, salt, "Content-Encoding: nonce\0", 12);
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  const keyLength = Buffer.from([serverPublicKey.length]);

  return Buffer.concat([
    salt,
    recordSize,
    keyLength,
    serverPublicKey,
    ciphertext,
    tag,
  ]);
}

function createVapidJwt(
  audience: string,
  subject: string,
  publicKeyBase64Url: string,
  privateKeyBase64Url: string
) {
  const header = base64UrlEncode(
    Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  );
  const claims = base64UrlEncode(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      })
    )
  );
  const publicKey = base64UrlToBuffer(publicKeyBase64Url);
  const privateKey = crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncode(publicKey.subarray(1, 33)),
      y: base64UrlEncode(publicKey.subarray(33, 65)),
      d: privateKeyBase64Url,
    },
    format: "jwk",
  });
  const sign = crypto.createSign("SHA256");
  sign.update(`${header}.${claims}`);
  sign.end();
  const derSignature = sign.sign(privateKey);
  return `${header}.${claims}.${derToJose(derSignature)}`;
}

function hkdf(ikm: Buffer, salt: Buffer, info: string, length: number) {
  const prk = hmac(salt, ikm);
  const okm = hmac(prk, Buffer.concat([Buffer.from(info), Buffer.from([1])]));
  return okm.subarray(0, length);
}

function hmac(key: Buffer, data: Buffer) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function derToJose(signature: Buffer) {
  let offset = 3;
  let rLength = signature[offset - 1];
  if (rLength === 33) offset += 1;
  const r = signature.subarray(offset, offset + Math.min(rLength, 32));
  offset += rLength + 2;
  let sLength = signature[offset - 1];
  if (sLength === 33) offset += 1;
  const s = signature.subarray(offset, offset + Math.min(sLength, 32));
  return base64UrlEncode(Buffer.concat([leftPad(r, 32), leftPad(s, 32)]));
}

function leftPad(buffer: Buffer, length: number) {
  if (buffer.length === length) return buffer;
  if (buffer.length > length) return buffer.subarray(buffer.length - length);
  return Buffer.concat([Buffer.alloc(length - buffer.length), buffer]);
}

function base64UrlToBuffer(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
