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
import { whenNetworkQuiet } from "@/lib/net-idle";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

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

/* Copy calibrated three times by the owner: the original two-line explanation
   was "a lot of text", the bare "New version" was "too less", and the
   title-plus-reassurance middle ground was still "text in two lines". Final:
   the title alone, on one line. The sub-line and its dictionary entry are
   DELETED rather than hidden — nothing renders it any more. */
const T = {
  "u.available": { en: "New version available", zh: "新版本可用", ar: "إصدار جديد متاح" },
  "u.refresh":  { en: "Update",      zh: "更新",       ar: "تحديث" },
  "u.updating": { en: "Updating…",   zh: "正在更新…",  ar: "جارٍ التحديث…" },
};

/* ── THE INSTALLED APP CANNOT HEAL WHILE HIDDEN ──
   onHide (below) reloads the moment the tab disappears: the work happens
   off-screen and the user comes back fresh. That is the right trade for every
   browser, and it is why nothing here auto-reloads in view.

   An installed iOS app never finishes that reload. The WebView is suspended
   the instant the app leaves the screen, so the navigation is killed
   mid-flight, and on resume iOS restores the very page it was already
   showing — including its stale stylesheet. The app can therefore sit on a
   bundle from weeks ago while Safari on the SAME phone is current. That is
   exactly what the owner hit: a header fix live in the browser and absent
   from the home-screen app, with prod verified as serving the new build.

   So standalone heals on the way IN. Once we know the build is stale and the
   app is on screen, reload. It costs a visible load — the reason no other
   surface does it — but never updating costs more, and on resume the user has
   just arrived, which is the cheapest moment there is to spend.

   ONE reload per build id, kept in sessionStorage: if a build somehow keeps
   reporting stale (an HTML the CDN is still serving from cache, a half-rolled
   deploy), the guard turns an infinite reload loop into a single wasted load. */
