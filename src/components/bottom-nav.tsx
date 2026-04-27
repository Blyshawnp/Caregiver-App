"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  CalendarIcon,
  CheckSquareIcon,
  MessageIcon,
  UserIcon,
} from "./icons";

type Role = "admin" | "client" | "caregiver";

const tabs = [
  { href: "/home", label: "Home", Icon: HomeIcon, key: "home" },
  { href: "/schedule", label: "Schedule", Icon: CalendarIcon, key: "schedule" },
  { href: "/tasks", label: "Tasks", Icon: CheckSquareIcon, key: "tasks" },
  { href: "/messages", label: "Messages", Icon: MessageIcon, key: "messages" },
  { href: "/me", label: "Me", Icon: UserIcon, key: "me" },
];

export default function BottomNav({
  role: _role,
  unreadMessages = 0,
}: {
  role: Role;
  unreadMessages?: number;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-2xl px-3 pb-3">
        <div className="bg-white/95 backdrop-blur-md border border-cream-200/80 shadow-lifted rounded-3xl px-1.5 py-1.5 grid grid-cols-5 gap-1">
          {tabs.map(({ href, label, Icon, key }) => {
            const active =
              pathname === href || pathname?.startsWith(href + "/");
            const showBadge = key === "messages" && unreadMessages > 0;

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-2xl transition relative ${
                  active
                    ? "bg-forest-600 text-cream-50"
                    : "text-ink-500 hover:text-ink-900 hover:bg-cream-100"
                }`}
              >
                <span className="relative">
                  <Icon size={20} />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-terracotta-500 text-cream-50 text-[9px] font-bold flex items-center justify-center">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10px] tracking-wide ${
                    active ? "font-medium" : ""
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
