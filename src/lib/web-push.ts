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
import { getServerVapidDetails, type ServerVapidDetails, type ServerVapidStatus } from "@/lib/vapid-server";

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
  configuration?: ServerVapidStatus;
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
  const vapid = getServerVapidDetails();

  if (!vapid.details || notifications.length === 0) {
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      disabled: 0,
      skipped: notifications.length === 0 ? "no_notifications" : "not_configured",
      failures: [],
      configuration: vapid.status,
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
        const result = await sendWebPush(
          subscription,
          {
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
          },
          vapid.details
        );

        if (result.status === 404 || result.status === 410) {
          disabledIds.push(subscription.id);
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

  return {
    attempted,
    delivered,
    failed: failures.length,
    disabled: disabledIds.length,
    skipped: null,
    failures,
    configuration: vapid.status,
  };
}

export async function sendPushToSubscription(
  admin: SupabaseAdmin,
  subscription: PushSubscriptionRow,
  payload: Record<string, unknown>
): Promise<PushDeliveryResult & {
  providerStatus?: number;
  providerBodySummary?: string;
  providerEndpointOrigin?: string;
  sendClassification?: string;
  suggestedNextStep?: string;
}> {
  const vapid = getServerVapidDetails();

  if (!vapid.details) {
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      disabled: 0,
      skipped: "not_configured",
      failures: [],
      configuration: vapid.status,
    };
  }

  const result = await sendWebPush(subscription, payload, vapid.details);
  const shouldDisable = result.status === 404 || result.status === 410;

  if (shouldDisable) {
    const update: Record<string, string | boolean> = {
      is_active: false,
      disabled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await admin
      .from("push_subscriptions")
      .update(update)
      .eq("id", subscription.id);
  }

  // Determine suggested next step
  let suggestedNextStep = "Check network status or try again.";
  if (result.classification === "expired_or_gone") {
    suggestedNextStep = "The subscription is expired. Refresh notifications or re-enable alerts on this device.";
  } else if (result.classification === "subscription_invalid") {
    suggestedNextStep = "The subscription payload is invalid. Refresh notifications to create a new subscription.";
  } else if (result.classification === "fcm_403" || result.classification === "vapid_auth_rejected") {
    suggestedNextStep = "VAPID configuration or signature mismatch. Verify VAPID_PRIVATE_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY match.";
  }

  return {
    attempted: 1,
    delivered: result.ok ? 1 : 0,
    failed: result.ok ? 0 : 1,
    disabled: shouldDisable ? 1 : 0,
    skipped: null,
    failures: result.ok
      ? []
      : [
          {
            status: result.status,
            endpointHost: result.endpointHost,
            reason: reasonForPushStatus(result.status),
          },
        ],
    configuration: vapid.status,
    providerStatus: result.status,
    providerBodySummary: result.bodyText,
    providerEndpointOrigin: result.endpointOrigin,
    sendClassification: result.classification,
    suggestedNextStep,
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
  payload: Record<string, unknown>,
  vapid: ServerVapidDetails
) {
  const endpoint = new URL(subscription.endpoint);
  let body: Buffer;
  try {
    body = encryptPayload(
      JSON.stringify(payload),
      subscription.p256dh,
      subscription.auth
    );
  } catch (err: any) {
    return {
      ok: false,
      status: 400,
      bodyText: "Invalid push subscription keys",
      endpointOrigin: endpoint.origin,
      endpointHost: endpoint.host,
      classification: "subscription_invalid",
    };
  }

  const jwt = createVapidJwt(endpoint.origin, vapid.subject, vapid.publicKey, vapid.privateKey);

  try {
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        TTL: "2419200",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
        Urgency:
          payload.sound === "urgent" || payload.sound === "urgent_alert"
            ? "high"
            : "normal",
      },
      body: new Uint8Array(body),
    });

    const bodyText = await response.text().catch(() => "");
    
    // Classify error
    let classification = "unknown_provider_error";
    if (response.ok) {
      classification = "success";
    } else if (response.status === 404 || response.status === 410) {
      classification = "expired_or_gone";
    } else if (response.status === 400) {
      classification = "subscription_invalid";
    } else if (response.status === 401 || response.status === 403) {
      if (endpoint.host.includes("fcm.googleapis.com")) {
        classification = "fcm_403";
      } else {
        classification = "vapid_auth_rejected";
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      bodyText,
      endpointOrigin: endpoint.origin,
      endpointHost: endpoint.host,
      classification,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 500,
      bodyText: err.message || "Network error",
      endpointOrigin: endpoint.origin,
      endpointHost: endpoint.host,
      classification: "unknown_provider_error",
    };
  }
}

function reasonForPushStatus(status: number) {
  if (status === 404 || status === 410) return "Subscription expired or was removed by the browser push service.";
  if (status === 400) return "Browser push service rejected the subscription or payload.";
  if (status === 401 || status === 403) return "Browser push service rejected the current subscription. Refresh notifications, then verify VAPID configuration if it continues.";
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
      d: base64UrlEncode(base64UrlToBuffer(privateKeyBase64Url)),
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
  let offset = 0;
  if (signature[0] !== 0x30) return "";
  offset += 2; // skip 0x30 and length
  
  if (signature[offset] !== 0x02) return "";
  offset += 1;
  const rLen = signature[offset];
  offset += 1;
  let rStart = offset;
  let rLenActual = rLen;
  if (signature[rStart] === 0x00) {
    rStart += 1;
    rLenActual -= 1;
  }
  const r = signature.subarray(rStart, rStart + rLenActual);
  offset += rLen;
  
  if (signature[offset] !== 0x02) return "";
  offset += 1;
  const sLen = signature[offset];
  offset += 1;
  let sStart = offset;
  let sLenActual = sLen;
  if (signature[sStart] === 0x00) {
    sStart += 1;
    sLenActual -= 1;
  }
  const s = signature.subarray(sStart, sStart + sLenActual);
  
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
