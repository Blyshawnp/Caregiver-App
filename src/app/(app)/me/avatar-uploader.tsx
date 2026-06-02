"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import UserAvatar from "@/components/user-avatar";

const AVATAR_PRESETS = ["cat", "dog", "lion", "squirrel", "bunny", "bird"] as const;

export default function AvatarUploader({
  userId,
  fullName,
  avatarUrl,
  avatarColor,
}: {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Avatar photo must be 5 MB or smaller.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    router.refresh();
  }

  async function selectPreset(preset: (typeof AVATAR_PRESETS)[number]) {
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: `/avatar-presets/${preset}.svg` })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar
        person={{
          full_name: fullName,
          avatar_url: avatarUrl,
          avatar_color: avatarColor,
        }}
        size="lg"
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-forest-600 font-medium hover:underline disabled:opacity-60"
        >
          {uploading ? "Uploading..." : avatarUrl ? "Change photo" : "Add photo"}
        </button>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {AVATAR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={uploading}
              onClick={() => void selectPreset(preset)}
              className="capitalize text-[10px] bg-cream-100 hover:bg-cream-200 text-ink-700 px-2 py-1 rounded-lg transition disabled:opacity-60"
            >
              {preset}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-terracotta-600 mt-1">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
