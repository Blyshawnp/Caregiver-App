# Push Notifications Setup

This app uses Web Push with VAPID. The browser subscribes with the public key, and the server sends with the matching private key. Do not generate or replace keys unless the existing pair is proven invalid and approved.

## Required Vercel Environment Variables

Set these in the private/personal app Vercel project:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

The client must use `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Server-side push sending must use `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`, with the public sender fingerprint computed from `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

Do not expose `VAPID_PRIVATE_KEY` to the client. Do not commit `.env.local`.

## Supabase Edge Function Secrets

The `auto-checkout-push` Edge Function can also send push notifications. If it is deployed, set the same key pair as Vercel:

```bash
supabase secrets set NEXT_PUBLIC_VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=...
```

Use the Supabase dashboard or CLI for the correct project. The Supabase Edge Function secrets must match the same VAPID key pair used by Vercel.

## Local Key Pair Check

Run this from the repo root:

```bash
node docs/scripts/check-vapid-keypair.js
```

The script reads `.env.local`, prints whether required values are present, shows a public key fingerprint and public key preview, and checks whether the public/private key pair appears valid. It never prints the private key.

## Manual Production Steps

1. Confirm local `.env.local` has `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.
2. Run `node docs/scripts/check-vapid-keypair.js`.
3. Confirm the Vercel production environment variables use the same key pair.
4. If `auto-checkout-push` is deployed, confirm Supabase Edge Function secrets use the same key pair.
5. Redeploy the app after environment variable changes.
6. In the app, open Notifications and use Disable on this device.
7. Refresh or re-enable notifications.
8. Run Send test notification.

If `NEXT_PUBLIC_VAPID_PUBLIC_KEY` changes, all existing browser subscriptions must be refreshed.

## Diagnostics Meanings

- Device subscription key changed: the saved browser subscription fingerprint does not match the current app public key. Refresh notifications on that device.
- Server key mismatch: the server sender key pair does not match the app public key. Fix Vercel and Supabase environment variables, then redeploy.
- Server push not configured: one or more required VAPID variables are missing.
- Expired subscription: the browser push service returned 404 or 410. Refresh notifications on that device.
- No active subscription: the browser subscription was not saved or the server lookup cannot find the active row for this device.
