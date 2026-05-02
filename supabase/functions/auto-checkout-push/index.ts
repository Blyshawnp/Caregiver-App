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

Deno.serve(async () => {
  const startedAt = new Date().toISOString();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ??
    Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase service role configuration is missing." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: rpcError } = await supabase.rpc(
    "auto_checkout_after_8pm_geofence",
  );

  if (rpcError) {
    return json({ error: rpcError.message }, 500);
  }

  if (!publicKey || !privateKey || !subject) {
    return json({
      ok: true,
      pushed: 0,
      warning: "VAPID env vars are missing; notifications were inserted only.",
    });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: notifications, error: notificationError } = await supabase
    .from("notifications")
    .select("id, recipient_id, kind, title, body, link, related_shift_id")
    .eq("kind", "auto_check_out")
    .gte("created_at", startedAt)
    .returns<NotificationRow[]>();

  if (notificationError) {
    return json({ error: notificationError.message }, 500);
  }

  const rows = notifications ?? [];
  if (rows.length === 0) {
    return json({ ok: true, pushed: 0 });
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

  return json({ ok: true, pushed, disabled: disabledIds.length });
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
