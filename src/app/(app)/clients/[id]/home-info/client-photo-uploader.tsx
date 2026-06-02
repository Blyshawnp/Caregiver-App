"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ClientPhoto from "@/components/client-photo";
import {
  CLIENT_PHOTO_BUCKET,
  CLIENT_PHOTO_UPLOAD_ERROR,
  buildClientPhotoPath,
} from "@/lib/client-photos";
import { createClient } from "@/lib/supabase/client";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      return;
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
      return;
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
  }

  return (
    <div className="flex items-center gap-4">
      <ClientPhoto name={clientName} photoUrl={previewUrl} size="lg" />
      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadPhoto(file);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload client photo"}
        </button>
        {error && <p className="text-xs text-terracotta-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}
