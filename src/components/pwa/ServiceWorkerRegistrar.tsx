"use client";

/* Registers the push service worker (public/sw.js) once on mount.

   Headless + best-effort. The SW has no fetch handler, so this cannot affect
   page loads or caching — it only enables push delivery. Subscription itself
   happens later, on an explicit user tap in Settings → Notifications.

   Once someone is signed in, an EXISTING subscription on this device is
   re-saved for them (lib/push-client resyncPushSubscription): the server
   gives a device to whoever saved it last, and after an account switch that
   could still be the previous person. No prompt, no new subscription. */

import { useEffect } from "react";
import { useCurrentAccountId } from "@/lib/identity";

export default function ServiceWorkerRegistrar() {
  const accountId = useCurrentAccountId();
  useEffect(() => {
    if (!accountId || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
    const t = window.setTimeout(() => {
      void import("@/lib/push-client").then(({ resyncPushSubscription }) => resyncPushSubscription(accountId));
    }, 3000);
    return () => window.clearTimeout(t);
  }, [accountId]);

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
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          /* iOS standalone does NOT reliably re-check the SW when the app
             resumes from the switcher — a stuck installation can keep
             serving an old bundle through deploy after deploy ("it looks
             like you did nothing"). Force an update check on every return
             to the foreground; the SW's skipWaiting + clients.claim make a
             found update take over immediately. */
          const onVisible = () => {
            if (document.visibilityState === "visible") reg.update().catch(() => {});
          };
          document.addEventListener("visibilitychange", onVisible);
          reg.update().catch(() => {});
        })
        .catch((e) => {
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
