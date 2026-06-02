"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AVATAR_UPLOAD_ERROR = "Profile photo could not be uploaded. Please try again.";
const AVATAR_PRESETS = ["cat", "dog", "lion", "squirrel", "bunny", "bird"] as const;

export default function TeamAvatarUploader({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadAvatar(file: File) {
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${personId}/${crypto.randomUUID()}.${ext}`;

    const { data, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError || !data?.path) {
      console.error("Team avatar upload failed", {
        personId,
        error: uploadError?.message,
      });
      setError(AVATAR_UPLOAD_ERROR);
      setUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: data.path })
      .eq("id", personId);

    if (updateError) {
      console.error("Team avatar profile update failed", {
        personId,
        path: data.path,
        error: updateError.message,
      });
      setError(AVATAR_UPLOAD_ERROR);
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
      .eq("id", personId);

    if (updateError) {
      setError(AVATAR_UPLOAD_ERROR);
      setUploading(false);
      return;
    }

    setUploading(false);
    router.refresh();
  }

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadAvatar(file);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-sm text-forest-600 font-medium hover:underline disabled:opacity-50"
      >
        {uploading ? "Uploading photo..." : `Upload photo for ${personName}`}
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
  );
}
