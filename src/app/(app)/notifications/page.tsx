import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationsList from "./notifications-list";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, is_read, created_at, related_shift_id")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Notifications</h1>
        <p className="text-ink-500 text-sm">
          {notifications?.length ?? 0} recent
        </p>
      </header>

      <NotificationsList
        notifications={notifications ?? []}
        currentUserId={user.id}
      />
    </main>
  );
}
