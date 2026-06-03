"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AvatarPickerModal from "@/components/avatar-preset-picker";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/use-translation";

const AVATAR_UPLOAD_ERROR = "Profile photo could not be uploaded. Please try again.";

export default function TeamAvatarUploader({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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
      return false;
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
      .eq("id", personId);

    if (updateError) {
      setError(AVATAR_UPLOAD_ERROR);
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
      .eq("id", personId);

    if (updateError) {
      setError(AVATAR_UPLOAD_ERROR);
      setUploading(false);
      return false;
    }

    setUploading(false);
    router.refresh();
    return true;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={uploading}
        className="text-sm text-forest-600 font-medium hover:underline disabled:opacity-50"
      >
        {uploading ? "Uploading photo..." : t("avatar.chooseProfilePicture")}
      </button>
      {error && <p className="text-xs text-terracotta-600 mt-1">{error}</p>}
      <AvatarPickerModal
        open={pickerOpen}
        title={`${t("avatar.chooseProfilePicture")} - ${personName}`}
        uploadLabel={t("avatar.uploadImage")}
        chooseAvatarLabel={t("avatar.chooseAvatar")}
        animalAvatarsLabel={t("avatar.animalAvatars")}
        saveAvatarLabel={t("avatar.saveAvatar")}
        removePhotoLabel={t("avatar.removePhoto")}
        avatarSelectedLabel={t("avatar.avatarSelected")}
        attributionLabel={t("avatar.vecteezyAttribution")}
        saving={uploading}
        error={error}
        onClose={() => setPickerOpen(false)}
        onUpload={uploadAvatar}
        onSavePreset={savePreset}
        onRemove={removePhoto}
      />
    </div>
  );
}
