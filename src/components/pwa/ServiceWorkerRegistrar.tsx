"use client";

/* Registers the push service worker (public/sw.js) once on mount.

   Headless + best-effort. The SW has no fetch handler, so this cannot affect
   page loads or caching — it only enables push delivery. Subscription itself
   happens later, on an explicit user tap in Settings → Notifications. */

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
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
