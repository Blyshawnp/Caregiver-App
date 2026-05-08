import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type NotificationRow = {
  id: string;
  recipient_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  related_shift_id: string | null;
};

type ReminderShiftRow = {
  id: string;
  organization_id: string;
  caregiver_id: string | null;
  client_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  assignment_status: string | null;
  is_released: boolean | null;
  clients: {
    full_name: string | null;
    latitude: number | null;
    longitude: number | null;
    geofence_radius_meters: number | null;
  } | null;
  check_ins:
    | Array<{
      id: string;
      check_in_time: string | null;
      check_out_time: string | null;
    }>
    | {
      id: string;
      check_in_time: string | null;
      check_out_time: string | null;
    }
    | null;
  shift_events:
    | Array<{
      id: string;
      event_type: string;
    }>
    | {
      id: string;
      event_type: string;
    }
    | null;
};

type LocationPingRow = {
  caregiver_id: string;
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
};

type ReminderCandidate = {
  shift: ReminderShiftRow;
  clientName: string;
  locationKind: "inside_geofence" | "unknown";
  distanceMeters: number | null;
  locationRecordedAt: string | null;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PreferenceRow = {
  user_id: string;
  messages: boolean;
  shift_assignments: boolean;
  trades: boolean;
  incidents: boolean;
  general: boolean;
};

const DEFAULT_PREFS = {
  messages: true,
  shift_assignments: true,
  trades: true,
  incidents: true,
  general: true,
};

const CHECK_IN_REMINDER_KIND = "check_in_reminder";
const CHECKOUT_REMINDER_KIND = "checkout_reminder";
const CHECK_IN_REMINDER_EVENT_TYPE = "check_in_reminder_sent";
const CHECK_IN_REMINDER_WINDOW_MINUTES = 30;
const LOCATION_STALE_MINUTES = 30;

Deno.serve(async (req) => {
  const startedAt = new Date().toISOString();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ??
    Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  const edgeSecret = Deno.env.get("AUTO_CHECKOUT_EDGE_SECRET");

  if (!edgeSecret) {
    return json({ error: "AUTO_CHECKOUT_EDGE_SECRET is not configured." }, 500);
  }

  const requestSecret = req.headers.get("x-auto-checkout-secret");
  if (requestSecret !== edgeSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase service role configuration is missing." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: rpcError } = await supabase.rpc(
    "process_shift_end_geofence_checkout",
  );

  if (rpcError) {
    return json({ error: rpcError.message }, 500);
  }

  const reminderResult = await sendCheckInReminders(supabase, new Date(startedAt));
  if (reminderResult.error) {
    return json({ error: reminderResult.error }, 500);
  }

  if (!publicKey || !privateKey || !subject) {
    return json({
      ok: true,
      pushed: 0,
      checkInReminders: reminderResult.sent,
      warning: "VAPID env vars are missing; notifications were inserted only.",
    });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: notifications, error: notificationError } = await supabase
    .from("notifications")
    .select("id, recipient_id, kind, title, body, link, related_shift_id")
    .in("kind", ["auto_check_out", CHECK_IN_REMINDER_KIND, CHECKOUT_REMINDER_KIND])
    .gte("created_at", startedAt)
    .returns<NotificationRow[]>();

  if (notificationError) {
    return json({ error: notificationError.message }, 500);
  }

  const rows = notifications ?? [];
  if (rows.length === 0) {
    return json({ ok: true, pushed: 0, checkInReminders: reminderResult.sent });
  }

  const recipientIds = Array.from(new Set(rows.map((row) => row.recipient_id)));
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("is_active", true)
    .in("user_id", recipientIds)
    .returns<PushSubscriptionRow[]>();

  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("user_id, messages, shift_assignments, trades, incidents, general")
    .in("user_id", recipientIds)
    .returns<PreferenceRow[]>();

  const prefsByUser = new Map(
    (preferences ?? []).map((pref) => [pref.user_id, pref]),
  );
  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();

  for (const subscription of subscriptions ?? []) {
    const list = subscriptionsByUser.get(subscription.user_id) ?? [];
    list.push(subscription);
    subscriptionsByUser.set(subscription.user_id, list);
  }

  const disabledIds: string[] = [];
  let pushed = 0;

  await Promise.all(rows.flatMap((notification) => {
    const prefs = prefsByUser.get(notification.recipient_id) ?? DEFAULT_PREFS;
    if (!prefs.shift_assignments) return [];

    return (subscriptionsByUser.get(notification.recipient_id) ?? []).map(
      async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify({
              title: notification.title,
              body: notification.body ?? "",
              url: notification.link ?? "/notifications",
              tag: notification.kind,
              sound: "normal",
              relatedShiftId: notification.related_shift_id,
            }),
          );
          pushed += 1;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            disabledIds.push(subscription.id);
          }
        }
      },
    );
  }));

  if (disabledIds.length > 0) {
    await supabase
      .from("push_subscriptions")
      .update({
        is_active: false,
        disabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", disabledIds);
  }

  return json({
    ok: true,
    pushed,
    disabled: disabledIds.length,
    checkInReminders: reminderResult.sent,
  });
});

