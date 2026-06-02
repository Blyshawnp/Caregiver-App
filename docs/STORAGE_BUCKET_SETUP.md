# Storage Bucket Setup

Buckets expected in Supabase:

- `avatars`: caregiver/admin/user avatar images. Existing app behavior uses a public bucket and stores public URLs in `profiles.avatar_url`.
- `pet-photos`: private pet photos. Code stores storage paths in `client_pets.photo_url` and creates signed URLs for display.
- `client-photos`: private care recipient photos. Code stores storage paths in `clients.photo_url` and creates signed URLs for display.
- `client-files`: recommended bucket for future client-specific file uploads.
- `documents`: recommended bucket for future general document uploads.
- `app-assets`: public app branding and non-sensitive assets only.

Current legacy document uploads still use `client-documents`. Do not move those files without a separate object migration and database-path migration plan.

## Policies

Run the latest migrations in Supabase SQL Editor. They preserve existing data and add:

- `pet-photos` private bucket policies for admin/client upload and permitted viewer signed reads.
- `client-photos` private bucket policies for admin/client upload and permitted viewer signed reads.
- `avatars` team-avatar policies for authorized admins/client admins while preserving self-upload.

## Testing

1. Upload a pet photo from `Clients -> View profile -> Pets`.
2. Confirm `client_pets.photo_url` stores a path like `org-id/client-id/file.webp`.
3. Refresh the pet card/detail and emergency print page.
4. Upload a client photo from `Clients -> View profile`.
5. Confirm `clients.photo_url` stores a path and the client list/profile renders the signed image.
6. Upload a caregiver photo from the caregiver team profile and confirm it appears anywhere `UserAvatar` renders.

Common failures: missing migration, wrong bucket privacy, stale signed URL, app pointed to a different Supabase project, or a path that does not start with `organization_id/client_id`.
