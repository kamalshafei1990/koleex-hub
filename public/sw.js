/* Koleex Hub service worker — push notifications only.

   Intentionally has NO `fetch` handler, so it does not cache or intercept any
   network request and cannot change existing app behavior. Its only jobs are
   to display incoming Web Push messages (lock screen / Notification Center /
   badge) and route taps to the right page — even when the app is closed. */

self.addEventListener("install", () => {
  // Activate immediately so the first subscribe works without a reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
