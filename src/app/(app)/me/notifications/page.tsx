import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationSettings from "./notification-settings";

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select(
      "messages, shift_assignments, trades, incidents, general, sounds_enabled, message_sound_enabled, urgent_incident_sound_enabled"
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
        }
      }
    />
  );
}
