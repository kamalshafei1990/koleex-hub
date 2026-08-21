"use client";

/* ---------------------------------------------------------------------------
   AppLaunchZoom — the app BLOOMS out of the tile you pressed, and SHRINKS
   back into it when you leave (owner asks, 2026-08-21: "no motion when I
   enter an app — make a very creative motion and smooth ease", then "also
   when I press back in the app").

   FORWARD (launch): a card whose final geometry is the whole content area
   starts scaled down onto the EXACT tile the user touched (AppLaunchLink
   ships the tile rect in the kx:app-launch detail) and expands with the
   Hub's expo-out curve while the app's own icon grows in its center. When
   the route commits, the card fades away over the freshly rendered app.

   RETURN (back to Home): a capture-phase click listener spots a plain click
   on any link whose target is "/" while standing inside an app — that IS
   the back button, whichever component renders it. The card fades in over
   the app instantly, and once Home commits it finds this app's tile
   (data-app-tile on AppLaunchLink) and shrinks onto it, then fades. If the
   tile is missing or scrolled out of view, it simply fades — never a
   wrong-target flight.

   THE BOUNCE-TO-HOME RULE APPLIES TO THE FORWARD LEG (AppLaunchSplash's
   hard lesson): the launch card NEVER uncovers the page behind it on its
   own timer — it holds and hands off to the brand splash beneath (z-95 vs
   z-90). The RETURN leg is the opposite situation (it covers the page the
   user is LEAVING), so it does carry a safety timeout: if Home never
   commits, it fades out rather than trapping the user under a card.

   Material rules kept: NO backdrop-filter on an animated box (scale on a
   filtered element smears its frost — canon D), literal WAAPI keyframes
   (CSS custom properties inside @keyframes sample once — the Home flight
   lesson), transform/opacity only across the route boundary (the CLS-zero
   rule), reduced-motion skips everything.
   --------------------------------------------------------------------------- */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getApp, getActiveAppId } from "@/lib/navigation";

type Rect = { left: number; top: number; width: number; height: number };
type Flight =
  | { mode: "launch"; appId: string; route: string; rect: Rect }
  | { mode: "return"; appId: string };

const EXPAND_MS = 460;
const FADE_MS = 240;
const RETURN_IN_MS = 140;
const RETURN_SHRINK_MS = 500;
const RETURN_SAFETY_MS = 4000;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* The tile to land on: prefer the Home-grid card over the sidebar row for
   the same app — the grid tile is the one the user thinks of as "the app".

   Home's INTERNAL scroller does not restore on a back-navigation (measured:
   scrollTop 0 with the grid at y≈1672), so the tile is usually off-screen
   when we arrive. The iOS answer: bring the page to the tile UNDER the
   cover (the card is opaque and fullscreen, so the jump is invisible),
   then shrink onto it — "back" literally returns you to the app's place. */
