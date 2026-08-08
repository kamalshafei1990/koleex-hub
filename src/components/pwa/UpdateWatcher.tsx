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
import { useTranslation } from "@/lib/i18n";

/* The commit this BUNDLE was compiled from. Primary source: the kx-build
   <meta> the root layout bakes into the HTML at build time (deterministic —
   no dependency on Vercel's "expose system env" setting). Fallback: the
   NEXT_PUBLIC_ inline if it happens to exist. Comparing against this — rather
   than against whatever /api/version returned at mount — means a tab that was
   already open before a deploy is caught on its very first check. */
function bootBuildId(): string {
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="kx-build"]') as HTMLMetaElement | null;
    const v = meta?.content?.trim();
    if (v && v !== "dev") return v;
  }
  return process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "";
}

/* Copy calibrated twice by the owner (2026-08-08): the original two-line
   explanation was "a lot of text", the bare "New version" was "too less".
   Middle ground: full title + ONE short reassurance line. */
const T = {
  "u.available": { en: "New version available", zh: "新版本可用", ar: "إصدار جديد متاح" },
  "u.sub": {
    en: "Takes a second — you stay signed in.",
    zh: "只需一秒，无需重新登录。",
    ar: "ثانية واحدة — وتفضل مسجّل الدخول.",
  },
  "u.refresh":  { en: "Update",      zh: "更新",       ar: "تحديث" },
  "u.updating": { en: "Updating…",   zh: "正在更新…",  ar: "جارٍ التحديث…" },
};

export default function UpdateWatcher() {
  const { t } = useTranslation(T);
  const boot = useRef<string | null>(null);
  const [stale, setStale] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let alive = true;
    if (boot.current == null) boot.current = bootBuildId() || null;
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { id } = (await r.json()) as { id?: string };
        if (!id || id === "dev") return;
        if (boot.current == null) { boot.current = id; return; }
        if (id !== boot.current && alive) {
          setStale(true);
          /* Global flag read by AppLaunchLink: while stale, the next app
             launch becomes a FULL navigation so the user rides onto the new
             bundle mid-launch — no pill tap required. Kills the "nothing
             changed" loop for long-lived tabs/desktop windows. */
          (globalThis as typeof globalThis & { __kxStaleBuild?: boolean }).__kxStaleBuild = true;
        }
      } catch {
        /* offline / transient — ignore */
      }
    };
    void check();
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis);
    /* Also on window focus — visibilitychange misses focus switches between
       two visible windows (common on desktop). */
    window.addEventListener("focus", onVis);
    /* 60s, not 5min: stale tabs were surviving whole review sessions and the
       owner kept judging OLD bundles ("nothing changed"). A no-store fetch of
       ~50 bytes per minute per visible tab is nothing. */
    const iv = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 60 * 1000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.clearInterval(iv);
    };
  }, []);

  if (!stale) return null;

  const onUpdate = () => {
    if (updating) return;
    setUpdating(true);
    /* Belt-and-suspenders before the reload: nudge the service worker to
       fetch its newest self and drop the hashed-chunk cache, so the reload
       can only come back fresh. Every step is best-effort — worst case we
       still do the plain reload we always did. (The 180ms floor keeps the
       pressed/spinner state visible for a frame so the tap feels heard.) */
    void (async () => {
      const started = Date.now();
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update().catch(() => {})));
        }
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k.startsWith("kx-static-")).map((k) => caches.delete(k)));
        }
      } catch { /* best-effort */ }
      const wait = Math.max(0, 180 - (Date.now() - started));
      window.setTimeout(() => window.location.reload(), wait);
    })();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[400] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pointer-events-none">
      {/* Owner pick 2026-08-08 (motion sample U5): always-dark capsule with a
          Hub Blue ring + glow and the K monogram — the update moment carries
          the brand identity in BOTH themes (a dark floating capsule reads as
          a system toast on light backgrounds too). Copy unchanged. */}
      <div className="kx-sheet-in pointer-events-auto flex items-center gap-3.5 rounded-2xl border border-[#7FA9D6]/45 bg-[#0e1116] text-white pl-4 pr-3 py-3 shadow-[0_0_22px_rgba(86,127,178,0.35),0_18px_40px_-12px_rgba(0,0,0,0.6)] max-w-[min(92vw,28rem)]">
        {/* Owner call: the REAL hub script mark, not a letter. Served through
            the image optimizer (128px variant, ~few KB) and SW-cached, so it
            is instant after first sight. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny optimized brand asset */}
        <img
          src="/_next/image?url=%2Fbrand%2Fhub-logo%2Fhub-script.png&w=128&q=75"
          alt=""
          aria-hidden
          className="h-7 w-auto shrink-0"
        />
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold leading-tight">{t("u.available")}</div>
          <div className="mt-1 text-[11.5px] leading-snug text-white/70">{t("u.sub")}</div>
        </div>
        <button
          type="button"
          onClick={onUpdate}
          disabled={updating}
          aria-busy={updating}
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-[#0b0b0b] text-[12.5px] font-semibold transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FA9D6] disabled:opacity-60 disabled:pointer-events-none"
        >
          {updating && (
            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          {updating ? t("u.updating") : t("u.refresh")}
        </button>
      </div>
    </div>
  );
}
