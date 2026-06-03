import { resolveAvatarPresetPath } from "@/lib/avatar-presets";

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

function parseClientPhotoReference(value: string | null) {
  if (!value) return null;
  const presetPath = resolveAvatarPresetPath(value);
  if (presetPath?.startsWith("/avatar-presets/")) {
    return { url: presetPath };
  }
  if (!value.startsWith("http")) {
    return { bucket: CLIENT_PHOTO_BUCKET, path: value };
  }

  try {
    const url = new URL(value);
    const match = url.pathname.match(
      /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/
    );
    if (!match) return { url: value };
    return {
      bucket: decodeURIComponent(match[1]),
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return { url: value };
  }
}

export async function getClientPhotoDisplayUrl(
  supabase: SupabaseStorageClient,
  photoUrl: string | null
) {
  const ref = parseClientPhotoReference(photoUrl);
  if (!ref) return null;
  if ("url" in ref) return ref.url;

  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .createSignedUrl(ref.path, 60 * 60);

  if (error || !data?.signedUrl) {
    console.error("Unable to sign client photo URL", {
      bucket: ref.bucket,
      path: ref.path,
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
