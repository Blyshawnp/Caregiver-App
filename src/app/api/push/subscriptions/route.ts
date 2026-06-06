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
  const admin = createAdminClient();

  let activeQuery = admin
    .from("push_subscriptions")
    .select("id, device_id, endpoint, p256dh, auth, is_active, last_seen_at, updated_at, platform, vapid_key_fingerprint")
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
      .select("id, device_id, endpoint, p256dh, auth, is_active, last_seen_at, updated_at, platform, vapid_key_fingerprint")
      .eq("user_id", user.id)
      .eq("device_id", deviceId)
      .order("updated_at", { ascending: false })
      .limit(1);
    anyDeviceRow = data?.[0] ?? null;
  }

  let endpointRow = null;
  if (!activeRow && endpoint) {
    const { data } = await admin
      .from("push_subscriptions")
      .select("id, device_id, endpoint, p256dh, auth, is_active, last_seen_at, updated_at, platform, vapid_key_fingerprint")
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
      .order("updated_at", { ascending: false })
      .limit(1);
    endpointRow = data?.[0] ?? null;
  }

  const row = activeRow ?? anyDeviceRow ?? endpointRow;
  const endpointMatch = endpoint && activeRow ? activeRow.endpoint === endpoint : endpoint ? false : null;
  const serverVapid = getServerVapidStatus();

  return NextResponse.json({
    enabled: Boolean(activeRow && (!endpoint || activeRow.endpoint === endpoint)),
    active: Boolean(activeRow),
    serverSubscriptionExists: Boolean(row),
    deviceId: row?.device_id ?? deviceId ?? null,
    endpoint: row?.endpoint ?? null,
    endpointMatch,
    keysPresent: Boolean(row?.p256dh && row?.auth),
    lastSeenAt: row?.last_seen_at ?? null,
    updatedAt: row?.updated_at ?? null,
    platform: row?.platform ?? null,
    vapidKeyFingerprint: row?.vapid_key_fingerprint ?? null,
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
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    console.error("[push-subscriptions] invalid subscription payload", {
      userId: user.id,
      hasEndpoint: !!payload.endpoint,
      hasP256dh: !!payload.keys?.p256dh,
      hasAuth: !!payload.keys?.auth,
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
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      organization_id: profile.organization_id,
      user_id: user.id,
      endpoint: payload.endpoint,
      device_id: payload.device_id || null,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
      user_agent: userAgent,
      platform: payload.platform || platform,
      is_active: true,
      disabled_at: null,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      vapid_key_fingerprint: payload.vapid_key_fingerprint || null,
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

  if (payload.device_id) {
    await admin
      .from("push_subscriptions")
      .update({
        is_active: false,
        disabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("device_id", payload.device_id)
      .neq("endpoint", payload.endpoint);
  }

  console.info("[push-subscriptions] save succeeded", { userId: user.id });
  const { data: saved } = await admin
    .from("push_subscriptions")
    .select("id, device_id, endpoint, is_active, updated_at")
    .eq("user_id", user.id)
    .eq("endpoint", payload.endpoint)
    .maybeSingle();

  return NextResponse.json({ ok: true, subscription: saved });
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