async function sendCheckInReminders(
  supabase: ReturnType<typeof createClient>,
  now: Date,
) {
  const windowStart = new Date(
    now.getTime() - CHECK_IN_REMINDER_WINDOW_MINUTES * 60_000,
  );

  const { data: shifts, error: shiftError } = await supabase
    .from("shifts")
    .select(`
      id,
      organization_id,
      caregiver_id,
      client_id,
      scheduled_start,
      scheduled_end,
      assignment_status,
      is_released,
      clients ( full_name, latitude, longitude, geofence_radius_meters ),
      check_ins ( id, check_in_time, check_out_time ),
      shift_events ( id, event_type )
    `)
    .not("caregiver_id", "is", null)
    .lte("scheduled_start", now.toISOString())
    .gte("scheduled_start", windowStart.toISOString())
    .gt("scheduled_end", now.toISOString())
    .returns<ReminderShiftRow[]>();

  if (shiftError) return { sent: 0, error: shiftError.message };

  const eligible = (shifts ?? []).filter((shift) => {
    if (!shift.caregiver_id) return false;
    if (shift.is_released) return false;
    if (shift.assignment_status === "pending" || shift.assignment_status === "declined") {
      return false;
    }

    const hasCheckedIn = normalizeRows(shift.check_ins).some((row) =>
      row.check_in_time !== null
    );
    if (hasCheckedIn) return false;

    return !normalizeRows(shift.shift_events).some((event) =>
      event.event_type === CHECK_IN_REMINDER_EVENT_TYPE
    );
  });

  if (eligible.length === 0) return { sent: 0, error: null };

  const caregiverIds = Array.from(
    new Set(eligible.map((shift) => shift.caregiver_id).filter(Boolean)),
  ) as string[];
  const freshAfter = new Date(
    now.getTime() - LOCATION_STALE_MINUTES * 60_000,
  ).toISOString();

  const { data: pings, error: pingError } = await supabase
    .from("shift_location_pings")
    .select("caregiver_id, recorded_at, latitude, longitude, accuracy_meters")
    .in("caregiver_id", caregiverIds)
    .gte("recorded_at", freshAfter)
    .order("recorded_at", { ascending: false })
    .returns<LocationPingRow[]>();

  if (pingError && pingError.code !== "42P01") {
    return { sent: 0, error: pingError.message };
  }

  const latestPingByCaregiver = new Map<string, LocationPingRow>();
  for (const ping of pings ?? []) {
    if (!latestPingByCaregiver.has(ping.caregiver_id)) {
      latestPingByCaregiver.set(ping.caregiver_id, ping);
    }
  }

  const candidates: ReminderCandidate[] = eligible.map((shift) => {
    const clientName = shift.clients?.full_name ?? "your client";
    const clientLat = shift.clients?.latitude;
    const clientLng = shift.clients?.longitude;
    const radiusMeters = shift.clients?.geofence_radius_meters ?? 150;
    const ping = shift.caregiver_id
      ? latestPingByCaregiver.get(shift.caregiver_id)
      : undefined;

    if (
      ping &&
      typeof clientLat === "number" &&
      typeof clientLng === "number"
    ) {
      const distanceMeters = distanceBetweenMeters(
        ping.latitude,
        ping.longitude,
        clientLat,
        clientLng,
      );

      if (distanceMeters <= radiusMeters) {
        return {
          shift,
          clientName,
          locationKind: "inside_geofence",
          distanceMeters,
          locationRecordedAt: ping.recorded_at,
        };
      }
    }

    return {
      shift,
      clientName,
      locationKind: "unknown",
      distanceMeters: null,
      locationRecordedAt: ping?.recorded_at ?? null,
    };
  });

  const recordedCandidates: ReminderCandidate[] = [];
  for (const candidate of candidates) {
    const { error: eventError } = await supabase
      .from("shift_events")
      .insert({
        organization_id: candidate.shift.organization_id,
        shift_id: candidate.shift.id,
        caregiver_id: candidate.shift.caregiver_id,
        client_id: candidate.shift.client_id,
        event_type: CHECK_IN_REMINDER_EVENT_TYPE,
        event_time: now.toISOString(),
        metadata: {
          reminder_kind: candidate.locationKind,
          location_recorded_at: candidate.locationRecordedAt,
          distance_meters: candidate.distanceMeters,
          schedule: "auto-checkout-push",
        },
      });

    if (eventError) {
      if (eventError.code === "23505") continue;
      return { sent: recordedCandidates.length, error: eventError.message };
    }

    recordedCandidates.push(candidate);
  }

  if (recordedCandidates.length === 0) return { sent: 0, error: null };

  const notifications = recordedCandidates.map((candidate) => ({
    organization_id: candidate.shift.organization_id,
    recipient_id: candidate.shift.caregiver_id,
    kind: CHECK_IN_REMINDER_KIND,
    title: candidate.locationKind === "inside_geofence"
      ? "Time to check in"
      : "Shift starting",
    body: candidate.locationKind === "inside_geofence"
      ? `You're at ${candidate.clientName} for your shift. Please check in now.`
      : `Your shift with ${candidate.clientName} is starting. Please check in when you arrive.`,
    link: `/schedule/${candidate.shift.id}/check-in`,
    related_shift_id: candidate.shift.id,
  }));

  const { error: notificationError } = await supabase
    .from("notifications")
    .insert(notifications);

  if (notificationError) {
    return { sent: 0, error: notificationError.message };
  }

  return { sent: notifications.length, error: null };
}

function normalizeRows<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function distanceBetweenMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.asin(Math.sqrt(a));
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
