import Link from "next/link";
import { BellIcon } from "./icons";
import { createClient } from "@/lib/supabase/server";

export default async function AppHeader({
  fullName,
  orgName,
}: {
  fullName: string;
  orgName: string;
}) {
  const initial = fullName.trim()[0]?.toUpperCase() ?? "?";

  // Unread notification count
  let unreadCount = 0;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
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
            href="/notifications"
            aria-label="Notifications"
            className="relative w-10 h-10 rounded-full grid place-items-center text-ink-700 hover:bg-cream-200 transition active:scale-95"
          >
            <BellIcon size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-terracotta-500 text-cream-50 text-[10px] font-medium flex items-center justify-center px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/me"
            aria-label="Profile"
            className="w-10 h-10 rounded-full bg-forest-600 text-cream-50 grid place-items-center font-display text-base hover:bg-forest-700 transition active:scale-95"
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}
