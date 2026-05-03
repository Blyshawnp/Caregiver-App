"use client";

import Link from "next/link";

export type AvatarProfile = {
  full_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  id?: string;
};

export default function UserAvatar({
  person,
  size = "md",
  linkToProfile = true
}: {
  person: AvatarProfile;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  linkToProfile?: boolean;
}) {
  const initials = person.full_name
    ? person.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const sizeCls = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-9 h-9 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-16 h-16 text-lg",
    xl: "w-24 h-24 text-2xl",
  }[size];

  const content = (
    <div
      className={`${sizeCls} rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden`}
      style={{
        backgroundColor: person.avatar_color || "#3F6053",
        color: "#fff",
      }}
    >
      {person.avatar_url ? (
        <img
          src={person.avatar_url}
          alt={person.full_name || "User"}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-display font-bold">{initials}</span>
      )}
    </div>
  );

  if (linkToProfile && person.id) {
    return (
      <Link href={`/profiles/${person.id}`} className="transition active:scale-95">
        {content}
      </Link>
    );
  }

  return content;
}