function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function healInstalledApp(id: string): void {
  if (!isInstalledApp()) return;
  if (document.visibilityState !== "visible") return;
  /* Never interrupt unsaved work — the same guard onHide and the exit
     prompts use. A stale bundle can wait for the next resume. */
  if (document.querySelector("[data-kx-unsaved='1']")) return;
  try {
    if (sessionStorage.getItem("kx-healed-build") === id) return;
    sessionStorage.setItem("kx-healed-build", id);
  } catch {
    /* Private mode / storage disabled: the loop guard is best-effort, but a
       reload that fixes the app is still better than an app frozen forever. */
  }
  window.location.reload();
}

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
          /* Read by AppLaunchLink: while stale, the next app launch becomes a
             FULL navigation so the user rides onto the new bundle mid-launch —
             no pill tap required. The ID matters as much as the flag: healing
             is done ONCE PER BUILD (see AppLaunchLink), because a stale tab's
             chunk URLs are already 404 and a soft navigation would bounce the
             user back to Home. */
          const g = globalThis as typeof globalThis & {
            __kxStaleBuild?: boolean;
            __kxStaleBuildId?: string;
          };
          g.__kxStaleBuild = true;
          g.__kxStaleBuildId = id;
          /* The pill is enough everywhere the hide-heal works. It is not
             enough in the installed app, which may never go hidden-and-back
             in a way iOS lets us use. */
          healInstalledApp(id);
        }
      } catch {
        /* offline / transient — ignore */
      }
    };
    /* NOT during the screen open. The build-id check is background work —
       nothing on screen waits for it — and on this link every concurrent
       request delays the ones that DO matter (measured: 10 calls at once on
       Product Data, the last landing at 4.08s). It runs once the page has
       gone quiet; a stale build stays stale for a couple more seconds, which
       is nothing against the interval this already runs on. */
    let firstCheck: number | undefined;
    /* Same correction as the presence beat: requestIdleCallback fired this
       at 815ms into a screen open, competing with the six data fetches it
       meant to yield to (main thread idle ≠ network idle). Measured on
       Product Data, 2026-08-21. */
    void whenNetworkQuiet({ quietMs: 700, maxWaitMs: 6000 }).then(() => {
      if (alive) void check();
    });
    /* HEAL WHILE HIDDEN. The user must never watch a full page load: the
       browser keeps the OLD page on screen until the new document commits,
       so a reload triggered mid-tap looks like "it threw me back to Home,
       showed loading, then went into the app" (owner, repeatedly). When the
       tab goes away we reload right then — the work happens off-screen and
       he comes back to a fresh bundle, so his next tap is a soft, instant
       navigation with nothing to heal. */
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      const g = globalThis as typeof globalThis & { __kxStaleBuild?: boolean };
      if (!g.__kxStaleBuild) return;
      /* Never interrupt unsaved work — the same guard the exit prompts use. */
      if (document.querySelector("[data-kx-unsaved='1']")) return;
      window.location.reload();
    };
    document.addEventListener("visibilitychange", onHide);
    /* THROTTLED, for the same reason the presence beat is: this fires on
       BOTH visibilitychange and focus, so switching between two windows can
       trigger it twice in a row, and a rapid flicker triggers it per flip.
       The build id cannot change faster than a deploy — 10s is generous. */
    let lastCheckAt = 0;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheckAt < 10_000) return;
      lastCheckAt = Date.now();
      void check();
    };
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
      document.removeEventListener("visibilitychange", onHide);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.clearInterval(iv);
      if (firstCheck !== undefined) window.clearTimeout(firstCheck);
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
    /* --kx-actionbar-h is published by MobileActionBar while it is on screen
       (0 when there is none, and on desktop where it is display:none), so the
       capsule clears the mobile tab bar instead of covering it — it was
       hiding Home / Create / Ops / Finance completely. */
    <div className="fixed inset-x-0 bottom-0 z-[400] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+var(--kx-actionbar-h,0px)+12px)] pointer-events-none">
      {/* Always-BLACK capsule with a slowly travelling Hub Blue glow on the
          border (owner call — both themes, both devices).

          MOBILE LAYOUT (owner screenshot: the copy was wrapping one word per
          line and the box grew tall): below 400px the capsule stacks — the
          lockup and title on the first row, the button full width beneath —
          and the reassurance line is dropped, because on a phone it costs
          three lines to say something the title already implies. Width is
          fixed (not max-w) so nothing can resize the surface. */}
      {/* No CSS border: .kx-update-capsule draws a masked, travelling ring in
          the same 1.5px band. A static border underneath would show through
          the dim part of the sweep as a second, competing edge. */}
      <div className="kx-update-capsule kx-sheet-in pointer-events-auto flex w-[min(94vw,28rem)] flex-col gap-3 rounded-2xl px-4 py-3 text-white max-[399px]:items-stretch min-[400px]:flex-row min-[400px]:items-center min-[400px]:gap-3.5 min-[400px]:pr-3">
        {/* Lockup pinned to the leading edge, message pushed to the trailing
            edge. They used to sit side by side with a 12px gap and the title
            read as jammed against the mark (owner, 2026-08-08: "not too close
            from koleex hub logo" → then "make the logo in the left and the
            text on right"). `flex-1` on the text block plus `text-end` opens
            the whole leftover row width between them; the 20px gap is only
            the floor for when the wide layout's sub-line eats that slack.
            Logical properties throughout, so Arabic mirrors it correctly. */}
        <div className="flex min-w-0 flex-1 items-center gap-5">
          {/* Owner call round 2: the FULL "KOLEEX hub" lockup, not the script
              mark alone. Capsule is always dark → for-dark variant, served
              through the image optimizer (256px, ~few KB) and SW-cached. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny optimized brand asset */}
          <img
            src="/_next/image?url=%2Fbrand%2Fhub-logo%2Fkoleex-hub-logo-for-dark.webp&w=256&q=75"
            alt=""
            aria-hidden
            className="h-[17px] w-auto shrink-0 opacity-80"
          />
          {/* ONE line of text. The reassurance sub-line is gone (owner,
              2026-08-09: "I don't want the text in two lines, I don't mean
              the title") — it was the second line, and inside a 448px
              capsule shared with the lockup and the button it also wrapped,
              so it cost two lines to say something the title implies.
              `truncate` keeps that true in every language. */}
          <div className="min-w-0 flex-1 truncate text-end text-[13.5px] font-semibold leading-tight">
            {t("u.available")}
          </div>
        </div>
        {/* Stable width: both labels occupy the SAME grid cell, so the button
            is always as wide as the longer one and pressing Update can't
            resize the capsule or re-wrap the text (owner report). Works in
            every language — no hardcoded px width. The idle label keeps the
            layout; only opacity swaps. */}
        <button
          type="button"
          onClick={onUpdate}
          disabled={updating}
          aria-busy={updating}
          aria-label={updating ? t("u.updating") : t("u.refresh")}
          className="grid h-9 w-full shrink-0 place-items-center rounded-full bg-white px-4 text-[12.5px] font-semibold text-[#0b0b0b] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FA9D6] disabled:opacity-60 disabled:pointer-events-none min-[400px]:w-auto"
        >
          <span className={`col-start-1 row-start-1 ${updating ? "invisible" : ""}`}>{t("u.refresh")}</span>
          <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${updating ? "" : "invisible"}`}>
            <SpinnerIcon size={12} />
            {t("u.updating")}
          </span>
        </button>
      </div>
    </div>
  );
}