function findTile(appId: string): DOMRect | null {
  const els = [...document.querySelectorAll<HTMLElement>(`[data-app-tile="${appId}"]`)];
  if (!els.length) return null;
  const scored = els
    .map((el) => ({ el, inChrome: !!el.closest("aside, nav"), r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0);
  if (!scored.length) return null;
  scored.sort((a, b) => Number(a.inChrome) - Number(b.inChrome) || b.r.width * b.r.height - a.r.width * a.r.height);
  const el = scored[0].el;
  let r = scored[0].r;
  const off = r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth;
  if (off) {
    try {
      el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
      r = el.getBoundingClientRect();
    } catch { /* keep the off-screen rect check below */ }
    if (r.bottom < 0 || r.top > window.innerHeight) return null;
  }
  return r;
}

export default function AppLaunchZoom() {
  const pathname = usePathname();
  const [flight, setFlight] = useState<Flight | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const expandDoneAtRef = useRef(0);
  const settlingRef = useRef(false);
  /* mirrors for listeners that outlive renders (synced in effects — the
     refs-during-render rule) */
  const flightRef = useRef<Flight | null>(null);
  useLayoutEffect(() => { flightRef.current = flight; }, [flight]);
  /* A short PATH LOG, not a single "previous" ref: on a browser-back Next
     handles popstate FIRST (registered at router boot, before this mount)
     and flushes the navigation synchronously — by the time our popstate
     listener runs, React has already committed "/" and a lone prev-ref has
     already been overwritten (measured: it read "/" on a real back from
     /quotations). The log keeps enough history that "where did we come
     from" survives: it is the newest entry that differs from where we are. */
  const pathLogRef = useRef<string[]>([]);
  useEffect(() => {
    const log = pathLogRef.current;
    if (log[log.length - 1] !== pathname) {
      log.push(pathname);
      if (log.length > 6) log.shift();
    }
  }, [pathname]);

  /* ── FORWARD: launched from a tile ── */
  useEffect(() => {
    const onLaunch = (e: Event) => {
      const d = (e as CustomEvent<{ appId: string; route: string; fullPage?: boolean; rect?: Rect }>).detail;
      if (!d?.appId || !d.route || !d.rect) return;
      if (d.fullPage) return; /* document loads are the splash's show */
      if (d.route.split(/[?#]/)[0] === window.location.pathname) return;
      if (reducedMotion()) return;
      settlingRef.current = false;
      setFlight({ mode: "launch", appId: d.appId, route: d.route, rect: d.rect });
    };
    window.addEventListener("kx:app-launch", onLaunch);
    return () => window.removeEventListener("kx:app-launch", onLaunch);
  }, []);

  /* ── RETURN — two detectors, one flight ──────────────────────────────────
     Owner (round 2): "the back motion doesn't work in all apps." Because
     the apps genuinely differ: PageHeader backs are <a href="/">, but e.g.
     SupplierDetail's Home is a <button onClick={router.push("/")}>, and the
     browser back gesture is a popstate — an anchor listener alone covers
     only the first family. So:

     1. The CLICK detector (kept): starts the cover at the CLICK, before the
        route even commits — the best-feeling path, for anchor backs.
     2. The HISTORY detector (the universal catch-all): pushState/replace
        are patched (popstate listened) and ANY same-document navigation
        landing on "/" while standing in an app starts the flight — buttons,
        router.back(), browser gestures, every app the same. It fires a beat
        later than the click (at commit), which is still before Home PAINTS
        (Home mounts its chunks late — measured on the shrink polling), so
        the cover is up before anything of Home shows. */
  const startReturnRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    startReturnRef.current = () => {
      if (reducedMotion()) return;
      if (flightRef.current) return; /* a flight is already on the wing */
      const appId = getActiveAppId(window.location.pathname);
      if (!appId) return;
      settlingRef.current = false;
      setFlight({ mode: "return", appId });
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      /* NOT gated on e.defaultPrevented: ViewTransitions registered its
         capture listener first, preventDefaults the click, and performs the
         router.push itself — the navigation still happens, so the flight is
         still right. If some other code prevents AND swallows the nav, the
         RETURN_SAFETY_MS timeout clears the card. */
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname !== "/") return;
      if (window.location.pathname === "/") return;
      startReturnRef.current();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    /* The history hook runs INSIDE the navigation call, so location.pathname
       is still the app route when we read it — exactly the "from" we need;
       the target comes from the pushState url argument. */
    const maybeReturn = (target: string | URL | null | undefined) => {
      try {
        const to = new URL(String(target ?? ""), window.location.href);
        if (to.origin !== window.location.origin) return;
        if (to.pathname !== "/") return;
        if (window.location.pathname === "/") return;
        startReturnRef.current();
      } catch { /* not a navigable url */ }
    };
    const hist = window.history;
    const origPush = hist.pushState.bind(hist);
    const origReplace = hist.replaceState.bind(hist);
    hist.pushState = function (data, unused, url) {
      maybeReturn(url);
      return origPush(data, unused, url);
    };
    hist.replaceState = function (data, unused, url) {
      maybeReturn(url);
      return origReplace(data, unused, url);
    };
    const onPop = () => {
      /* popstate fires AFTER Next already committed the new location — the
         "from" comes from the path log, not from a stale single ref. */
      if (window.location.pathname !== "/") return;
      /* the LAST transition only: depending on who ran first, the log's top
         is either already "/" (Next committed before us — the measured
         Chrome order) or still the app path. Anything older is history. */
      const log = pathLogRef.current;
      const top = log[log.length - 1];
      const from = top !== "/" ? top : log[log.length - 2];
      if (!from || from === "/") return;
      const appId = getActiveAppId(from);
      if (!appId || reducedMotion() || flightRef.current) return;
      settlingRef.current = false;
      setFlight({ mode: "return", appId });
    };
    window.addEventListener("popstate", onPop);
    return () => {
      hist.pushState = origPush;
      hist.replaceState = origReplace;
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  /* ── play the entry of whichever flight just started ── */
  useEffect(() => {
    if (!flight) return;
    const el = cardRef.current;
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    if (flight.mode === "launch") {
      const final = el.getBoundingClientRect();
      if (final.width < 1 || final.height < 1) return;
      const r = flight.rect;
      const sx = Math.max(r.width / final.width, 0.01);
      const sy = Math.max(r.height / final.height, 0.01);
      el.animate(
        [
          { transform: `translate(${r.left - final.left}px, ${r.top - final.top}px) scale(${sx}, ${sy})`, opacity: 0.65 },
          { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1 },
        ],
        { duration: EXPAND_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
      );
      expandDoneAtRef.current = performance.now() + EXPAND_MS;
    } else {
      /* cover the app the user is leaving — instant but soft */
      el.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: RETURN_IN_MS, easing: "ease-out", fill: "both" },
      );
      expandDoneAtRef.current = performance.now() + RETURN_IN_MS;
    }
  }, [flight]);

  /* ── settle when the destination commits ── */
  useEffect(() => {
    if (!flight || settlingRef.current) return;
    const el = cardRef.current;

    const clear = () => setFlight(null);

    if (flight.mode === "launch") {
      if (flight.route.split(/[?#]/)[0] !== pathname) return;
      settlingRef.current = true;
      const wait = Math.max(0, expandDoneAtRef.current - performance.now()) + 60;
      const t = window.setTimeout(() => {
        if (!el) { clear(); return; }
        const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease-in", fill: "forwards" });
        anim.onfinish = clear;
        window.setTimeout(clear, FADE_MS + 400); /* belt & braces */
      }, wait);
      return () => window.clearTimeout(t);
    }

    /* return leg */
    if (pathname !== "/") {
      /* Home hasn't committed — safety: never trap the user under the card */
      const t = window.setTimeout(clear, RETURN_SAFETY_MS);
      return () => window.clearTimeout(t);
    }
    settlingRef.current = true;
    /* Home commits before it finishes PAINTING — the dashboard section is a
       dynamic chunk and the grid mounts a beat later, so a one-shot measure
       right after commit misses a tile that is genuinely on screen (measured:
       the quotations tile sits at y=598 once Home settles, but two rAFs
       after commit findTile still came back empty). Poll each frame for up
       to ~450ms; shrink onto the tile the moment it exists, fade if it
       never does. */
    const deadline = performance.now() + 900;
    let raf = 0;
    const fadeOut = () => {
      if (!el) { clear(); return; }
      const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease-in", fill: "forwards" });
      anim.onfinish = clear;
      window.setTimeout(clear, FADE_MS + 400);
    };
    const tryShrink = () => {
      if (!el) { clear(); return; }
      const tile = findTile(flight.appId);
      if (!tile) {
        if (performance.now() < deadline) { raf = window.requestAnimationFrame(tryShrink); return; }
        fadeOut();
        return;
      }
      const final = el.getBoundingClientRect();
      if (final.width < 1) { fadeOut(); return; }
      const sx = Math.max(tile.width / final.width, 0.01);
      const sy = Math.max(tile.height / final.height, 0.01);
      /* THE RETURN, RE-CUT (owner: "the motion when I back from app to home
         is not good — create a good smooth ease creative motion"). Three
         defects in the first cut, each fixed by one move below:

         · The card faded to 0.15 WHILE flying, so mid-flight you watched
           Home through a ghost rectangle — mushy. Now it stays OPAQUE for
           the first ~7/10 of the flight and dissolves only as it lands on
           the tile, so the flight reads as a solid object, not a curtain.
         · scale(sx, sy) is anisotropic — the icon and radius squashed with
           the card. The icon now counter-scales (s/sx, s/sy — net uniform
           min-scale) so it stays perfectly square all the way down, and the
           border-radius grows by 1/s so the VISUAL corner rounding holds
           instead of sharpening to a point. The label can't counter-scale
           legibly at these ratios, so it exits first (120ms).
         · Home sat frozen underneath. It now breathes IN under the shrink —
           scale 0.97→1 + dim→full, expo-out. INWARD on purpose: a 1.0x+
           zoom-out would push content past the container edges and flash a
           horizontal scrollbar, which is the owner's absolute no-dancing
           rule; growing INTO place can never overflow.

         iOS-sheet curve (0.32, 0.72, 0, 1): brisk exit from fullscreen,
         long glide onto the tile. Transform/opacity (+radius on this one
         compositor-promoted card) only — nothing here can shift layout. */
      const s = Math.min(sx, sy);
      const anim = el.animate(
        [
          { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1, borderRadius: "22px" },
          { opacity: 1, offset: 0.68 },
          { transform: `translate(${tile.left - final.left}px, ${tile.top - final.top}px) scale(${sx}, ${sy})`, opacity: 0, borderRadius: `${Math.round(18 / s)}px` },
        ],
        { duration: RETURN_SHRINK_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
      );
      el.querySelector<HTMLElement>("[data-kx-flight-icon]")?.animate(
        [
          { transform: "scale(1, 1)" },
          { transform: `scale(${s / sx}, ${s / sy})` },
        ],
        { duration: RETURN_SHRINK_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
      );
      el.querySelector<HTMLElement>("[data-kx-flight-label]")?.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 120, easing: "ease-out", fill: "forwards" },
      );
      document.querySelector<HTMLElement>("[data-kx-home-stage]")?.animate(
        [
          { transform: "scale(0.97)", opacity: 0.55 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: RETURN_SHRINK_MS + 80, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
      anim.onfinish = () => {
        /* Something (Next's own popstate scroll handling) can re-zero the
           internal scroller behind the card mid-flight — settle the page ON
           the tile one last time so the reveal matches where we landed. */
        try {
          const tileEl = document.querySelector<HTMLElement>(`[data-app-tile="${flight.appId}"]:not(aside *):not(nav *)`);
          tileEl?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
          /* The tile RECEIVES its app: one soft pulse the instant the card
             dissolves onto it. One-shot WAAPI, transform only, no residue. */
          tileEl?.animate(
            [
              { transform: "scale(1)" },
              { transform: "scale(1.06)", offset: 0.4 },
              { transform: "scale(1)" },
            ],
            { duration: 220, easing: "ease-out" },
          );
        } catch { /* fine */ }
        clear();
      };
      window.setTimeout(clear, RETURN_SHRINK_MS + 400); /* belt & braces */
    };
    raf = window.requestAnimationFrame(tryShrink);
    return () => window.cancelAnimationFrame(raf);
  }, [pathname, flight]);

  if (!flight) return null;
  const app = getApp(flight.appId);
  const Icon = app?.icon;

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 bottom-0 z-[95] pointer-events-none"
      style={{ top: "var(--kx-header-h, 3.5rem)" }}
    >
      <div
        ref={cardRef}
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[22px] border border-white/[0.07]"
        style={{
          transformOrigin: "0 0",
          background:
            "radial-gradient(120% 85% at 50% -20%, rgba(215,225,238,0.06), transparent 55%)," +
            "radial-gradient(130% 75% at 50% 120%, rgba(86,127,178,0.16), transparent 65%)," +
            "var(--bg-primary, #0a0a0a)",
        }}
      >
        {Icon && (
          <span
            data-kx-flight-icon=""
            className="inline-flex items-center justify-center"
            style={{ filter: "drop-shadow(0 0 18px rgba(127,169,214,0.45))", color: "rgba(226,238,250,0.95)" }}
          >
            <Icon size={56} />
          </span>
        )}
        <span data-kx-flight-label="" className="text-[13px] tracking-[0.14em] uppercase" style={{ color: "rgba(226,238,250,0.55)" }}>
          {app?.name ?? ""}
        </span>
      </div>
    </div>
  );
}
