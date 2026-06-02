export const PET_PHOTO_BUCKET = "pet-photos";
export const PET_PHOTO_UPLOAD_ERROR =
  "Pet photo could not be uploaded. Please try again.";

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

type PetWithPhoto = {
  photo_url: string | null;
  photo_display_url?: string | null;
};

export function buildPetPhotoPath(orgId: string, clientId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return `${orgId}/${clientId}/${crypto.randomUUID()}.${ext}`;
}

export function parsePetPhotoReference(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/avatar-presets/")) {
    return { url: value };
  }
  if (!value.startsWith("http")) {
    return { bucket: PET_PHOTO_BUCKET, path: value };
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

export async function getPetPhotoDisplayUrl(
  supabase: SupabaseStorageClient,
  photoUrl: string | null
) {
  const ref = parsePetPhotoReference(photoUrl);
  if (!ref) return null;
  if ("url" in ref) return ref.url;

  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .createSignedUrl(ref.path, 60 * 60);

  if (error || !data?.signedUrl) {
    console.error("Unable to sign pet photo URL", {
      bucket: ref.bucket,
      path: ref.path,
      error: error?.message,
    });
    return photoUrl?.startsWith("http") ? photoUrl : null;
  }

  return data.signedUrl;
}

export async function withPetPhotoDisplayUrls<T extends PetWithPhoto>(
  supabase: SupabaseStorageClient,
  pets: T[]
) {
  return Promise.all(
    pets.map(async (pet) => ({
      ...pet,
      photo_display_url: await getPetPhotoDisplayUrl(supabase, pet.photo_url),
    }))
  );
}
