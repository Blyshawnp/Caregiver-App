# Caregiver App

Next.js 15 + Supabase PWA for managing a family caregiver schedule.
Installs as an Android app via Bubblewrap, as a PWA on iPhone via Safari.

## First-time setup

### 1. Install Node.js (skip if you already have it)

Make sure you have Node 20 or newer:
```
node --version
```
If not, install from https://nodejs.org (LTS version).

### 2. Install dependencies

From inside this folder:
```
npm install
```

### 3. Configure Supabase credentials

Copy the example env file:
```
cp .env.local.example .env.local
```

Open `.env.local` and fill in your two values from
**Supabase Dashboard → Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL` → "Project URL"
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → "Project API keys" → `anon` `public` key

### 4. Run the dev server

```
npm run dev
```

Open http://localhost:3000

You should be redirected to /login. Sign in with the email + password you
created in Supabase Authentication > Users. After login you should land on
/dashboard and see your name, role, and organization pulled live from the
database.

If that works, the entire stack is correctly wired up.

## What's in this starter

- Next.js 15 (App Router) + React 19 + TypeScript
- Supabase auth via @supabase/ssr (cookie-based sessions)
- Middleware that refreshes sessions and protects routes
- Login page (email + password)
- Dashboard server component reading from RLS-protected `profiles` table
- Sign-out flow
- Tailwind CSS 3 with custom theme:
  - Fraunces (serif) for display headings
  - Manrope for body text
  - Warm cream / forest green / terracotta palette
- PWA manifest (ready for icon files)

## Next features (we'll build these next)

- Schedule view (upcoming shifts for the org)
- Check-in / check-out with geofence verification
- To-do list per shift
- Master to-do template management
- Pay summary (uses the `shift_pay_details` view)
- Caregiver-to-caregiver messaging

## Folder structure

```
src/
  app/
    layout.tsx            # Root layout, fonts
    page.tsx              # Redirect to /dashboard
    globals.css           # Tailwind + base styles
    login/page.tsx        # Sign-in page
    dashboard/
      page.tsx            # Server component: profile data
      sign-out-button.tsx # Client component: sign out
    auth/callback/route.ts # OAuth/magic link callback
  lib/
    supabase/
      client.ts           # Browser client
      server.ts           # Server client (uses cookies)
  middleware.ts           # Session refresh + route protection
public/
  manifest.json           # PWA manifest
```
