"use client";

/* ---------------------------------------------------------------------------
   AppLaunchZoom — the app BLOOMS out of the tile you pressed (owner ask,
   2026-08-21: "no motion when I enter an app — make a very creative motion
   and smooth ease").

   The iOS grammar, on Hub material: a card whose final geometry is the whole
   content area starts scaled down onto the EXACT tile the user touched
   (AppLaunchLink now ships the tile rect in the kx:app-launch detail), and
   expands with the Hub's expo-out curve while the app's own icon grows in
   its center. When the route commits, the card fades away over the freshly
   rendered app.

   THE BOUNCE-TO-HOME RULE APPLIES HERE TOO (AppLaunchSplash's hard lesson):
   this layer NEVER uncovers the page behind it mid-launch on its own timer.
   On a slow launch it holds fullscreen — and because it sits ABOVE the
   brand splash (z-95 vs z-90), a long wait simply hands off to the splash
   underneath when this card finally fades on route arrival. The 20s forward
   recovery stays the splash's job; this layer just follows the pathname.

   Material rules kept: NO backdrop-filter on an animated box (scale on a
   filtered element smears its frost — canon D), literal WAAPI keyframes
   (CSS custom properties inside @keyframes sample once — the Home flight
   lesson), transform/opacity only across the route boundary (the CLS-zero
   rule), reduced-motion skips straight to the splash behavior.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getApp } from "@/lib/navigation";

type LaunchDetail = {
  appId: string;
  route: string;
  fullPage?: boolean;
  rect?: { left: number; top: number; width: number; height: number };
};

const EXPAND_MS = 460;
const FADE_MS = 240;

export default function AppLaunchZoom() {
  const pathname = usePathname();
  const [launch, setLaunch] = useState<LaunchDetail | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const expandDoneAtRef = useRef(0);
  const fadingRef = useRef(false);

  useEffect(() => {
    const onLaunch = (e: Event) => {
      const d = (e as CustomEvent<LaunchDetail>).detail;
      if (!d?.appId || !d.route || !d.rect) return;
      if (d.fullPage) return; /* document loads are the splash's show */
      if (d.route.split(/[?#]/)[0] === window.location.pathname) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      fadingRef.current = false;
      setLaunch(d);
    };
    window.addEventListener("kx:app-launch", onLaunch);
    return () => window.removeEventListener("kx:app-launch", onLaunch);
  }, []);

  /* Play the bloom the moment the card exists. */
  useEffect(() => {
    if (!launch?.rect) return;
    const el = cardRef.current;
    if (!el) return;
    const final = el.getBoundingClientRect();
    if (final.width < 1 || final.height < 1) return;
    const r = launch.rect;
    const sx = Math.max(r.width / final.width, 0.01);
    const sy = Math.max(r.height / final.height, 0.01);
    const from = `translate(${r.left - final.left}px, ${r.top - final.top}px) scale(${sx}, ${sy})`;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { transform: from, opacity: 0.65 },
        { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1 },
      ],
      { duration: EXPAND_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
    );
    expandDoneAtRef.current = performance.now() + EXPAND_MS;
  }, [launch]);

  /* Route committed → fade the card over the new app, then unmount. The
     expand always finishes first (min hold), so a fast route reads as one
     continuous gesture instead of a cut. */
  useEffect(() => {
    if (!launch || fadingRef.current) return;
    if (launch.route.split(/[?#]/)[0] !== pathname) return;
    fadingRef.current = true;
    const el = cardRef.current;
    const wait = Math.max(0, expandDoneAtRef.current - performance.now()) + 60;
    const t = window.setTimeout(() => {
      if (!el) { setLaunch(null); return; }
      const anim = el.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: FADE_MS, easing: "ease-in", fill: "forwards" },
      );
      anim.onfinish = () => setLaunch(null);
      window.setTimeout(() => setLaunch(null), FADE_MS + 400); /* belt & braces */
    }, wait);
    return () => window.clearTimeout(t);
  }, [pathname, launch]);

  if (!launch) return null;
  const app = getApp(launch.appId);
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
