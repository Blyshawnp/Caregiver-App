// Caregiver app service worker
// Handles offline shell + caches static assets so the app launches when offline.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `caregiver-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `caregiver-runtime-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

// Install: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {
        /* tolerate any 404s during install */
      })
    )
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Navigation requests (HTML pages): network-first, fall back to cache
// - Same-origin static assets (_next/static, /icon-*, etc): cache-first
// - Everything else (API, Supabase): network-only (don't cache auth tokens etc)
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip Supabase API and other cross-origin
  if (url.origin !== self.location.origin) return;

  // Skip Next.js HMR / dev-only requests
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // Navigation = network first, cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return (
            cached ||
            new Response(
              "<h1>Offline</h1><p>Reconnect and refresh.</p>",
              {
                status: 503,
                headers: { "Content-Type": "text/html" },
              }
            )
          );
        })
    );
    return;
  }

  // Static assets: cache first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
