"use client";

/* Registers the push service worker (public/sw.js) once on mount.

   Headless + best-effort. The SW has no fetch handler, so this cannot affect
   page loads or caching — it only enables push delivery. Subscription itself
   happens later, on an explicit user tap in Settings → Notifications. */

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    /* localhost = the owner's live-preview server (rebuilt constantly).
       The SW's static cache pins old hashed chunks across rebuilds there,
       so the preview looks "stuck" even after reloads. Skip registration
       AND unregister any previously-installed SW + drop its caches so
       localhost always serves fresh from the server. Prod is unaffected. */
    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
      return;
    }
    // Register after load so it never competes with first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
        console.warn("[pwa] service worker registration failed:", e?.message ?? e);
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
