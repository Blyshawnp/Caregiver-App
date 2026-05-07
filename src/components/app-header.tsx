"use client";

import Image from "next/image";
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
  const firstName = fullName.split(" ")[0] || "there";

  return (
    <header className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 sticky top-0 bg-cream-100/85 backdrop-blur-md z-20">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0 w-12 h-12 rounded-[1.1rem] bg-white shadow-soft ring-1 ring-forest-600/10 grid place-items-center overflow-hidden">
          <Image
            src="/icon-192.png"
            alt=""
            width={40}
            height={40}
            priority
            className="rounded-xl"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-forest-600 font-extrabold leading-none truncate">
              Carer Vista Pro
            </p>
            {orgName && (
              <span className="hidden min-[390px]:inline-block w-1 h-1 rounded-full bg-ink-300 shrink-0" />
            )}
            {orgName && (
              <p className="hidden min-[390px]:block text-[10px] uppercase tracking-[0.16em] text-ink-400 font-bold leading-none truncate">
                {orgName}
              </p>
            )}
          </div>
          <h1 className="mt-1 font-display text-2xl text-ink-900 leading-none truncate">
            Welcome, <i className="text-forest-600">{firstName}</i>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/emergency"
          aria-label="Emergency options"
          title="Emergency options"
          data-role={role}
          className="relative w-11 h-11 rounded-full bg-white text-red-600 grid place-items-center hover:bg-red-50 transition active:scale-95 shadow-soft ring-2 ring-red-600/35 border border-red-200"
        >
          <StarOfLifeIcon size={28} />
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
