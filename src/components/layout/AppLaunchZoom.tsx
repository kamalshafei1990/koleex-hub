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
import { getApp } from "@/lib/navigation";

type Rect = { left: number; top: number; width: number; height: number };
type Flight = { mode: "launch"; appId: string; route: string; rect: Rect };

const EXPAND_MS = 460;
const FADE_MS = 240;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* (The tile-landing helper that lived here served return cuts one and two —
   both rejected. The exit no longer targets the tile, so the helper, the
   commit-time polling and the scroll hijack all went with it: Home returns
   at whatever scroll position the user left.) */
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

  /* RETURN FLIGHTS ARE GONE — deliberately, and this note is why. Three
     cover-card return cuts were authored and rejected; the root defect was
     architectural: this card is a branded panel, not the app's pixels, so
     any motion it makes reads as "a card crossed my screen". The sliding
     door the owner picked (#12) needs the REAL screen to move, which only
     the View Transitions API can do — see ViewTransitions.tsx
     ("home-return" flag) + the kx-door-* rules in globals. This component
     is forward-only now; do not re-add a return cover. */

  /* ── play the entry of whichever flight just started ── */
  useEffect(() => {
    if (!flight) return;
    const el = cardRef.current;
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    {
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
    }
  }, [flight]);

  /* ── settle when the destination commits ── */
  useEffect(() => {
    if (!flight || settlingRef.current) return;
    const el = cardRef.current;

    const clear = () => setFlight(null);

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
