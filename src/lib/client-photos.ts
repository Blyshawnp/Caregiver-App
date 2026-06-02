export const CLIENT_PHOTO_BUCKET = "client-photos";
export const CLIENT_PHOTO_UPLOAD_ERROR =
  "Client photo could not be uploaded. Please try again.";

type SupabaseStorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
};

export function buildClientPhotoPath(orgId: string, clientId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return `${orgId}/${clientId}/${crypto.randomUUID()}.${ext}`;
}

export async function getClientPhotoDisplayUrl(
  supabase: SupabaseStorageClient,
  photoUrl: string | null
) {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http")) return photoUrl;

  const { data, error } = await supabase.storage
    .from(CLIENT_PHOTO_BUCKET)
    .createSignedUrl(photoUrl, 60 * 60);

  if (error || !data?.signedUrl) {
    console.error("Unable to sign client photo URL", {
      path: photoUrl,
      error: error?.message,
    });
    return null;
  }

  return data.signedUrl;
}

export async function withClientPhotoDisplayUrl<T extends { photo_url: string | null }>(
  supabase: SupabaseStorageClient,
  client: T
) {
  return {
    ...client,
    photo_display_url: await getClientPhotoDisplayUrl(supabase, client.photo_url),
  };
}

export async function withClientPhotoDisplayUrls<T extends { photo_url: string | null }>(
  supabase: SupabaseStorageClient,
  clients: T[]
) {
  return Promise.all(clients.map((client) => withClientPhotoDisplayUrl(supabase, client)));
}
