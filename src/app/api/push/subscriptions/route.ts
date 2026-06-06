import { NextResponse } from "next/server";
import { createHash } from "crypto";
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

type PushSubscriptionDebugRow = {
  id: string;
  device_id: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  is_active: boolean | null;
  updated_at: string | null;
  last_seen_at: string | null;
  vapid_key_fingerprint: string | null;
};

const DEBUG_SELECT_FIELDS =
  "id, device_id, endpoint, p256dh, auth, is_active, updated_at, last_seen_at, vapid_key_fingerprint";

function shortHash(value?: string | null) {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function shortId(value?: string | null) {
  return value ? value.slice(0, 8) : null;
}

function formatSupabaseError(error?: { code?: string; message?: string; details?: string | null } | null) {
  if (!error) return null;
  return [error.code, error.message, error.details].filter(Boolean).join(" | ");
}

function getAppCommit() {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.npm_package_version ||
    "local"
  ).slice(0, 12);
}

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

  const row = endpoint ? exactEndpointRow ?? activeRow ?? anyDeviceRow : activeRow ?? anyDeviceRow;
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
    activeColumn: "is_active",
    rawIsActive: row?.is_active ?? null,
    rawActive: null,
    status: null,
    selectedSubscriptionId: row?.id ? String(row.id).slice(0, 8) : null,
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
  const currentValues = {
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
  };

  const { data: beforeRows, error: beforeReadError } = await admin
    .from("push_subscriptions")
    .select(DEBUG_SELECT_FIELDS)
    .eq("user_id", user.id)
    .eq("endpoint", payload.endpoint)
    .order("updated_at", { ascending: false })
    .limit(1);
  const beforeRow = (beforeRows?.[0] ?? null) as PushSubscriptionDebugRow | null;

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

  const { data: upserted, error: upsertError } = await admin
    .from("push_subscriptions")
    .upsert(currentValues, { onConflict: "endpoint" })
    .select(DEBUG_SELECT_FIELDS)
    .maybeSingle();

  if (upsertError) {
    console.error("[push-subscriptions] save failed", {
      userId: user.id,
      code: upsertError.code,
      message: upsertError.message,
    });
    return NextResponse.json(
      {
        error: upsertError.message,
        saveDiagnostics: buildSaveDiagnostics({
          payload,
          savedFingerprint,
          beforeRow,
          afterRow: null,
          updatedRow: null,
          updateByIdAttempted: false,
          supabaseUpdateError: upsertError,
          beforeReadError,
        }),
      },
      { status: 500 }
    );
  }

  const { data: reactivatedRows, error: reactivateError } = await admin
    .from("push_subscriptions")
    .update(currentValues)
    .eq("user_id", user.id)
    .eq("endpoint", payload.endpoint)
    .select(DEBUG_SELECT_FIELDS);
  const reactivatedRow = (reactivatedRows?.[0] ?? null) as PushSubscriptionDebugRow | null;

  if (reactivateError) {
    console.error("[push-subscriptions] current endpoint reactivation failed", {
      userId: user.id,
      code: reactivateError.code,
      message: reactivateError.message,
    });
    return NextResponse.json(
      {
        error: reactivateError.message,
        saveDiagnostics: buildSaveDiagnostics({
          payload,
          savedFingerprint,
          beforeRow,
          afterRow: null,
          updatedRow: reactivatedRow,
          updateByIdAttempted: false,
          supabaseUpdateError: reactivateError,
          beforeReadError,
        }),
      },
      { status: 500 }
    );
  }

  const rowToUpdateById = beforeRow ?? ((upserted ?? null) as PushSubscriptionDebugRow | null) ?? reactivatedRow;
  let updatedByIdRow: PushSubscriptionDebugRow | null = null;
  let updateByIdError: { code?: string; message?: string; details?: string | null } | null = null;
  const updateByIdAttempted = Boolean(rowToUpdateById?.id);
  if (rowToUpdateById?.id) {
    const { data, error: byIdError } = await admin
      .from("push_subscriptions")
      .update(currentValues)
      .eq("id", rowToUpdateById.id)
      .eq("user_id", user.id)
      .select(DEBUG_SELECT_FIELDS)
      .maybeSingle();
    updatedByIdRow = (data ?? null) as PushSubscriptionDebugRow | null;
    updateByIdError = byIdError;
  }

  console.info("[push-subscriptions] save succeeded", { userId: user.id });
  const { data: saved, error: afterReadError } = await admin
    .from("push_subscriptions")
    .select(DEBUG_SELECT_FIELDS)
    .eq("user_id", user.id)
    .eq("device_id", payload.device_id)
    .eq("endpoint", payload.endpoint)
    .maybeSingle();
  const savedRow = (saved ?? null) as PushSubscriptionDebugRow | null;

  const endpointMatch = savedRow?.endpoint === payload.endpoint;
  const active = savedRow?.is_active === true;
  const fingerprintMatch = savedRow?.vapid_key_fingerprint === savedFingerprint;
  const keysMatch = savedRow?.p256dh === payload.keys.p256dh && savedRow?.auth === payload.keys.auth;
  const saveDiagnostics = buildSaveDiagnostics({
    payload,
    savedFingerprint,
    beforeRow,
    afterRow: savedRow,
    updatedRow: updatedByIdRow ?? reactivatedRow ?? ((upserted ?? null) as PushSubscriptionDebugRow | null),
    updateByIdAttempted,
    supabaseUpdateError: updateByIdError ?? afterReadError,
    beforeReadError,
    afterReadError,
  });

  if (!savedRow || !endpointMatch || !active || !fingerprintMatch || !keysMatch) {
    console.error("[push-subscriptions] save verification failed", {
      userId: user.id,
      saved: Boolean(savedRow),
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
          ? "save_failed_inactive"
          : !keysMatch
            ? "saved_subscription_keys_stale"
            : "subscription_save_verification_failed",
        endpointMatch,
        active,
        activeColumn: "is_active",
        rawIsActive: savedRow?.is_active ?? null,
        fingerprintMatch,
        keysMatch,
        deviceId: savedRow?.device_id ?? null,
        savedFingerprint: savedRow?.vapid_key_fingerprint ?? null,
        updatedAt: savedRow?.updated_at ?? null,
        saveDiagnostics,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    subscription: savedRow,
    endpointMatch,
    active,
    activeColumn: "is_active",
    rawIsActive: savedRow.is_active,
    keysMatch,
    deviceId: savedRow.device_id ?? null,
    savedFingerprint: savedRow.vapid_key_fingerprint ?? null,
    updatedAt: savedRow.updated_at ?? null,
    saveDiagnostics,
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

function buildSaveDiagnostics({
  payload,
  savedFingerprint,
  beforeRow,
  afterRow,
  updatedRow,
  updateByIdAttempted,
  supabaseUpdateError,
  beforeReadError,
  afterReadError,
}: {
  payload: PushSubscriptionPayload;
  savedFingerprint: string | null;
  beforeRow: PushSubscriptionDebugRow | null;
  afterRow: PushSubscriptionDebugRow | null;
  updatedRow: PushSubscriptionDebugRow | null;
  updateByIdAttempted: boolean;
  supabaseUpdateError?: { code?: string; message?: string; details?: string | null } | null;
  beforeReadError?: { code?: string; message?: string; details?: string | null } | null;
  afterReadError?: { code?: string; message?: string; details?: string | null } | null;
}) {
  const endpointMatchesAfterSave = afterRow?.endpoint === payload.endpoint;
  const p256dhMatchesAfterSave = afterRow?.p256dh === payload.keys.p256dh;
  const authMatchesAfterSave = afterRow?.auth === payload.keys.auth;
  const fingerprintMatchesAfterSave = afterRow?.vapid_key_fingerprint === savedFingerprint;
  const policyWarning =
    !formatSupabaseError(supabaseUpdateError) && afterRow && afterRow.is_active !== true
      ? "Update returned without error, but the after-save row is still inactive. Check RLS, policies, triggers, or a later cleanup/update."
      : null;

  return {
    appCommit: getAppCommit(),
    deviceId: payload.device_id ?? null,
    browserEndpointHash: shortHash(payload.endpoint),
    browserP256dhHash: shortHash(payload.keys.p256dh),
    browserAuthHash: shortHash(payload.keys.auth),
    selectedDbRowBeforeSave: shortId(beforeRow?.id),
    dbRowIsActiveBeforeSave: beforeRow?.is_active ?? null,
    dbRowEndpointHashBeforeSave: shortHash(beforeRow?.endpoint),
    dbRowP256dhHashBeforeSave: shortHash(beforeRow?.p256dh),
    dbRowAuthHashBeforeSave: shortHash(beforeRow?.auth),
    updateByIdAttempted,
    supabaseUpdateError: formatSupabaseError(supabaseUpdateError),
    beforeReadError: formatSupabaseError(beforeReadError),
    afterReadError: formatSupabaseError(afterReadError),
    updatedRowIdReturnedBySupabase: shortId(updatedRow?.id),
    dbRowIsActiveAfterSave: afterRow?.is_active ?? null,
    dbRowEndpointHashAfterSave: shortHash(afterRow?.endpoint),
    dbRowP256dhHashAfterSave: shortHash(afterRow?.p256dh),
    dbRowAuthHashAfterSave: shortHash(afterRow?.auth),
    endpointMatchesAfterSave,
    p256dhMatchesAfterSave,
    authMatchesAfterSave,
    fingerprintMatchesAfterSave,
    afterSaveRowId: shortId(afterRow?.id),
    updatedRowEqualsAfterRow:
      updatedRow?.id && afterRow?.id ? updatedRow.id === afterRow.id : null,
    policyWarning,
  };
}
