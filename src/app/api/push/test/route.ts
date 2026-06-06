import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToSubscription } from "@/lib/web-push";
import { getServerVapidStatus, type ServerVapidStatus } from "@/lib/vapid-server";

export const dynamic = "force-dynamic";

type TestPushRequest = {
  deviceId?: string;
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  p256dh?: string;
  auth?: string;
  browserSubscriptionExists?: boolean;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  device_id: string | null;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  is_active: boolean;
  vapid_key_fingerprint: string | null;
  updated_at: string | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "permission_denied" }, { status: 401 });
    }

    const admin = createAdminClient();
    const payload = (await request.json().catch(() => ({}))) as TestPushRequest;
    const serverVapid = getServerVapidStatus();
    const lookup = await findCurrentDeviceSubscription(
      admin,
      user.id,
      payload.deviceId,
      payload.endpoint
    );

    if (!lookup.subscription) {
      const savedSubscriptionInactive =
        lookup.diagnostics?.savedSubscriptionInactive === true ||
        lookup.diagnostics?.exactEndpointActive === false;
      return NextResponse.json(
        {
          error: savedSubscriptionInactive
            ? "The app saved this device's subscription, but it is marked inactive. Refresh should reactivate it."
            : "No active matching push subscription was found for this device. Refresh notifications to save this device's current subscription.",
          code: savedSubscriptionInactive ? "saved_subscription_inactive" : "no_active_matching_subscription",
          diagnostics: {
            browserSubscriptionExists: payload.browserSubscriptionExists ?? null,
            browserEndpointProvided: Boolean(payload.endpoint),
            deviceIdProvided: Boolean(payload.deviceId),
            endpointProvided: Boolean(payload.endpoint),
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
            ...lookup.diagnostics,
          },
        },
        { status: 409 }
      );
    }

    if (!lookup.subscription.p256dh || !lookup.subscription.auth) {
      return NextResponse.json(
        {
          error: "The saved push subscription is missing browser keys. Refresh notifications to save this device again.",
          code: "subscription_keys_missing",
          diagnostics: {
            browserSubscriptionExists: payload.browserSubscriptionExists ?? null,
            deviceIdProvided: Boolean(payload.deviceId),
            endpointProvided: Boolean(payload.endpoint),
            serverRowExists: true,
            serverRowActive: lookup.subscription.is_active,
            subscriptionKeysPresent: false,
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
          },
        },
        { status: 409 }
      );
    }

    const currentP256dh = payload.keys?.p256dh || payload.p256dh || null;
    const currentAuth = payload.keys?.auth || payload.auth || null;
    const browserKeysProvided = Boolean(currentP256dh && currentAuth);
    const browserKeysMatch =
      browserKeysProvided &&
      lookup.subscription.p256dh === currentP256dh &&
      lookup.subscription.auth === currentAuth;

    if (browserKeysProvided && !browserKeysMatch) {
      return NextResponse.json(
        {
          error: "The saved push subscription keys for this device are stale. Refresh notifications needs to update the saved subscription keys.",
          code: "saved_subscription_keys_stale",
          diagnostics: {
            browserSubscriptionExists: payload.browserSubscriptionExists ?? null,
            browserEndpointProvided: Boolean(payload.endpoint),
            deviceIdProvided: Boolean(payload.deviceId),
            endpointProvided: Boolean(payload.endpoint),
            serverRowExists: true,
            serverRowActive: lookup.subscription.is_active,
            endpointMatch: payload.endpoint ? lookup.subscription.endpoint === payload.endpoint : null,
            subscriptionKeysPresent: true,
            subscriptionKeysMatch: false,
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
          },
        },
        { status: 409 }
      );
    }

    if (!serverVapid.publicKeyPresent || !serverVapid.privateKeyPresent || !serverVapid.subjectPresent) {
      return NextResponse.json(
        {
          error: "Push notifications are not configured on the server.",
          code: "server_push_not_configured",
          diagnostics: {
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
          },
        },
        { status: 500 }
      );
    }

    if (!serverVapid.keyPairValid) {
      return NextResponse.json(
        {
          error: "The server notification key appears to be different from the app notification key. The app owner needs to check VAPID environment variables and redeploy.",
          code: "server_vapid_mismatch",
          diagnostics: {
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
          },
        },
        { status: 500 }
      );
    }

    if (
      lookup.subscription.vapid_key_fingerprint &&
      serverVapid.serverPublicKeyFingerprint &&
      lookup.subscription.vapid_key_fingerprint !== serverVapid.serverPublicKeyFingerprint
    ) {
      return NextResponse.json(
        {
          error: "This device subscription was created with a different app notification key. Refresh notifications on this device.",
          code: "stale_subscription_key",
          diagnostics: {
            savedSubscriptionFingerprint: lookup.subscription.vapid_key_fingerprint,
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
          },
        },
        { status: 409 }
      );
    }

    const result = await sendPushToSubscription(
      admin,
      {
        id: lookup.subscription.id,
        endpoint: lookup.subscription.endpoint,
        p256dh: lookup.subscription.p256dh,
        auth: lookup.subscription.auth,
      },
      {
        title: "Test notification",
        body: "This is a test alert from your settings page.",
        url: "/me/notifications",
        tag: "general",
        sound: "normal",
      }
    );

    if (result.skipped === "no_subscriptions") {
      return NextResponse.json(
        {
          error: "No active push subscription was found for this device. Refresh subscription or enable alerts again.",
          code: "no_subscription",
          diagnostics: result,
        },
        { status: 409 }
      );
    }
    if (result.skipped === "not_configured") {
      return NextResponse.json(
        {
          error: "Push notifications are not configured on the server.",
          code: "server_push_not_configured",
          diagnostics: result,
        },
        { status: 500 }
      );
    }
    if (result.delivered === 0) {
      const firstFailure = result.failures[0];
      const status = firstFailure?.status;
      
      let errorCode = "rejected_by_push_service";
      if (status === 404 || status === 410) {
        errorCode = "expired_subscription";
      } else if (status === 401 || status === 403) {
        errorCode = "saved_subscription_keys_stale";
      }

      const error = describePushFailure(status, firstFailure?.reason);
      return NextResponse.json(
        {
          error,
          code: errorCode,
          diagnostics: result,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, code: "success", diagnostics: result });
  } catch (err: any) {
    console.error("[push-test] error", err);
    return NextResponse.json(
      {
        error: err.message || "Failed to send test push",
        code: "unknown_error",
      },
      { status: 500 }
    );
  }
}

