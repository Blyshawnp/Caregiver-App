"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  CalendarIcon,
  BellIcon,
  GridIcon,
  ListIcon,
  MessageIcon,
  StarOfLifeIcon,
  UserIcon,
} from "./icons";
import { t, type Lang } from "@/lib/i18n";
import type { Role } from "@/lib/db-types";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof HomeIcon;
  key: string;
};

export default function BottomNav({
  role,
  unreadMessages = 0,
  lang = "en",
}: {
  role: Role;
  unreadMessages?: number;
  lang?: Lang;
}) {
  const pathname = usePathname();

  const tabs = getTabs(role, lang);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-2xl px-3 pb-3">
        <div
          className="bg-white/95 backdrop-blur-md border border-cream-200/80 shadow-lifted rounded-3xl px-1.5 py-1.5 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
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

function getTabs(role: Role, lang: Lang): NavItem[] {
  const commonCareTabs: NavItem[] = [
    {
      href: "/home",
      label: t("nav.home", lang),
      Icon: HomeIcon,
      key: "home",
    },
    {
      href: "/schedule",
      label: t("nav.schedule", lang),
      Icon: CalendarIcon,
      key: "schedule",
    },
    {
      href: "/messages",
      label: t("nav.messages", lang),
      Icon: MessageIcon,
      key: "messages",
    },
    {
      href: "/notifications",
      label: t("nav.notifications", lang),
      Icon: BellIcon,
      key: "notifications",
    },
    {
      href: "/incidents",
      label: "Incidents",
      Icon: StarOfLifeIcon,
      key: "incidents",
    },
    {
      href: "/me",
      label: t("nav.me", lang),
      Icon: UserIcon,
      key: "me",
    },
  ];

  switch (role) {
    case "caregiver":
      return commonCareTabs;
    case "client":
    case "family":
      return commonCareTabs;
    case "admin":
      return [
        {
          href: "/home",
          label: t("nav.home", lang),
          Icon: HomeIcon,
          key: "home",
        },
        {
          href: "/clients",
          label: t("nav.clients", lang),
          Icon: GridIcon,
          key: "clients",
        },
        {
          href: "/team",
          label: t("nav.team", lang),
          Icon: UserIcon,
          key: "team",
        },
        {
          href: "/schedule",
          label: t("nav.schedule", lang),
          Icon: CalendarIcon,
          key: "schedule",
        },
        {
          href: "/incidents",
          label: "Incidents",
          Icon: StarOfLifeIcon,
          key: "incidents",
        },
        {
          href: "/notifications",
          label: t("nav.notifications", lang),
          Icon: BellIcon,
          key: "notifications",
        },
        {
          href: "/me",
          label: t("nav.me", lang),
          Icon: ListIcon,
          key: "me",
        },
      ];
    default:
      return [
        {
          href: "/home",
          label: t("nav.home", lang),
          Icon: HomeIcon,
          key: "home",
        },
        {
          href: "/messages",
          label: t("nav.messages", lang),
          Icon: MessageIcon,
          key: "messages",
        },
        {
          href: "/me",
          label: t("nav.me", lang),
          Icon: UserIcon,
          key: "me",
        },
      ];
  }
}
