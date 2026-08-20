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

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getApp, getActiveAppId } from "@/lib/navigation";

type Rect = { left: number; top: number; width: number; height: number };
type Flight =
  | { mode: "launch"; appId: string; route: string; rect: Rect }
  | { mode: "return"; appId: string };

const EXPAND_MS = 460;
const FADE_MS = 240;
const RETURN_IN_MS = 140;
const RETURN_SHRINK_MS = 440;
const RETURN_SAFETY_MS = 4000;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* The tile to land on: prefer the Home-grid card over the sidebar row for
   the same app — the grid tile is the one the user thinks of as "the app". */
function findTile(appId: string): DOMRect | null {
  const els = [...document.querySelectorAll<HTMLElement>(`[data-app-tile="${appId}"]`)];
  if (!els.length) return null;
  const scored = els
    .map((el) => ({ el, inChrome: !!el.closest("aside, nav"), r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0);
  if (!scored.length) return null;
  scored.sort((a, b) => Number(a.inChrome) - Number(b.inChrome) || b.r.width * b.r.height - a.r.width * a.r.height);
  const r = scored[0].r;
  /* Off-screen tile → a flight there reads as the card escaping the page. */
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return null;
  return r;
}

export default function AppLaunchZoom() {
  const pathname = usePathname();
  const [flight, setFlight] = useState<Flight | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const expandDoneAtRef = useRef(0);
  const settlingRef = useRef(false);

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

  /* ── RETURN: any plain click on a link to "/" while inside an app.
     Same guards as ViewTransitions — anything the user might mean
     differently (new tab, modifier, download, hash) is left alone. ── */
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
      if (reducedMotion()) return;
      const appId = getActiveAppId(window.location.pathname);
      if (!appId) return;
      settlingRef.current = false;
      setFlight({ mode: "return", appId });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
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
    const deadline = performance.now() + 450;
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
      const anim = el.animate(
        [
          { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1 },
          { transform: `translate(${tile.left - final.left}px, ${tile.top - final.top}px) scale(${sx}, ${sy})`, opacity: 0.15 },
        ],
        { duration: RETURN_SHRINK_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
      );
      anim.onfinish = clear;
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
            className="inline-flex items-center justify-center"
            style={{ filter: "drop-shadow(0 0 18px rgba(127,169,214,0.45))", color: "rgba(226,238,250,0.95)" }}
          >
            <Icon size={56} />
          </span>
        )}
        <span className="text-[13px] tracking-[0.14em] uppercase" style={{ color: "rgba(226,238,250,0.55)" }}>
          {app?.name ?? ""}
        </span>
      </div>
    </div>
  );
}
