/* Koleex Hub service worker.

   Two conservative jobs:
   1. Web Push — display incoming push messages + route taps (even when closed).
   2. App-shell cache — cache-first for Next.js's IMMUTABLE, content-hashed
      build output under /_next/static/ ONLY. This lets the installed PWA boot
      its own JS/CSS from cache (native-instant launch) and survives iOS
      evicting the HTTP cache. It is deliberately narrow:
        · same-origin GET requests only
        · /_next/static/ only — every file there has a hash in its name, so it
          can NEVER go stale; a new deploy just uses new hashes (cache misses
          that fetch fresh)
        · NEVER /api/* (data always hits the network)
        · NEVER HTML navigations (so a new app version is always picked up)
        · NEVER sw.js / cross-origin / non-GET
      The respondWith promise can never reject: on any error it falls back to a
      plain network fetch, so a cache problem can't break asset loading. */

/* v3: version bump forces every open window onto fresh code on activate (the
   `hadOld` navigate below) — used to roll the fleet onto the Discuss SSE
   delivery build promptly. */
const STATIC_CACHE = "kx-static-v3";

self.addEventListener("install", () => {
  // Activate immediately so the first subscribe works without a reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      let hadOld = false;
      try {
        const keys = await caches.keys();
        const old = keys.filter((k) => k.startsWith("kx-static-") && k !== STATIC_CACHE);
        hadOld = old.length > 0;
        await Promise.all(old.map((k) => caches.delete(k)));
      } catch {
        /* Cache API unavailable — ignore; push still works. */
      }
      await self.clients.claim();
      // If this activation REPLACED an older cache version, any open windows are
      // running stale JS — navigate them to the fresh code. Skipped on a first
      // install (no prior version), so we never reload a brand-new visitor.
      if (hadOld) {
        try {
          const wins = await self.clients.matchAll({ type: "window" });
          for (const w of wins) { try { w.navigate(w.url); } catch { /* ignore */ } }
        } catch { /* ignore */ }
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  // ONLY the immutable, hashed build output. Everything else is untouched.
  if (!url.pathname.startsWith("/_next/static/")) return;
  // DEV GUARD: dev-server chunk names are NOT content-hashed (stable names,
  // changing content), so cache-first would pin stale code across rebuilds —
  // the recurring "my change doesn't show" trap. Never cache on localhost.
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return;

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === "basic") {
          try {
            await cache.put(req, res.clone());
          } catch {
            /* quota — ignore */
          }
        }
        return res;
      } catch {
        return fetch(req); // last resort: never break asset loading
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Koleex Hub";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    timestamp: Date.now(),
    data: { url: payload.url || "/super-admin/activity" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing tab/PWA window if one is open, navigating it.
        for (const client of windowClients) {
          if ("focus" in client) {
            if ("navigate" in client) {
              try {
                client.navigate(targetUrl);
              } catch {
                /* cross-origin or unsupported — ignore */
              }
            }
            return client.focus();
          }
        }
        // Otherwise open a fresh window (launches the installed PWA on iOS).
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        return undefined;
      }),
  );
});
