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
    const tick = async () => {
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
    const iv = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  return null;
}
