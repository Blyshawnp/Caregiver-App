"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AvatarPickerModal from "@/components/avatar-preset-picker";
import ClientPhoto from "@/components/client-photo";
import {
  CLIENT_PHOTO_BUCKET,
  CLIENT_PHOTO_UPLOAD_ERROR,
  buildClientPhotoPath,
} from "@/lib/client-photos";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/use-translation";

export default function ClientPhotoUploader({
  clientId,
  orgId,
  clientName,
  currentPhotoUrl,
}: {
  clientId: string;
  orgId: string;
  clientName: string;
  currentPhotoUrl: string | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function uploadPhoto(file: File) {
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const path = buildClientPhotoPath(orgId, clientId, file);

    const { data, error: uploadError } = await supabase.storage
      .from(CLIENT_PHOTO_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError || !data?.path) {
      console.error("Client photo upload failed", {
        clientId,
        orgId,
        error: uploadError?.message,
      });
      setError(CLIENT_PHOTO_UPLOAD_ERROR);
      setUploading(false);
      return false;
    }

    const { error: updateError } = await supabase
      .from("clients")
      .update({ photo_url: data.path })
      .eq("id", clientId);

    if (updateError) {
      console.error("Client photo record update failed", {
        clientId,
        orgId,
        path: data.path,
        error: updateError.message,
      });
      setError(CLIENT_PHOTO_UPLOAD_ERROR);
      setUploading(false);
      return false;
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(CLIENT_PHOTO_BUCKET)
      .createSignedUrl(data.path, 60 * 60);
    if (signError) {
      console.error("Client photo signed URL failed", {
        clientId,
        orgId,
        path: data.path,
        error: signError.message,
      });
    }

    setPreviewUrl(signed?.signedUrl ?? URL.createObjectURL(file));
    setUploading(false);
    router.refresh();
    return true;
  }

  async function savePreset(path: string) {
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("clients")
      .update({ photo_url: path })
      .eq("id", clientId);

    if (updateError) {
      console.error("Client photo preset update failed", {
        clientId,
        orgId,
        path,
        error: updateError.message,
      });
      setError(CLIENT_PHOTO_UPLOAD_ERROR);
      setUploading(false);
      return false;
    }

    setPreviewUrl(path);
    setUploading(false);
    router.refresh();
    return true;
  }

  async function removePhoto() {
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("clients")
      .update({ photo_url: null })
      .eq("id", clientId);

    if (updateError) {
      setError(CLIENT_PHOTO_UPLOAD_ERROR);
      setUploading(false);
      return false;
    }

    setPreviewUrl(null);
    setUploading(false);
    router.refresh();
    return true;
  }

  return (
    <div className="flex items-center gap-4">
      <ClientPhoto name={clientName} photoUrl={previewUrl} size="lg" />
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={uploading}
          className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {uploading ? "Uploading..." : t("avatar.chooseProfilePicture")}
        </button>
        {error && <p className="text-xs text-terracotta-600 mt-2">{error}</p>}
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
        currentValue={previewUrl}
        saving={uploading}
        error={error}
        onClose={() => setPickerOpen(false)}
        onUpload={uploadPhoto}
        onSavePreset={savePreset}
        onRemove={removePhoto}
      />
    </div>
  );
}
