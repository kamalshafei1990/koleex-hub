"use client";

/* ---------------------------------------------------------------------------
   UpdateWatcher — detects a new deployment and offers a one-tap refresh, so
   the installed PWA / cached browser stops showing stale code after a deploy.

   It polls a tiny no-store /api/version (which returns the deploy's build id)
   on mount, whenever the tab/app becomes visible again, and every few minutes.
   If the id differs from the one we booted with, a subtle "new version" pill
   appears; tapping Refresh reloads to the fresh code. We never auto-reload, so
   we can't interrupt something the user is typing.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";

export default function UpdateWatcher() {
  const boot = useRef<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { id } = (await r.json()) as { id?: string };
        if (!id || id === "dev") return;
        if (boot.current == null) { boot.current = id; return; }
        if (id !== boot.current && alive) setStale(true);
      } catch {
        /* offline / transient — ignore */
      }
    };
    void check();
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis);
    const iv = window.setInterval(() => { void check(); }, 5 * 60 * 1000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(iv);
    };
  }, []);

  if (!stale) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[400] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-inverted)] text-[var(--text-inverted)] pl-4 pr-2 py-2 shadow-2xl shadow-black/40">
        <span className="text-[13px] font-medium">A new version is available</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-7 px-3 rounded-full bg-[var(--text-inverted)] text-[var(--bg-inverted)] text-[12px] font-semibold hover:opacity-90"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
