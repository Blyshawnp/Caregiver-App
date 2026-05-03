import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PreferencesPayload = {
  messages?: boolean;
  shift_assignments?: boolean;
  trades?: boolean;
  incidents?: boolean;
  general?: boolean;
  sounds_enabled?: boolean;
  message_sound_enabled?: boolean;
  urgent_incident_sound_enabled?: boolean;
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
};

export async function GET() {
  const context = await getContext();
  if ("response" in context) return context.response;

  const { supabase, userId, organizationId } = context;
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "messages, shift_assignments, trades, incidents, general, sounds_enabled, message_sound_enabled, urgent_incident_sound_enabled"
    )
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
      .select(
        "messages, shift_assignments, trades, incidents, general, sounds_enabled, message_sound_enabled, urgent_incident_sound_enabled"
      )
      .single<typeof DEFAULT_PREFERENCES>();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(inserted);
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const context = await getContext();
  if ("response" in context) return context.response;

  const { supabase, userId, organizationId } = context;
  const payload = (await request.json()) as PreferencesPayload;
  const update = pickBooleanFields(payload);

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
    .select(
      "messages, shift_assignments, trades, incidents, general, sounds_enabled, message_sound_enabled, urgent_incident_sound_enabled"
    )
    .single<typeof DEFAULT_PREFERENCES>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
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

function pickBooleanFields(payload: PreferencesPayload) {
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
  return update;
}
