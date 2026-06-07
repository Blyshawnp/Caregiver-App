import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToSubscription } from "@/lib/web-push";
import { getServerVapidStatus, type ServerVapidStatus } from "@/lib/vapid-server";
import { createHash } from "crypto";

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
  appPublicKeyFingerprint?: string;
  testPushId?: string;
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

function shortHash(value?: string | null) {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

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

    const subscription = lookup.subscription;

    if (!subscription) {
      return NextResponse.json(
        {
          error: "No matching push subscription was found for this device. Refresh notifications to save this device's current subscription.",
          code: "no_active_matching_subscription",
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

    // Check is_active
    if (!subscription.is_active) {
      return NextResponse.json(
        {
          error: "The app saved this device's subscription, but it is marked inactive. Refresh should reactivate it.",
          code: "saved_subscription_inactive",
          diagnostics: {
            browserSubscriptionExists: payload.browserSubscriptionExists ?? null,
            browserEndpointProvided: Boolean(payload.endpoint),
            deviceIdProvided: Boolean(payload.deviceId),
            endpointProvided: Boolean(payload.endpoint),
            serverRowExists: true,
            serverRowActive: false,
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
            ...lookup.diagnostics,
          },
        },
        { status: 409 }
      );
    }

    // Check keys present
    if (!subscription.p256dh || !subscription.auth) {
      return NextResponse.json(
        {
          error: "The saved push subscription is missing browser keys. Refresh notifications to save this device again.",
          code: "subscription_keys_missing",
          diagnostics: {
            browserSubscriptionExists: payload.browserSubscriptionExists ?? null,
            deviceIdProvided: Boolean(payload.deviceId),
            endpointProvided: Boolean(payload.endpoint),
            serverRowExists: true,
            serverRowActive: subscription.is_active,
            subscriptionKeysPresent: false,
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
            ...lookup.diagnostics,
          },
        },
        { status: 409 }
      );
    }

    // Check keys match
    const currentP256dh = payload.keys?.p256dh || payload.p256dh || null;
    const currentAuth = payload.keys?.auth || payload.auth || null;
    const browserKeysProvided = Boolean(currentP256dh && currentAuth);
    const p256dhHashMatch = currentP256dh ? shortHash(subscription.p256dh) === shortHash(currentP256dh) : false;
    const authHashMatch = currentAuth ? shortHash(subscription.auth) === shortHash(currentAuth) : false;
    const browserKeysMatch = browserKeysProvided && p256dhHashMatch && authHashMatch;

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
            serverRowActive: subscription.is_active,
            endpointMatch: payload.endpoint ? subscription.endpoint === payload.endpoint : null,
            subscriptionKeysPresent: true,
            subscriptionKeysMatch: false,
            p256dhHashMatches: p256dhHashMatch,
            authHashMatches: authHashMatch,
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
            ...lookup.diagnostics,
          },
        },
        { status: 409 }
      );
    }

    // Check server VAPID configuration
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
          error: serverVapid.error === "invalid_vapid_subject"
            ? "Server VAPID subject is invalid (must start with mailto: or https: and contain no spaces)."
            : "The server notification key appears to be different from the app notification key. The app owner needs to check VAPID environment variables and redeploy.",
          code: serverVapid.error === "invalid_vapid_subject" ? "invalid_vapid_subject" : "server_vapid_mismatch",
          diagnostics: {
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
          },
        },
        { status: 500 }
      );
    }

    // Verify fingerprint match
    const fingerprintMatch = subscription.vapid_key_fingerprint && serverVapid.serverPublicKeyFingerprint && subscription.vapid_key_fingerprint === serverVapid.serverPublicKeyFingerprint;
    const browserAppKeyMatch = payload.appPublicKeyFingerprint ? payload.appPublicKeyFingerprint === serverVapid.serverPublicKeyFingerprint : true;

    if (!fingerprintMatch) {
      return NextResponse.json(
        {
          error: "This device subscription was created with a different app notification key. Refresh notifications on this device.",
          code: "stale_subscription_key",
          diagnostics: {
            savedSubscriptionFingerprint: subscription.vapid_key_fingerprint,
            serverVapid: getSafeServerVapidDiagnostics(serverVapid),
            fingerprintMatches: false,
            ...lookup.diagnostics,
          },
        },
        { status: 409 }
      );
    }

    // Send the push
    const testPushId = payload.testPushId || `test_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${Math.random().toString(36).slice(2, 9)}`;
    const result = await sendPushToSubscription(
      admin,
      {
        id: subscription.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
      {
        title: "Test notification",
        body: "Push alerts are working.",
        tag: `test-push-${testPushId}`,
        url: "/me/notifications",
        type: "test",
        testPushId: testPushId,
        sound: "normal",
      }
    );

    if (result.skipped === "no_subscriptions") {
      return NextResponse.json(
        {
          error: "No active push subscription was found for this device. Refresh subscription or enable alerts again.",
          code: "no_subscription",
          testPushId,
          diagnostics: {
            ...result,
            selectedRowId: subscription.id,
            rowActive: subscription.is_active,
            endpointHash: shortHash(subscription.endpoint),
            p256dhHashMatches: p256dhHashMatch,
            authHashMatches: authHashMatch,
            fingerprintMatches: fingerprintMatch,
            senderRuntime: "Vercel route handler",
            vapidSubjectValid: true,
          },
        },
        { status: 409 }
      );
    }
    if (result.skipped === "not_configured") {
      return NextResponse.json(
        {
          error: "Push notifications are not configured on the server.",
          code: "server_push_not_configured",
          testPushId,
          diagnostics: {
            ...result,
            selectedRowId: subscription.id,
            rowActive: subscription.is_active,
            endpointHash: shortHash(subscription.endpoint),
            p256dhHashMatches: p256dhHashMatch,
            authHashMatches: authHashMatch,
            fingerprintMatches: fingerprintMatch,
            senderRuntime: "Vercel route handler",
            vapidSubjectValid: false,
          },
        },
        { status: 500 }
      );
    }

    if (result.delivered === 0) {
      const firstFailure = result.failures[0];
      const status = firstFailure?.status;
      
      let errorCode = "rejected_by_push_service";
      let errorMsg = describePushFailure(status, firstFailure?.reason, errorCode);

      if (status === 404 || status === 410) {
        errorCode = "expired_subscription";
      } else if (status === 401 || status === 403) {
        if (status === 403 && subscription.is_active && browserKeysMatch && browserAppKeyMatch && fingerprintMatch) {
          errorCode = "push_provider_403_after_valid_subscription";
          errorMsg = "The browser push provider rejected the signed push request. The saved subscription looks valid, so the send path or VAPID send configuration needs inspection.";
        } else {
          errorCode =
            browserKeysProvided && browserKeysMatch && serverVapid.keyPairValid
              ? "provider_rejected_subscription"
              : "saved_subscription_keys_stale";
          errorMsg = describePushFailure(status, firstFailure?.reason, errorCode);
        }
      }

      return NextResponse.json(
        {
          error: errorMsg,
          code: errorCode,
          testPushId,
          diagnostics: {
            ...result,
            selectedRowId: subscription.id,
            rowActive: subscription.is_active,
            endpointHash: shortHash(subscription.endpoint),
            p256dhHashMatches: p256dhHashMatch,
            authHashMatches: authHashMatch,
            fingerprintMatches: fingerprintMatch,
            senderRuntime: "Vercel route handler",
            vapidSubjectValid: true,
            providerStatusCode: result.providerStatus,
            providerBodySummary: result.providerBodySummary,
            providerHeaders: result.safeHeaders,
            endpointOrigin: result.providerEndpointOrigin,
            selectedSubscriptionRowId: subscription.id,
            p256dhHash: shortHash(subscription.p256dh),
            authHash: shortHash(subscription.auth),
            payloadByteLength: result.payloadByteLength,
            ttl: result.ttl,
            urgency: result.urgency,
            contentEncoding: result.contentEncoding,
            selectedRowIdEqualsBrowserRowId: payload.deviceId ? subscription.device_id === payload.deviceId : false,
            selectedEndpointHashEqualsBrowserEndpointHash: payload.endpoint ? subscription.endpoint === payload.endpoint : false,
            selectedP256dhHashEqualsBrowserP256dhHash: p256dhHashMatch,
            selectedAuthHashEqualsBrowserAuthHash: authHashMatch,
            selectedFingerprintMatchesCurrentAppFingerprint: fingerprintMatch,
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      code: "success",
      testPushId,
      diagnostics: {
        ...result,
        selectedRowId: subscription.id,
        rowActive: subscription.is_active,
        endpointHash: shortHash(subscription.endpoint),
        p256dhHashMatches: p256dhHashMatch,
        authHashMatches: authHashMatch,
        fingerprintMatches: fingerprintMatch,
        senderRuntime: "Vercel route handler",
        vapidSubjectValid: true,
        providerStatusCode: result.providerStatus,
        providerBodySummary: result.providerBodySummary,
        providerHeaders: result.safeHeaders,
        endpointOrigin: result.providerEndpointOrigin,
        selectedSubscriptionRowId: subscription.id,
        p256dhHash: shortHash(subscription.p256dh),
        authHash: shortHash(subscription.auth),
        payloadByteLength: result.payloadByteLength,
        ttl: result.ttl,
        urgency: result.urgency,
        contentEncoding: result.contentEncoding,
        selectedRowIdEqualsBrowserRowId: payload.deviceId ? subscription.device_id === payload.deviceId : false,
        selectedEndpointHashEqualsBrowserEndpointHash: payload.endpoint ? subscription.endpoint === payload.endpoint : false,
        selectedP256dhHashEqualsBrowserP256dhHash: p256dhHashMatch,
        selectedAuthHashEqualsBrowserAuthHash: authHashMatch,
        selectedFingerprintMatchesCurrentAppFingerprint: fingerprintMatch,
      }
    });
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

  if (endpoint) {
    let exactQuery = admin
      .from("push_subscriptions")
      .select(selectFields)
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
    if (deviceId) exactQuery = exactQuery.eq("device_id", deviceId);

    const { data: endpointRows } = await exactQuery
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = (endpointRows?.[0] ?? null) as PushSubscriptionRow | null;
    const diagnostics: Record<string, unknown> = {
      activeColumn: "is_active",
      rawIsActive: row?.is_active ?? null,
      rawActive: null,
      status: null,
      selectedSubscriptionId: row?.id ? row.id.slice(0, 8) : null,
      exactEndpointRowFound: Boolean(row),
      exactEndpointActive: row?.is_active ?? null,
      savedSubscriptionInactive: Boolean(row && !row.is_active),
      serverActiveRowFound: Boolean(row?.is_active),
      endpointMatch: Boolean(row),
      deviceIdMatch: row && deviceId ? row.device_id === deviceId : null,
      subscriptionKeysPresent: Boolean(row?.p256dh && row?.auth),
      serverRowExistsButInactive: Boolean(row && !row.is_active),
      serverRowExistsWithDifferentDeviceId: Boolean(row && deviceId && row.device_id !== deviceId),
      serverRowExistsWithMismatchedEndpoint: false,
      serverRowMissingKeys: Boolean(row && (!row.p256dh || !row.auth)),
      serverRowsForDevice: null,
      activeRowsForDevice: null,
      latestRowActive: row?.is_active ?? null,
      latestRowFingerprintStatus: row ? describeFingerprintStatus(row.vapid_key_fingerprint ?? null) : null,
    };

    if (deviceId) {
      const { data: deviceRows } = await admin
        .from("push_subscriptions")
        .select(selectFields)
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .order("updated_at", { ascending: false })
        .limit(20);
      diagnostics.serverRowsForDevice = deviceRows?.length ?? 0;
      diagnostics.activeRowsForDevice = deviceRows?.filter((item) => item.is_active).length ?? 0;
    }

    return { subscription: row, diagnostics };
  }

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
    activeColumn: "is_active",
    rawIsActive: active?.is_active ?? null,
    rawActive: null,
    status: null,
    selectedSubscriptionId: active?.id ? active.id.slice(0, 8) : null,
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
    
    return { subscription: row, diagnostics };
  }

  return { subscription: null, diagnostics };
}

function describePushFailure(status?: number, reason?: string, code?: string) {
  if (status === 404 || status === 410) {
    return "The saved push subscription has expired. Refresh notifications or enable alerts again on this device.";
  }
  if (status === 401 || status === 403) {
    if (code === "provider_rejected_subscription") {
      return "The browser push service rejected this subscription. Refresh notifications should create a new browser subscription. If it still fails, clear this site's notification permission/site data and enable alerts again.";
    }
    return "The saved push subscription keys for this device are stale. Refresh notifications needs to update the saved subscription keys.";
  }
  if (status === 400) {
    return "The browser push service rejected the subscription payload. Refresh notifications, then send another test.";
  }
  return reason || "The browser push service did not accept the test notification. Check OS/browser notification settings, Focus or Do Not Disturb, battery optimization, and installed PWA state.";
}

function describeFingerprintStatus(fingerprint: string | null, serverFingerprint?: string | null) {
  if (!fingerprint) return "missing";
  if (fingerprint === "invalid_key") return "invalid_key";
  if (serverFingerprint && fingerprint === serverFingerprint) return "match";
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
