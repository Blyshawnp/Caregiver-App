"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createPortal } from "react-dom";
import { resolveAvatarPresetPath, isAvatarPresetPath } from "@/lib/avatar-presets";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolveAvatarUrl() {
      setFailed(false);
      const avatarUrl = person.avatar_url;
      if (!avatarUrl) {
        setDisplayUrl(null);
        return;
      }

      const presetPath = resolveAvatarPresetPath(avatarUrl);
      if (presetPath?.startsWith("/avatar-presets/")) {
        setDisplayUrl(presetPath);
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

  useEffect(() => {
    if (!previewOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen]);

  useEffect(() => {
    if (previewOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [previewOpen]);

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

  const preview = previewOpen && displayUrl && !failed && mounted && createPortal(
    <div
      className="fixed inset-0 z-[1200] bg-ink-950/80 backdrop-blur-sm p-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-center justify-center cursor-pointer"
      onClick={() => setPreviewOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={`${person.full_name || "User"} profile photo preview`}
    >
      <div
        className="bg-white rounded-3xl shadow-lifted w-[calc(100vw-2rem)] max-w-[420px] max-h-[85dvh] p-5 flex flex-col cursor-default"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-900 truncate pr-2">
            {person.full_name || "Profile Photo"}
          </h3>
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="bg-cream-100 hover:bg-cream-200 text-ink-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0"
          >
            Close
          </button>
        </div>
        <div className="w-full flex justify-center items-center bg-cream-50 rounded-2xl p-2 overflow-hidden mb-4">
          <img
            src={displayUrl}
            alt={`${person.full_name || "User"} profile photo`}
            className="object-contain rounded-xl mx-auto"
            style={{ maxWidth: "min(280px, 70vw)", maxHeight: "min(320px, 45dvh)" }}
          />
        </div>
        <div className="w-full flex flex-col gap-2">
          {person.id && (
            <Link
              href={`/profiles/${person.id}`}
              onClick={() => setPreviewOpen(false)}
              className="w-full text-center bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              View profile
            </Link>
          )}
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="w-full text-center bg-cream-100 hover:bg-cream-200 text-ink-700 py-2.5 rounded-xl text-xs font-semibold transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  const isPreset = person.avatar_url ? isAvatarPresetPath(person.avatar_url) : true;

  if (displayUrl && !isPreset && !failed) {
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
