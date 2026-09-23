"use client";

/* ---------------------------------------------------------------------------
   UpdateWatcher — notices a new deployment and OFFERS it: a "New version
   available · Update" capsule, and the tab moves onto the new build when the
   user presses Update.

   THE USER PRESSES UPDATE (owner, 2026-09-23: "I want to show the update
   message and I press update to know that there is update happened"). This
   used to move the tab by itself, three silent ways: a reload the moment the
   tab went hidden, the installed app reloading itself on sight, and the next
   app launch turned into a full navigation. The owner never saw an update
   arrive — the dock app just changed under him. The first two are gone; the
   capsule waits, in the browser and in the installed app alike, until it is
   pressed.

   The third stays, and it is not a preference: a stale tab's chunk URLs are
   already gone from the new deployment, so a soft navigation into another app
   would fail and bounce to Home. AppLaunchLink turns that one launch into a
   full navigation, and the "Updated to the latest version" confirmation
   below says so when it lands.

   It polls a tiny no-store /api/version (the deploy's build id) once the page
   has gone quiet, whenever the tab/app becomes visible again, and every 60s
   while visible. Once the tab has landed on the new build — by the button or
   by that launch — a one-line "Updated to the latest version" capsule confirms
   it, once, and goes away.
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
  "u.updated":  { en: "Updated to the latest version", zh: "已更新到最新版本", ar: "تم التحديث إلى أحدث إصدار" },
};

/* NEVER MID-CALL. A voice call is WebRTC held by the page; a reload ends it
   and drops the caller into the text chat with no explanation — which is
   exactly what the owner met, twice, on the evening several builds shipped
   while he was talking. Unsaved work and a live call are the same kind of
   thing: a reason a stale bundle can wait. The call screen marks itself.
   Read by AppLaunchLink (the one launch that still moves a stale tab); the
   capsule itself stays off the call screen (globals.css, .kx-update-offer). */
export function busyWithSomethingUninterruptible(): boolean {
  return Boolean(document.querySelector("[data-kx-unsaved='1'], [data-kx-call-active='1']"));
}

/* ARRIVAL CONFIRMATION. The moment a check finds the tab stale it writes
   {from, to} to sessionStorage — BEFORE anything moves the tab, so every
   path onto the new build (hidden reload, full-navigation launch, the
   installed app's self-reload, the Update button, a manual refresh) carries
   the same note across. The next boot reads it: a build id that is no longer
   `from` means the move landed → confirm once and drop the note. The same
   id as `from` means the reload came back on the old bundle (a CDN still
   serving stale HTML) → keep the note, say nothing; check() will flag the
   tab stale again. sessionStorage, not localStorage: the note belongs to
   the tab that was moved, and a second tab that was never stale has nothing
   to confirm. Pure, so the rule is testable. */
const UPDATE_KEY = "kx-update-pending";
const ARRIVAL_SHOW_MS = 6000;
export function updateMarker(from: string, to: string): string {
  return JSON.stringify({ f: from, t: to });
}
export function arrivalFromMarker(raw: string | null, here: string): { from: string; to: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { f?: unknown; t?: unknown };
    if (typeof v?.f !== "string" || typeof v?.t !== "string") return null;
    if (v.f === here) return null;
    return { from: v.f, to: v.t };
  } catch {
    return null;
  }
}

