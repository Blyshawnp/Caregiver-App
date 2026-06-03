"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import UserAvatar from "@/components/user-avatar";
import AvatarPickerModal from "@/components/avatar-preset-picker";
import { useTranslation } from "@/lib/use-translation";

const PROFILE_PHOTO_UPLOAD_ERROR = "Profile photo could not be uploaded. Please try again.";

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
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function upload(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Avatar photo must be 5 MB or smaller.");
      return false;
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
      console.error("Profile photo upload failed", {
        userId,
        error: uploadError.message,
      });
      setError(PROFILE_PHOTO_UPLOAD_ERROR);
      setUploading(false);
      return false;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);

    if (updateError) {
      console.error("Profile photo record update failed", {
        userId,
        path,
        error: updateError.message,
      });
      setError(PROFILE_PHOTO_UPLOAD_ERROR);
      setUploading(false);
      return false;
    }

    setUploading(false);
    router.refresh();
    return true;
  }

  async function savePreset(path: string) {
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", userId);

    if (updateError) {
      setError(PROFILE_PHOTO_UPLOAD_ERROR);
      setUploading(false);
      return false;
    }

    setUploading(false);
    router.refresh();
    return true;
  }

  async function removePhoto() {
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);

    if (updateError) {
      setError(PROFILE_PHOTO_UPLOAD_ERROR);
      setUploading(false);
      return false;
    }

    setUploading(false);
    router.refresh();
    return true;
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
          onClick={() => setPickerOpen(true)}
          disabled={uploading}
          className="text-sm text-forest-600 font-medium hover:underline disabled:opacity-60"
        >
          {uploading ? "Uploading..." : t("avatar.chooseProfilePicture")}
        </button>
        {error && <p className="text-xs text-terracotta-600 mt-1">{error}</p>}
      </div>
      <AvatarPickerModal
        open={pickerOpen}
        title={t("avatar.chooseProfilePicture")}
        uploadLabel={t("avatar.uploadImage")}
        chooseAvatarLabel={t("avatar.chooseAvatar")}
        animalAvatarsLabel={t("avatar.animalAvatars")}
        saveAvatarLabel={t("avatar.saveAvatar")}
        removePhotoLabel={t("avatar.removePhoto")}
        avatarSelectedLabel={t("avatar.avatarSelected")}
        attributionLabel={t("avatar.vecteezyAttribution")}
        currentValue={avatarUrl}
        saving={uploading}
        error={error}
        onClose={() => setPickerOpen(false)}
        onUpload={upload}
        onSavePreset={savePreset}
        onRemove={removePhoto}
      />
    </div>
  );
}
