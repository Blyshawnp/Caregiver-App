import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerVapidStatus } from "@/lib/vapid-server";

type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  device_id?: string;
  platform?: string;
  vapid_key_fingerprint?: string;
  vapid_public_key_fingerprint?: string;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const endpoint = searchParams.get("endpoint");
  const deviceId = searchParams.get("deviceId");
  const currentP256dh = searchParams.get("p256dh");
  const currentAuth = searchParams.get("auth");
  const admin = createAdminClient();

  const selectFields = "id, device_id, endpoint, p256dh, auth, is_active, last_seen_at, updated_at, platform, vapid_key_fingerprint";

  let exactEndpointRow = null;
  if (endpoint) {
    const { data } = await admin
      .from("push_subscriptions")
      .select(selectFields)
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
      .order("updated_at", { ascending: false })
      .limit(1);
    exactEndpointRow = data?.[0] ?? null;
  }

  let activeQuery = admin
    .from("push_subscriptions")
    .select(selectFields)
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (deviceId) activeQuery = activeQuery.eq("device_id", deviceId);
  else if (endpoint) activeQuery = activeQuery.eq("endpoint", endpoint);

  const { data: activeRows, error } = await activeQuery
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const activeRow = activeRows?.[0] ?? null;
  let anyDeviceRow = null;
  if (deviceId && !activeRow) {
    const { data } = await admin
      .from("push_subscriptions")
      .select(selectFields)
      .eq("user_id", user.id)
      .eq("device_id", deviceId)
      .order("updated_at", { ascending: false })
      .limit(1);
    anyDeviceRow = data?.[0] ?? null;
  }

  const activeEndpointRow = exactEndpointRow?.is_active ? exactEndpointRow : null;
  const row = activeEndpointRow ?? activeRow ?? exactEndpointRow ?? anyDeviceRow;
  const endpointMatch = endpoint && row ? row.endpoint === endpoint : endpoint ? false : null;
  const keysMatch =
    currentP256dh && currentAuth && row?.p256dh && row?.auth
      ? row.p256dh === currentP256dh && row.auth === currentAuth
      : currentP256dh || currentAuth
        ? false
        : null;
  const serverVapid = getServerVapidStatus();

  return NextResponse.json({
    enabled: Boolean(row?.is_active && (!endpoint || row.endpoint === endpoint)),
    active: Boolean(row?.is_active),
    serverSubscriptionExists: Boolean(row),
    deviceId: row?.device_id ?? deviceId ?? null,
    endpoint: row?.endpoint ?? null,
    endpointMatch,
    keysPresent: Boolean(row?.p256dh && row?.auth),
    keysMatch,
    lastSeenAt: row?.last_seen_at ?? null,
    updatedAt: row?.updated_at ?? null,
    platform: row?.platform ?? null,
    vapidKeyFingerprint: row?.vapid_key_fingerprint ?? null,
    fingerprintStatus: describeFingerprintStatus(row?.vapid_key_fingerprint ?? null, serverVapid.serverPublicKeyFingerprint),
    serverPublicKeyFingerprint: serverVapid.serverPublicKeyFingerprint,
    serverPrivateKeyConfigured: serverVapid.privateKeyPresent,
    vapidSubjectConfigured: serverVapid.subjectPresent,
    serverKeyPairValid: serverVapid.keyPairValid,
    serverVapidError: serverVapid.error,
  });
}

