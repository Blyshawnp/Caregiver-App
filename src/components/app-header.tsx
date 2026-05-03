"use client";

import UserAvatar from "./user-avatar";
import NotificationBell from "./notification-bell";

export default function AppHeader({
  fullName,
  orgName,
  avatarUrl,
  avatarColor,
  userId,
  notificationCount = 0
}: {
  fullName: string;
  orgName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  userId?: string;
  notificationCount?: number;
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
        <NotificationBell initialCount={notificationCount} userId={userId || ""} />
        {userId && (
          <UserAvatar
            person={{
              full_name: fullName,
              avatar_url: avatarUrl,
              avatar_color: avatarColor,
              id: userId
            }}
            size="sm"
          />
        )}
      </div>
    </header>
  );
}
