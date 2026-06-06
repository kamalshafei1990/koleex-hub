"use client";

/* ---------------------------------------------------------------------------
   ScrollToEdges

   A small floating control that lets the user jump directly to the top or
   bottom of the current page. Issue 46dba6b3 (Mustafa) — on long data-heavy
   pages there was no quick way to return to the top, and no way to skip to
   the footer / load-more region at the bottom.

   Behaviour
   ─────────
   • Only visible when the viewport is meaningfully scrolled (>320px below
     the top OR more than 320px above the bottom). Stays out of the way
     otherwise so it doesn't pollute short pages.
   • Two stacked buttons: ↑ scrolls to the very top, ↓ to the very bottom.
     Either is omitted if it's already at that edge.
   • Brand-monochrome: bg-inverted button surface, text-inverted glyph,
     subtle ring. No coloured accents.
   • Carries data-qa-capture-skip and data-kx-component so it never
     pollutes screenshots taken for QA reports, and the inspector shows
     "Scroll to top/bottom" instead of the generic fallback.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";

const THRESHOLD = 320;

export default function ScrollToEdges() {
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const recompute = useCallback(() => {
    if (typeof window === "undefined") return;
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const viewport = window.innerHeight || doc.clientHeight || 0;
    const full = Math.max(doc.scrollHeight, doc.offsetHeight);
    const distanceToBottom = full - (scrollTop + viewport);
    setCanUp(scrollTop > THRESHOLD);
    setCanDown(distanceToBottom > THRESHOLD);
  }, []);

  useEffect(() => {
    recompute();
    const onScroll = () => recompute();
    const onResize = () => recompute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // Re-evaluate when the body's height changes (lazy lists, image loads).
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (ro && document.body) ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
    };
  }, [recompute]);

  if (!canUp && !canDown) return null;

  const scrollTo = (y: number) => {
    try { window.scrollTo({ top: y, behavior: "smooth" }); } catch { window.scrollTo(0, y); }
  };

  return (
    <div
      data-qa-capture-skip=""
      data-kx-component="Scroll edges"
      data-kx-module="Global"
      className="fixed bottom-6 end-6 z-[120] flex flex-col gap-2 print:hidden"
      role="group"
      aria-label="Page navigation"
    >
      {canUp && (
        <button
          type="button"
          onClick={() => scrollTo(0)}
          title="Scroll to top"
          aria-label="Scroll to top"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-lg backdrop-blur-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 14l7-7 7 7" />
          </svg>
        </button>
      )}
      {canDown && (
        <button
          type="button"
          onClick={() => scrollTo(document.documentElement.scrollHeight)}
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-inverted)] text-[var(--text-inverted)] shadow-lg backdrop-blur-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 10l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
