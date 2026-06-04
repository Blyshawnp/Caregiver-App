import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationSettings from "./notification-settings";
import { DEFAULT_CATEGORY_PREFERENCES } from "@/lib/notification-preferences";

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select(
      "messages, shift_assignments, trades, incidents, general, sounds_enabled, message_sound_enabled, urgent_incident_sound_enabled, category_preferences, privacy_safe_bodies, quiet_hours_start, quiet_hours_end, urgent_override_quiet_hours"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <NotificationSettings
      initialPreferences={
        preferences ?? {
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
          quiet_hours_start: null,
          quiet_hours_end: null,
          urgent_override_quiet_hours: true,
        }
      }
    />
  );
}
