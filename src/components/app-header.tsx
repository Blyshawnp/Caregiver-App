"use client";

import Link from "next/link";
import Image from "next/image";
import AppLogo from "./app-logo";
import NotificationBell from "./notification-bell";
import { StarOfLifeIcon } from "./icons";
import UserAvatar from "./user-avatar";
import type { Role } from "@/lib/db-types";
import { t, type Lang } from "@/lib/i18n";

export default function AppHeader({
  fullName,
  orgName,
  avatarUrl,
  avatarColor,
  userId,
  notificationCount = 0,
  role,
  lang = "en",
}: {
  fullName: string;
  orgName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  userId?: string;
  notificationCount?: number;
  role: Role;
  lang?: Lang;
}) {
  const firstName = fullName.split(" ")[0] || "there";
  const emergencyLabel = t("header.emergencyInfo", lang);
  const profileLabel = t("header.profile", lang);

  return (
    <header className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 sticky top-0 bg-cream-100/85 backdrop-blur-md z-20">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <AppLogo href="/home" variant="header" showText={false} />
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
            {t("header.welcome", lang)}, <i className="text-forest-600">{firstName}</i>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/emergency"
          aria-label={emergencyLabel}
          title={emergencyLabel}
          data-role={role}
          className="relative w-11 h-11 rounded-full bg-white grid place-items-center hover:bg-red-50 transition active:scale-95 shadow-soft border border-red-200 overflow-hidden"
        >
          <Image
            src="/icons/emergency.png"
            alt="Emergency"
            width={44}
            height={44}
            className="object-contain"
          />
        </Link>
        {userId && (
          <NotificationBell initialCount={notificationCount} userId={userId} />
        )}
        {userId && (
          <Link
            href="/me"
            aria-label={profileLabel}
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
