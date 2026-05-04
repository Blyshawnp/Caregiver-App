"use client";

import Link from "next/link";
import NotificationBell from "./notification-bell";
import { StarOfLifeIcon } from "./icons";
import UserAvatar from "./user-avatar";
import type { Role } from "@/lib/db-types";

export default function AppHeader({
  fullName,
  orgName,
  avatarUrl,
  avatarColor,
  userId,
  notificationCount = 0,
  role,
}: {
  fullName: string;
  orgName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  userId?: string;
  notificationCount?: number;
  role: Role;
}) {
  return (
    <header className="px-5 pt-6 pb-2 flex items-center justify-between sticky top-0 bg-cream-100/80 backdrop-blur-md z-20">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-400 font-bold leading-none mb-1">
          {orgName || "Caregiver"}
        </p>
        <h1 className="font-display text-2xl text-ink-900 leading-none">
          Welcome, <i className="text-forest-600">{fullName.split(" ")[0]}</i>
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/emergency"
          aria-label="Emergency options"
          title="Emergency options"
          data-role={role}
          className="relative w-11 h-11 rounded-full bg-red-600 text-cream-50 grid place-items-center hover:bg-red-700 transition active:scale-95 shadow-soft ring-2 ring-red-600/20"
        >
          <StarOfLifeIcon size={20} />
        </Link>
        {userId && (
          <NotificationBell initialCount={notificationCount} userId={userId} />
        )}
        {userId && (
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
        )}
      </div>
    </header>
  );
}