export async function POST(request: Request) {
  console.info("[push-subscriptions] save requested");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("[push-subscriptions] unauthorized save");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle<{ organization_id: string }>();

  if (!profile) {
    console.error("[push-subscriptions] profile not found", { userId: user.id });
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  const payload = (await request.json()) as PushSubscriptionPayload;
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth || !payload.device_id) {
    console.error("[push-subscriptions] invalid subscription payload", {
      userId: user.id,
      hasEndpoint: !!payload.endpoint,
      hasP256dh: !!payload.keys?.p256dh,
      hasAuth: !!payload.keys?.auth,
      hasDeviceId: !!payload.device_id,
    });
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") || "";
  const uaLower = userAgent.toLowerCase();
  let platform = "desktop";
  if (uaLower.includes("iphone") || uaLower.includes("ipad") || uaLower.includes("ipod")) {
    platform = "ios";
  } else if (uaLower.includes("android")) {
    platform = "android";
  }

  const admin = createAdminClient();
  const serverVapid = getServerVapidStatus();
  const requestedFingerprint =
    payload.vapid_public_key_fingerprint || payload.vapid_key_fingerprint || null;
  const savedFingerprint =
    requestedFingerprint && requestedFingerprint !== "invalid_key"
      ? requestedFingerprint
      : serverVapid.serverPublicKeyFingerprint || null;
  const now = new Date().toISOString();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      organization_id: profile.organization_id,
      user_id: user.id,
      endpoint: payload.endpoint,
      device_id: payload.device_id,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
      user_agent: userAgent,
      platform: payload.platform || platform,
      is_active: true,
      disabled_at: null,
      last_seen_at: now,
      updated_at: now,
      vapid_key_fingerprint: savedFingerprint,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push-subscriptions] save failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: deactivateError } = await admin
    .from("push_subscriptions")
    .update({
      is_active: false,
      disabled_at: now,
      updated_at: now,
    })
    .eq("user_id", user.id)
    .eq("device_id", payload.device_id)
    .neq("endpoint", payload.endpoint);

  if (deactivateError) {
    console.error("[push-subscriptions] old endpoint cleanup failed", {
      userId: user.id,
      code: deactivateError.code,
      message: deactivateError.message,
    });
  }

  const { error: reactivateError } = await admin
    .from("push_subscriptions")
    .update({
      device_id: payload.device_id,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
      user_agent: userAgent,
      platform: payload.platform || platform,
      is_active: true,
      disabled_at: null,
      last_seen_at: now,
      updated_at: now,
      vapid_key_fingerprint: savedFingerprint,
    })
    .eq("user_id", user.id)
    .eq("endpoint", payload.endpoint);

  if (reactivateError) {
    console.error("[push-subscriptions] current endpoint reactivation failed", {
      userId: user.id,
      code: reactivateError.code,
      message: reactivateError.message,
    });
    return NextResponse.json({ error: reactivateError.message }, { status: 500 });
  }

  console.info("[push-subscriptions] save succeeded", { userId: user.id });
  const { data: saved } = await admin
    .from("push_subscriptions")
    .select("id, device_id, endpoint, p256dh, auth, is_active, updated_at, vapid_key_fingerprint")
    .eq("user_id", user.id)
    .eq("endpoint", payload.endpoint)
    .maybeSingle();

  const endpointMatch = saved?.endpoint === payload.endpoint;
  const active = saved?.is_active === true;
  const fingerprintMatch = saved?.vapid_key_fingerprint === savedFingerprint;
  const keysMatch = saved?.p256dh === payload.keys.p256dh && saved?.auth === payload.keys.auth;

  if (!saved || !endpointMatch || !active || !fingerprintMatch || !keysMatch) {
    console.error("[push-subscriptions] save verification failed", {
      userId: user.id,
      saved: Boolean(saved),
      endpointMatch,
      active,
      fingerprintMatch,
      keysMatch,
    });
    return NextResponse.json(
      {
        error: !active
          ? "Push subscription was saved, but the current endpoint is still marked inactive."
          : !keysMatch
            ? "Push subscription was saved, but the current browser keys were not updated."
            : "Push subscription was saved, but the current endpoint could not be verified.",
        code: !active
          ? "saved_subscription_inactive"
          : !keysMatch
            ? "saved_subscription_keys_stale"
            : "subscription_save_verification_failed",
        endpointMatch,
        active,
        fingerprintMatch,
        keysMatch,
        deviceId: saved?.device_id ?? null,
        savedFingerprint: saved?.vapid_key_fingerprint ?? null,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    subscription: saved,
    endpointMatch,
    active,
    keysMatch,
    deviceId: saved.device_id ?? null,
    savedFingerprint: saved.vapid_key_fingerprint ?? null,
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    endpoint?: string;
    device_id?: string;
  } | null;

  const admin = createAdminClient();
  let query = admin
    .from("push_subscriptions")
    .update({
      is_active: false,
      disabled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (payload?.endpoint) {
    query = query.eq("endpoint", payload.endpoint);
  } else if (payload?.device_id) {
    query = query.eq("device_id", payload.device_id);
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function describeFingerprintStatus(saved: string | null, current: string) {
  if (!saved) return "missing";
  if (saved === "invalid_key") return "invalid_key";
  if (saved === current) return "match";
  return "mismatch";
}
