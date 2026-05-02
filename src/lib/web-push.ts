import crypto from "crypto";
import { categoryForNotificationKind, soundForNotificationKind } from "@/lib/push-categories";
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

const DEFAULT_PREFS: NotificationPreferenceRow = {
  messages: true,
  shift_assignments: true,
  trades: true,
  incidents: true,
  general: true,
};

export async function sendPushForNotifications(
  admin: SupabaseAdmin,
  notifications: NotificationRow[]
) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject || notifications.length === 0) {
    return;
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
  if (activeSubscriptions.length === 0) return;

  const { data: preferenceRows } = await admin
    .from("notification_preferences")
    .select("user_id, messages, shift_assignments, trades, incidents, general")
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

  await Promise.all(
    notifications.flatMap((notification) => {
      const category = categoryForNotificationKind(notification.kind);
      const prefs = prefsByUser.get(notification.recipient_id) ?? DEFAULT_PREFS;
      if (!prefs[category]) return [];

      const userSubscriptions =
        subscriptionsByUser.get(notification.recipient_id) ?? [];

      return userSubscriptions.map(async (subscription) => {
        const result = await sendWebPush(subscription, {
          title: notification.title,
          body: notification.body ?? "",
          url: notification.link ?? "/notifications",
          tag: notification.kind,
          sound: soundForNotificationKind(notification.kind),
          relatedShiftId: notification.related_shift_id ?? null,
        });

        if (result.status === 404 || result.status === 410) {
          disabledIds.push(subscription.id);
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
}

async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: Record<string, unknown>
) {
  const endpoint = new URL(subscription.endpoint);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
  const subject = process.env.VAPID_SUBJECT!;
  const body = encryptPayload(
    JSON.stringify(payload),
    subscription.p256dh,
    subscription.auth
  );

  const jwt = createVapidJwt(endpoint.origin, subject, vapidPublicKey, vapidPrivateKey);

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: "2419200",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      Urgency: payload.sound === "urgent" ? "high" : "normal",
    },
    body,
  });
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