export default function UpdateWatcher() {
  const { t } = useTranslation(T);
  const boot = useRef<string | null>(null);
  const [stale, setStale] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [arrived, setArrived] = useState<{ from: string; to: string; here: string } | null>(null);

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
          try {
            sessionStorage.setItem(UPDATE_KEY, updateMarker(boot.current, id));
          } catch {
            /* private mode / storage disabled: the move still happens, it is
               just not confirmed afterwards */
          }
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
          /* And that is all: the capsule offers the update; nothing here
             reloads the tab. The user presses Update (see the header). */
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
      if (!alive) return;
      /* Did this boot land a move? Confirmed here, on the first quiet moment
         of the NEW build, never during its screen open. */
      try {
        const here = boot.current ?? "";
        const a = arrivalFromMarker(sessionStorage.getItem(UPDATE_KEY), here);
        if (a) {
          sessionStorage.removeItem(UPDATE_KEY);
          setArrived({ ...a, here });
        }
      } catch {
        /* storage unavailable: nothing to confirm */
      }
      void check();
    });
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
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.clearInterval(iv);
      if (firstCheck !== undefined) window.clearTimeout(firstCheck);
    };
  }, []);

  /* The confirmation leaves on its own after six seconds ON SCREEN. A tab
     healed while hidden may stay hidden for an hour; the clock starts when
     the user is actually looking, so he never comes back to nothing. */
  useEffect(() => {
    if (!arrived) return;
    let timer: number | undefined;
    const arm = () => {
      if (document.visibilityState !== "visible" || timer !== undefined) return;
      timer = window.setTimeout(() => setArrived(null), ARRIVAL_SHOW_MS);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      document.removeEventListener("visibilitychange", arm);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [arrived]);

  if (!stale && !arrived) return null;

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

  /* ONE shell for both messages — the offer ("New version available ·
     Update") and the confirmation ("Updated to the latest version"). The
     first draft rendered the confirmation as a second copy of the container,
     lockup and capsule strings; that copy cost ~1 KB in the client bundle
     every route shares and pushed documents / projects / suppliers 1 KB over
     their budgets. The guard said find what was added, so it was removed.
     While stale, the markup below is byte-for-byte the capsule the owner
     calibrated. The confirmation only drops the button, takes role="status",
     the build's short id in the tooltip (for whoever pushed it; nobody else
     needs it on screen) and a tap to dismiss, and below 400px a tighter gap
     and side padding: "Updated to the latest version" needs 188px beside the
     109px lockup — measured at 375 it cut to "latest v…"; after, 198px are
     free at 375 and 193 at 360. Same 13.5px type on every width: globals.css
     rewrites every `.text-[Npx]` through --kx-font-scale with a later rule,
     so no breakpoint variant of font-size lands in either direction (probed
     both ways). */
  const confirming = !stale;
  return (
    /* --kx-actionbar-h is published by MobileActionBar while it is on screen
       (0 when there is none, and on desktop where it is display:none), so the
       capsule clears the mobile tab bar instead of covering it — it was
       hiding Home / Create / Ops / Finance completely. */
    <div className={`fixed inset-x-0 bottom-0 z-[400] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+var(--kx-actionbar-h,0px)+12px)] pointer-events-none ${confirming ? "" : "kx-update-offer"}`}>
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
      <div
        role={confirming ? "status" : undefined}
        aria-live={confirming ? "polite" : undefined}
        title={confirming && arrived?.here ? arrived.here.slice(0, 7) : undefined}
        onClick={confirming ? () => setArrived(null) : undefined}
        className={`kx-update-capsule kx-sheet-in pointer-events-auto flex w-[min(94vw,28rem)] flex-col gap-3 rounded-2xl px-4 py-3 text-white max-[399px]:items-stretch min-[400px]:flex-row min-[400px]:items-center min-[400px]:gap-3.5 ${confirming ? "max-[399px]:px-3" : "min-[400px]:pr-3"}`}
      >
        {/* Lockup pinned to the leading edge, message pushed to the trailing
            edge. They used to sit side by side with a 12px gap and the title
            read as jammed against the mark (owner, 2026-08-08: "not too close
            from koleex hub logo" → then "make the logo in the left and the
            text on right"). `flex-1` on the text block plus `text-end` opens
            the whole leftover row width between them; the 20px gap is only
            the floor for when the wide layout's sub-line eats that slack.
            Logical properties throughout, so Arabic mirrors it correctly. */}
        <div className={`flex min-w-0 flex-1 items-center gap-5 ${confirming ? "max-[399px]:gap-3" : ""}`}>
          {/* Owner call round 2: the FULL "KOLEEX hub" lockup, not the script
              mark alone. Capsule is always dark → for-dark variant, served
              through the image optimizer (256px, ~few KB) and SW-cached. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny optimized brand asset */}
          <img
            src="/_next/image?url=%2Fbrand%2Fhub-logo%2Fkoleex-hub-logo-for-dark.webp&w=256&q=75"
            alt=""
            aria-hidden
            className="h-[13px] w-auto shrink-0 opacity-80"
          />
          {/* ONE line of text. The reassurance sub-line is gone (owner,
              2026-08-09: "I don't want the text in two lines, I don't mean
              the title") — it was the second line, and inside a 448px
              capsule shared with the lockup and the button it also wrapped,
              so it cost two lines to say something the title implies.
              `truncate` keeps that true in every language. */}
          <div className="min-w-0 flex-1 truncate text-end text-[13.5px] font-semibold leading-tight">
            {t(confirming ? "u.updated" : "u.available")}
          </div>
        </div>
        {/* Stable width: both labels occupy the SAME grid cell, so the button
            is always as wide as the longer one and pressing Update can't
            resize the capsule or re-wrap the text (owner report). Works in
            every language — no hardcoded px width. The idle label keeps the
            layout; only opacity swaps. */}
        {stale && (
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
        )}
      </div>
    </div>
  );
}
