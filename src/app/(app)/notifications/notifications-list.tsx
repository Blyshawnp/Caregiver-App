"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BellIcon, ArrowRightIcon, XIcon } from "@/components/icons";
import UserAvatar, { type AvatarProfile } from "@/components/user-avatar";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  related_shift_id: string | null;
  shifts?: {
    profiles: AvatarProfile | null;
  } | null;
};

export default function NotificationsList({
  notifications,
  currentUserId,
}: {
  notifications: Notification[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", n.id)
        .eq("recipient_id", currentUserId);
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      window.dispatchEvent(new CustomEvent("notifications:changed"));
    }
    if (n.link) {
      router.push(n.link);
    } else {
      router.refresh();
    }
  }

  async function deleteNotification(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("recipient_id", currentUserId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setItems((prev) => prev.filter((n) => n.id !== id));
    window.dispatchEvent(new CustomEvent("notifications:changed"));
    router.refresh();
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError(null);
    const response = await fetch("/api/notifications/mark-all-read", {
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setError(result?.error ?? "Could not mark notifications read.");
      setMarkingAll(false);
      return;
    }

    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    window.dispatchEvent(new CustomEvent("notifications:changed"));
    setMarkingAll(false);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-10 shadow-soft text-center grain-overlay">
        <div className="relative">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-cream-200 grid place-items-center text-ink-500">
            <BellIcon size={22} />
          </div>
          <p className="font-display text-lg mb-1">All caught up</p>
          <p className="text-sm text-ink-500">
            No notifications right now.
          </p>
        </div>
      </div>
    );
  }

  const hasUnread = items.some((n) => !n.is_read);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        {hasUnread ? (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="text-sm text-forest-600 font-medium hover:underline disabled:opacity-60"
          >
            {markingAll ? "Marking read..." : "Mark all read"}
          </button>
        ) : (
          <span className="text-sm text-ink-500">All notifications are read.</span>
        )}
      </div>
      {error && (
        <p className="text-sm text-terracotta-600 mb-3">{error}</p>
      )}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="relative group">
            <button
              onClick={() => handleClick(n)}
              className={`w-full text-left flex items-start gap-3 rounded-2xl p-4 transition active:scale-[0.99] ${
                n.is_read
                  ? "bg-white hover:bg-cream-50 shadow-soft"
                  : "bg-terracotta-400/10 hover:bg-terracotta-400/15 border border-terracotta-400/20"
              }`}
            >
              {n.shifts?.profiles ? (
                <UserAvatar person={n.shifts.profiles} size="sm" />
              ) : (
                <span
                  className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                    n.is_read
                      ? "bg-cream-200 text-ink-500"
                      : "bg-terracotta-500 text-cream-50"
                  }`}
                >
                  <BellIcon size={16} />
                </span>
              )}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <p className="font-medium text-ink-900 truncate">
                    {n.title}
                  </p>
                  <span className="text-[10px] text-ink-500 shrink-0">
                    {timeAgo(new Date(n.created_at))}
                  </span>
                </div>
                {n.body && (
                  <p className="text-sm text-ink-500 line-clamp-2">{n.body}</p>
                )}
              </div>
              {n.link && (
                <ArrowRightIcon
                  size={14}
                  className="text-ink-300 mt-1 shrink-0"
                />
              )}
            </button>
            <button
              onClick={(e) => deleteNotification(e, n.id)}
              className="absolute right-3 top-3 w-8 h-8 rounded-full bg-cream-100 text-ink-300 grid place-items-center opacity-0 group-hover:opacity-100 hover:bg-terracotta-50 hover:text-terracotta-600 transition"
              aria-label="Clear notification"
            >
              <XIcon size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function timeAgo(d: Date) {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
