"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AVATAR_UPLOAD_ERROR = "Profile photo could not be uploaded. Please try again.";

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

    const { data: publicUrl } = supabase.storage
      .from("avatars")
      .getPublicUrl(data.path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl.publicUrl })
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
      {error && <p className="text-xs text-terracotta-600 mt-1">{error}</p>}
    </div>
  );
}