async function findCurrentDeviceSubscription(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  deviceId?: string,
  endpoint?: string
) {
  const selectFields =
    "id, user_id, device_id, endpoint, p256dh, auth, is_active, vapid_key_fingerprint, updated_at";

  let activeQuery = admin
    .from("push_subscriptions")
    .select(selectFields)
    .eq("user_id", userId)
    .eq("is_active", true);

  if (deviceId) activeQuery = activeQuery.eq("device_id", deviceId);
  else if (endpoint) activeQuery = activeQuery.eq("endpoint", endpoint);

  const { data: activeRows } = await activeQuery
    .order("updated_at", { ascending: false })
    .limit(1);
  const active = (activeRows?.[0] ?? null) as PushSubscriptionRow | null;

  if (active && (!endpoint || active.endpoint === endpoint)) {
    return {
      subscription: active,
      diagnostics: {
        serverActiveRowFound: true,
        endpointMatch: endpoint ? active.endpoint === endpoint : null,
        deviceIdMatch: deviceId ? active.device_id === deviceId : null,
        subscriptionKeysPresent: Boolean(active.p256dh && active.auth),
      },
    };
  }

  const diagnostics: Record<string, unknown> = {
    serverActiveRowFound: Boolean(active),
    endpointMatch: active && endpoint ? active.endpoint === endpoint : false,
    deviceIdMatch: active && deviceId ? active.device_id === deviceId : false,
    serverRowExistsButInactive: false,
    serverRowExistsWithDifferentDeviceId: false,
    serverRowExistsWithMismatchedEndpoint: Boolean(active && endpoint && active.endpoint !== endpoint),
    serverRowMissingKeys: Boolean(active && (!active.p256dh || !active.auth)),
    serverRowsForDevice: null,
    activeRowsForDevice: null,
    latestRowActive: null,
    latestRowFingerprintStatus: null,
  };

  if (deviceId) {
    const { data: deviceRows } = await admin
      .from("push_subscriptions")
      .select(selectFields)
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .order("updated_at", { ascending: false })
      .limit(20);
    const row = (deviceRows?.[0] ?? null) as PushSubscriptionRow | null;
    diagnostics.serverRowsForDevice = deviceRows?.length ?? 0;
    diagnostics.activeRowsForDevice = deviceRows?.filter((item) => item.is_active).length ?? 0;
    diagnostics.latestRowActive = row?.is_active ?? null;
    diagnostics.latestRowFingerprintStatus = describeFingerprintStatus(row?.vapid_key_fingerprint ?? null);
    diagnostics.serverRowExistsButInactive = Boolean(row && !row.is_active);
    diagnostics.serverRowExistsWithMismatchedEndpoint = Boolean(
      row && endpoint && row.endpoint !== endpoint
    );
    diagnostics.serverRowMissingKeys = Boolean(row && (!row.p256dh || !row.auth));
  }

  if (endpoint) {
    const { data: endpointRows } = await admin
      .from("push_subscriptions")
      .select(selectFields)
      .eq("user_id", userId)
      .eq("endpoint", endpoint)
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = (endpointRows?.[0] ?? null) as PushSubscriptionRow | null;
    diagnostics.exactEndpointRowFound = Boolean(row);
    diagnostics.exactEndpointActive = row?.is_active ?? null;
    diagnostics.savedSubscriptionInactive = Boolean(row && !row.is_active);
    diagnostics.endpointMatch = row ? true : diagnostics.endpointMatch;
    diagnostics.latestRowActive = row?.is_active ?? diagnostics.latestRowActive;
    diagnostics.latestRowFingerprintStatus =
      row ? describeFingerprintStatus(row.vapid_key_fingerprint ?? null) : diagnostics.latestRowFingerprintStatus;
    diagnostics.serverRowExistsWithDifferentDeviceId = Boolean(
      row && deviceId && row.device_id !== deviceId
    );
    diagnostics.serverRowExistsButInactive =
      Boolean(diagnostics.serverRowExistsButInactive) || Boolean(row && !row.is_active);
    diagnostics.serverRowMissingKeys =
      Boolean(diagnostics.serverRowMissingKeys) || Boolean(row && (!row.p256dh || !row.auth));

    if (row?.is_active && row.p256dh && row.auth) {
      return { subscription: row, diagnostics };
    }
  }

  return { subscription: null, diagnostics };
}

function describePushFailure(status?: number, reason?: string) {
  if (status === 404 || status === 410) {
    return "The saved push subscription has expired. Refresh notifications or enable alerts again on this device.";
  }
  if (status === 401 || status === 403) {
    return "The saved push subscription keys for this device are stale. Refresh notifications needs to update the saved subscription keys.";
  }
  if (status === 400) {
    return "The browser push service rejected the subscription payload. Refresh notifications, then send another test.";
  }
  return reason || "The browser push service did not accept the test notification. Check OS/browser notification settings, Focus or Do Not Disturb, battery optimization, and installed PWA state.";
}

function describeFingerprintStatus(fingerprint: string | null) {
  if (!fingerprint) return "missing";
  if (fingerprint === "invalid_key") return "invalid_key";
  return "present";
}

function getSafeServerVapidDiagnostics(status: ServerVapidStatus) {
  return {
    publicKeyPresent: status.publicKeyPresent,
    privateKeyPresent: status.privateKeyPresent,
    subjectPresent: status.subjectPresent,
    serverPublicKeyFingerprint: status.serverPublicKeyFingerprint || null,
    keyPairValid: status.keyPairValid,
    error: status.error,
  };
}
