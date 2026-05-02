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

  type NotificationRow = {
    id: string;
    kind: string;
    title: string;
    body: string | null;
    link: string | null;
    is_read: boolean;
    created_at: string;
    related_shift_id: string | null;
  };

  type ShiftAvatarRow = {
    id: string;
    profiles: {
      full_name: string | null;
      avatar_url: string | null;
      avatar_color: string | null;
    } | null;
  };

  const notificationRows = (notifications ?? []) as NotificationRow[];
  const relatedShiftIds = Array.from(
    new Set(notificationRows.flatMap((n) => (n.related_shift_id ? [n.related_shift_id] : [])))
  );
  let shiftAvatars = new Map<string, ShiftAvatarRow["profiles"]>();

  if (relatedShiftIds.length > 0) {
    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, profiles:caregiver_id ( full_name, avatar_url, avatar_color )")
      .in("id", relatedShiftIds);

    shiftAvatars = new Map(
      ((shifts ?? []) as unknown as ShiftAvatarRow[]).map((shift) => [
        shift.id,
        shift.profiles,
      ])
    );
  }

  const notificationsWithAvatars = notificationRows.map((n) => ({
    ...n,
    shifts: n.related_shift_id
      ? { profiles: shiftAvatars.get(n.related_shift_id) ?? null }
      : null,
  }));

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Notifications</h1>
        <p className="text-ink-500 text-sm">
          {notifications?.length ?? 0} recent
        </p>
      </header>

      <NotificationsList
        notifications={notificationsWithAvatars}
        currentUserId={user.id}
      />
    </main>
  );
}
