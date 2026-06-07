// Carer Vista Pro service worker
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
  "/favicon-cvp.ico",
  "/favicon.ico",
  "/favicon-32.png",
];

const SW_VERSION = "20260607.01";

// Helper for saving service worker trace logs
async function saveSwTrace(traceData) {
  try {
    const cache = await caches.open("sw-trace-cache");
    const existingResponse = await cache.match("https://caregiver-app/sw-trace.json");
    let existingData = {};
    if (existingResponse) {
      try {
        existingData = await existingResponse.json();
      } catch (e) {
        existingData = {};
      }
    }
    const newData = {
      ...existingData,
      ...traceData,
      swVersion: SW_VERSION,
      lastUpdateTime: new Date().toISOString(),
    };
    await cache.put(
      "https://caregiver-app/sw-trace.json",
      new Response(JSON.stringify(newData), {
        headers: { "Content-Type": "application/json" }
      })
    );
  } catch (err) {
    console.warn("[sw-trace] failed to save trace", err);
  }
}

// Message listener to trigger skipWaiting
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Install: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) =>
        cache.addAll(STATIC_ASSETS).catch(() => {
          /* tolerate any 404s during install */
        })
      ),
      saveSwTrace({ installTime: new Date().toISOString() })
    ])
  );
  self.skipWaiting();
});

// Activate: clean up old caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE && k !== "sw-trace-cache")
            .map((k) => caches.delete(k))
        )
      ),
      self.clients.claim(),
      saveSwTrace({ activateTime: new Date().toISOString() })
    ])
  );
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
    url.pathname === "/favicon-cvp.ico" ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/favicon-32.png"
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

self.addEventListener("push", (event) => {
  const receiveTime = new Date().toISOString();
  let payload = {
    title: "Carer Vista Pro",
    body: "You have a new notification.",
    url: "/notifications",
    tag: "caregiver-notification",
    sound: "normal",
  };

  let parseResult = "default_fallback";
  let parseError = null;
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
      parseResult = "success";
    }
  } catch (err) {
    parseResult = "failure";
    parseError = err instanceof Error ? err.message : String(err);
  }

  const traceData = {
    lastPushReceivedTime: receiveTime,
    lastPushPayload: JSON.stringify(payload),
    lastPushParseResult: parseResult,
    lastPushParseError: parseError,
    lastNotificationTitle: payload.title || "Carer Vista Pro",
    lastNotificationTag: payload.tag || "caregiver-notification",
    receivedTestPushId: payload.testPushId || null,
  };

  const showPromise = async () => {
    const attemptTime = new Date().toISOString();
    let showResult = "attempted";
    let showError = null;
    try {
      await self.registration.showNotification(payload.title || "Carer Vista Pro", {
        body: payload.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: payload.tag || "caregiver-notification",
        renotify: payload.sound === "urgent" || payload.sound === "urgent_alert",
        requireInteraction: payload.sound === "urgent" || payload.sound === "urgent_alert",
        data: {
          url: payload.url || "/notifications",
          sound: payload.sound || "normal",
        },
      });
      showResult = "success";
    } catch (err) {
      showResult = "failure";
      showError = err instanceof Error ? err.message : String(err);
    }

    await saveSwTrace({
      ...traceData,
      lastShowNotificationAttemptedTime: attemptTime,
      lastShowNotificationResult: showResult,
      lastShowNotificationError: showError,
    });

    if (showError) {
      throw new Error(showError);
    }
  };

  event.waitUntil(showPromise());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/notifications",
    self.location.origin
  ).href;

  event.waitUntil(
    Promise.all([
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client && client.url === targetUrl) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
      saveSwTrace({
        lastClickTime: new Date().toISOString(),
        lastClickUrl: targetUrl,
      })
    ])
  );
});
