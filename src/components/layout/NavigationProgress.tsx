"use client";

/* ---------------------------------------------------------------------------
   NavigationProgress — instant visual feedback for EVERY route change.

   Problem it solves: on high-latency links (mainland China → Vercel edge) a
   tap on any app produced NO visible response until the RSC payload + chunk
   arrived (1–3s), then the page "suddenly" appeared — the app felt dead.

   How it works (no deps, ~1 KB):
   · A capture-phase click listener spots activations of same-origin <a>
     links (no modifier keys, no target=_blank, not a download) and starts a
     thin indeterminate bar at the very top of the viewport — within the same
     frame as the tap.
   · The bar eases quickly to ~80% and crawls; when the pathname actually
     changes it snaps to 100% and fades. A 12s safety timeout clears it if a
     navigation dies (offline, aborted).
   · Same-route clicks (href === current path) never start the bar.

   Monochrome by design: the bar is the theme's inverted surface (white on
   dark, black on light) with a soft glow — functional, not decorative.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const SAFETY_MS = 12_000;

export default function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const safetyRef = useRef<number | null>(null);
  const startedForRef = useRef<string | null>(null);

  /* Start on any internal link activation (capture so we run even when the
     link's own onClick stops propagation later). */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/")) return; // internal only
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      const dest = href.split(/[?#]/)[0];
      if (dest === window.location.pathname) return; // same page — no bar
      startedForRef.current = dest;
      setFinishing(false);
      setActive(true);
      if (safetyRef.current) window.clearTimeout(safetyRef.current);
      safetyRef.current = window.setTimeout(() => {
        setActive(false);
        setFinishing(false);
      }, SAFETY_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  /* Route arrived → snap to 100% and fade out. */
  useEffect(() => {
    if (!active) return;
    setFinishing(true);
    if (safetyRef.current) window.clearTimeout(safetyRef.current);
    const t = window.setTimeout(() => {
      setActive(false);
      setFinishing(false);
    }, 260);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[300] h-[2.5px]"
    >
      <div
        className="h-full bg-[var(--bg-inverted)] shadow-[0_0_8px_var(--bg-inverted)]"
        style={{
          width: finishing ? "100%" : "80%",
          opacity: finishing ? 0 : 1,
          transition: finishing
            ? "width 180ms ease-out, opacity 240ms ease-out 60ms"
            : "width 1.8s cubic-bezier(0.15, 0.6, 0.3, 1)",
          transformOrigin: "left",
        }}
      />
    </div>
  );
}
