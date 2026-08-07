"use client";

import { useEffect } from "react";

/* Localhost-only live-preview reloader. Polls the build fingerprint
   every 3s; when a new `next build` lands (server restarted with a new
   BUILD_ID), the tab reloads itself — the owner sees every deployed
   change immediately without touching the refresh button. No-op off
   localhost, so production users are never polled or reloaded. */

export default function DevReload() {
  useEffect(() => {
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
    let current: string | null = null;
    let alive = true;
    let lastTick = 0;
    const tick = async () => {
      /* Throttle: wake signals include pointermove, which fires
         continuously — without this floor the poller was hitting the
         API a dozen+ times per screen visit and polluting every
         network measurement taken on localhost. */
      const now = Date.now();
      if (now - lastTick < 3000) return;
      lastTick = now;
      try {
        const r = await fetch("/api/dev/build-stamp", { cache: "no-store" });
        const { id } = (await r.json()) as { id?: string };
        if (!alive || !id || id === "unknown") return;
        if (current && id !== current) {
          window.location.reload();
          return;
        }
        current = id;
      } catch {
        /* server mid-restart — the next tick picks up the new build */
      }
    };
    tick();
    const iv = setInterval(tick, 3100);
    /* The embedded preview pane FREEZES timers while backgrounded and
       does not resume them — so also tick on every wake signal, making
       the reload land the instant the owner looks back at the tab. */
    const wake = () => void tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    document.addEventListener("pointermove", wake, { passive: true });
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      document.removeEventListener("pointermove", wake);
    };
  }, []);
  return null;
}
