"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type AvatarProfile = {
  full_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  id?: string;
};

export default function UserAvatar({
  person,
  size = "md",
  linkToProfile = true,
  className = ""
}: {
  person: AvatarProfile;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
  linkToProfile?: boolean;
  className?: string;
}) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveAvatarUrl() {
      setFailed(false);
      const avatarUrl = person.avatar_url;
      if (!avatarUrl) {
        setDisplayUrl(null);
        return;
      }

      if (avatarUrl.startsWith("/avatar-presets/")) {
        setDisplayUrl(avatarUrl);
        return;
      }

      const path = getAvatarStoragePath(avatarUrl);
      if (!path) {
        setDisplayUrl(avatarUrl);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);

      if (!cancelled) {
        setDisplayUrl(error ? null : data?.signedUrl ?? null);
      }
    }

    void resolveAvatarUrl();
    return () => {
      cancelled = true;
    };
  }, [person.avatar_url]);

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
    xxl: "w-32 h-32 text-4xl",
  }[size];

  const content = (
    <div
      className={`${sizeCls} ${className} rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden`}
      style={{
        backgroundColor: person.avatar_color || "#0D6587",
        color: "#fff",
      }}
    >
      {displayUrl && !failed ? (
        <img
          src={displayUrl}
          alt={person.full_name || "User"}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-display font-bold">{initials}</span>
      )}
    </div>
  );

  const preview = previewOpen && displayUrl && !failed && (
    <div
      className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setPreviewOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={`${person.full_name || "User"} profile photo preview`}
    >
      <div
        className="bg-white rounded-3xl shadow-lifted max-w-sm w-full p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={displayUrl}
          alt={`${person.full_name || "User"} profile photo`}
          className="w-full aspect-square object-cover rounded-2xl bg-cream-100"
        />
        <div className="flex gap-2 mt-3">
          {person.id && (
            <Link
              href={`/profiles/${person.id}`}
              className="flex-1 text-center bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition"
            >
              View profile
            </Link>
          )}
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="flex-1 bg-cream-100 hover:bg-cream-200 text-ink-800 py-2.5 rounded-xl text-sm font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  if (displayUrl && !failed) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="transition active:scale-95 rounded-full"
          aria-label={`Preview ${person.full_name || "user"} photo`}
        >
          {content}
        </button>
        {preview}
      </>
    );
  }

  if (linkToProfile && person.id) {
    return (
      <Link href={`/profiles/${person.id}`} className="transition active:scale-95">
        {content}
      </Link>
    );
  }

  return content;
}

function getAvatarStoragePath(value: string) {
  if (!value) return null;
  if (value.startsWith("http")) {
    const marker = "/avatars/";
    const index = value.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(value.slice(index + marker.length).split("?")[0]);
  }
  if (value.startsWith("/") || value.startsWith("data:")) return null;
  return value;
}
