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

import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 320;

/* Resolve the element that ACTUALLY scrolls. The Koleex shell does NOT scroll
   on window — RootShell renders content inside `.shell-content-offset` which
   is `overflow-auto` inside a `100vh overflow-hidden` shell. So window.scrollY
   is always 0 and a window-scroll listener never fires (this is exactly why
   the earlier version of this button never appeared — issue 46dba6b3 reopen).
   We prefer the in-shell scroller, then any large scrollable ancestor, then
   fall back to the document scrolling element for pages outside the shell. */
function resolveScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const shell = document.querySelector<HTMLElement>(".shell-content-offset");
  if (shell && shell.scrollHeight > shell.clientHeight + 4) return shell;
  // Fallback: the document scroller (pages rendered outside RootShell).
  const docEl = (document.scrollingElement as HTMLElement) || document.documentElement;
  return docEl;
}

export default function ScrollToEdges() {
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);
  const scrollerRef = useRef<HTMLElement | null>(null);

  const recompute = useCallback(() => {
    if (typeof window === "undefined") return;
    const el = scrollerRef.current ?? resolveScroller();
    scrollerRef.current = el;
    if (!el) return;
    const scrollTop = el.scrollTop || 0;
    const viewport = el.clientHeight || 0;
    const full = el.scrollHeight || 0;
    const distanceToBottom = full - (scrollTop + viewport);
    setCanUp(scrollTop > THRESHOLD);
    setCanDown(distanceToBottom > THRESHOLD);
  }, []);

  useEffect(() => {
    const el = resolveScroller();
    scrollerRef.current = el;
    recompute();
    const onScroll = () => recompute();
    const onResize = () => recompute();
    // Listen on the real scroller for scroll; window for resize. Also keep a
    // window scroll listener as a belt-and-suspenders for the fallback case.
    el?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // Re-evaluate when content height changes (lazy lists, image loads,
    // route changes that swap the inner content).
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (ro && el) ro.observe(el);
    return () => {
      el?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
    };
  }, [recompute]);

  if (!canUp && !canDown) return null;

  const scrollTo = (y: number) => {
    const el = scrollerRef.current ?? resolveScroller();
    if (!el) return;
    try { el.scrollTo({ top: y, behavior: "smooth" }); } catch { el.scrollTop = y; }
  };

  return (
    <div
      data-qa-capture-skip=""
      data-kx-component="Scroll edges"
      data-kx-module="Global"
      /* Positioned on the START corner (bottom-left in LTR, bottom-right in RTL)
         so it never sits on top of the assistant/discuss FAB, which lives on the
         END corner at bottom-6 end-6 (FloatingPanel). Issue 46dba6b3 reopen:
         the scroll button was covering the smart-assistant + discussion FAB. */
      className="fixed bottom-6 start-6 z-[120] flex flex-col gap-2 print:hidden"
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
          onClick={() => scrollTo((scrollerRef.current ?? resolveScroller())?.scrollHeight ?? 0)}
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
