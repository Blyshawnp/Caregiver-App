import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NotificationBell from "./notification-bell";
import { StarOfLifeIcon } from "./icons";
import UserAvatar from "./user-avatar";

export default async function AppHeader({
  fullName,
  orgName,
  avatarUrl,
  avatarColor,
}: {
  fullName: string;
  orgName: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
}) {
  // Initial unread notification count, then realtime updates take over
  let unreadCount = 0;
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
      unreadCount = count ?? 0;
    }
  } catch {
    /* best effort */
  }

  return (
    <header className="sticky top-0 z-30 bg-cream-100/85 backdrop-blur-md border-b border-cream-200/60 pt-[env(safe-area-inset-top)]">
      <div className="max-w-2xl mx-auto px-5 py-3.5 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.2em] text-ink-500 leading-none mb-0.5">
            {orgName || "Caregiver"}
          </span>
          <span className="font-display text-lg leading-tight text-ink-900">
            Welcome, <span className="italic">{fullName.split(" ")[0]}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/emergency"
            aria-label="Emergency information"
            title="Emergency information"
            className="relative w-10 h-10 rounded-full bg-red-600 text-cream-50 grid place-items-center hover:bg-red-700 transition active:scale-95 shadow-soft"
          >
            <StarOfLifeIcon size={18} />
          </Link>
          {userId && (
            <NotificationBell initialCount={unreadCount} userId={userId} />
          )}
          <Link
            href="/me"
            aria-label="Profile"
            className="rounded-full hover:opacity-90 transition active:scale-95"
          >
            <UserAvatar
              person={{
                full_name: fullName,
                avatar_url: avatarUrl,
                avatar_color: avatarColor,
              }}
              size="sm"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
