import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_CATEGORY_PREFERENCES,
  normalizeCategoryPreferences,
  type NotificationCategoryPreferenceMap,
} from "@/lib/notification-preferences";

type PreferencesPayload = {
  messages?: boolean;
  shift_assignments?: boolean;
  trades?: boolean;
  incidents?: boolean;
  general?: boolean;
  sounds_enabled?: boolean;
  message_sound_enabled?: boolean;
  urgent_incident_sound_enabled?: boolean;
  category_preferences?: NotificationCategoryPreferenceMap;
  privacy_safe_bodies?: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  urgent_override_quiet_hours?: boolean;
};

const DEFAULT_PREFERENCES = {
  messages: true,
  shift_assignments: true,
  trades: true,
  incidents: true,
  general: true,
  sounds_enabled: true,
  message_sound_enabled: true,
  urgent_incident_sound_enabled: true,
  category_preferences: DEFAULT_CATEGORY_PREFERENCES,
  privacy_safe_bodies: true,
  quiet_hours_start: null as string | null,
  quiet_hours_end: null as string | null,
  urgent_override_quiet_hours: true,
};

const PREFERENCE_SELECT =
  "messages, shift_assignments, trades, incidents, general, sounds_enabled, message_sound_enabled, urgent_incident_sound_enabled, category_preferences, privacy_safe_bodies, quiet_hours_start, quiet_hours_end, urgent_override_quiet_hours";

export async function GET() {
  const context = await getContext();
  if ("response" in context) return context.response;

  const { supabase, userId, organizationId } = context;
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(PREFERENCE_SELECT)
    .eq("user_id", userId)
    .maybeSingle<typeof DEFAULT_PREFERENCES>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    const { data: inserted, error: insertError } = await supabase
      .from("notification_preferences")
      .insert({
        user_id: userId,
        organization_id: organizationId,
        ...DEFAULT_PREFERENCES,
      })
      .select(PREFERENCE_SELECT)
      .single<typeof DEFAULT_PREFERENCES>();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(inserted);
  }

  return NextResponse.json(normalizePreferences(data));
}

export async function PATCH(request: Request) {
  const context = await getContext();
  if ("response" in context) return context.response;

  const { supabase, userId, organizationId } = context;
  const payload = (await request.json()) as PreferencesPayload;
  const update = pickPreferenceFields(payload);

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        ...DEFAULT_PREFERENCES,
        ...update,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select(PREFERENCE_SELECT)
    .single<typeof DEFAULT_PREFERENCES>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(normalizePreferences(data));
}

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle<{ organization_id: string }>();

  if (!profile) {
    return { response: NextResponse.json({ error: "Profile not found" }, { status: 403 }) };
  }

  return {
    supabase,
    userId: user.id,
    organizationId: profile.organization_id,
  };
}

function pickPreferenceFields(payload: PreferencesPayload) {
  const update: PreferencesPayload = {};
  const fields = [
    "messages",
    "shift_assignments",
    "trades",
    "incidents",
    "general",
    "sounds_enabled",
    "message_sound_enabled",
    "urgent_incident_sound_enabled",
  ] as const;
  for (const key of fields) {
    if (typeof payload[key] === "boolean") {
      update[key] = payload[key];
    }
  }
  if (payload.category_preferences) {
    update.category_preferences = normalizeCategoryPreferences(payload.category_preferences);
  }
  if (typeof payload.privacy_safe_bodies === "boolean") {
    update.privacy_safe_bodies = payload.privacy_safe_bodies;
  }
  if (typeof payload.urgent_override_quiet_hours === "boolean") {
    update.urgent_override_quiet_hours = payload.urgent_override_quiet_hours;
  }
  if (typeof payload.quiet_hours_start === "string" || payload.quiet_hours_start === null) {
    update.quiet_hours_start = normalizeTime(payload.quiet_hours_start);
  }
  if (typeof payload.quiet_hours_end === "string" || payload.quiet_hours_end === null) {
    update.quiet_hours_end = normalizeTime(payload.quiet_hours_end);
  }
  return update;
}

function normalizePreferences(value: typeof DEFAULT_PREFERENCES) {
  return {
    ...DEFAULT_PREFERENCES,
    ...value,
    category_preferences: normalizeCategoryPreferences(value.category_preferences),
  };
}

function normalizeTime(value: string | null | undefined) {
  if (!value) return null;
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value) ? value : null;
}
