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

const T = {
  "u.available": { en: "A new version is available", zh: "有新版本可用", ar: "يتوفر إصدار جديد" },
  "u.sub": {
    en: "Update to load the latest improvements — takes a second and keeps you signed in.",
    zh: "更新即可加载最新改进 — 只需一秒，且无需重新登录。",
    ar: "حدّث لتحميل أحدث التحسينات — ثانية واحدة وبدون تسجيل خروج.",
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
        if (id !== boot.current && alive) setStale(true);
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
    /* Give the pressed/spinner state one frame to paint before the reload
       tears the page down — otherwise the tap feels ignored. */
    window.setTimeout(() => window.location.reload(), 180);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[400] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-inverted)] text-[var(--text-inverted)] pl-4 pr-2.5 py-2.5 shadow-2xl shadow-black/40 max-w-[min(92vw,26rem)]">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-tight">{t("u.available")}</div>
          <div className="mt-0.5 text-[11px] leading-snug opacity-70">{t("u.sub")}</div>
        </div>
        <button
          type="button"
          onClick={onUpdate}
          disabled={updating}
          aria-busy={updating}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-[var(--text-inverted)] text-[var(--bg-inverted)] text-[12px] font-semibold transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60 disabled:pointer-events-none"
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
