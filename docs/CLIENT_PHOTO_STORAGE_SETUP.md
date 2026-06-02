# Client Photo Storage Setup

Bucket: `client-photos`

Recommended visibility: private.

Database column: `public.clients.photo_url text`. The app stores the storage path, not a public URL.

Path format: `organization_id/client_id/random-file-name.ext`

Display behavior: server code creates signed URLs through `src/lib/client-photos.ts`. Do not use `getPublicUrl` for this bucket.

Upload roles:

- Admins can upload/update client photos in their organization.
- Client admins can upload/update when the app permission model allows client management.

View roles:

- Admin/client admin can view clients in their organization.
- Caregivers and family/client viewers can view photos only when they can view that client.

Run `supabase/migrations/20260602100000_client_photo_storage.sql` to create the column, bucket config, and policies. No rows are deleted or reset.
