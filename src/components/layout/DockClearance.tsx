"use client";

/* ── DockClearance — room at the end of every app for the floating dock ──
   The AI · Discuss pill (bottom-end, FloatingPanel) and the report button
   above it (bottom 5.75rem, ReportIssueButton) float over every app, so the
   last row of a list — and the buttons on it — sat under them with no way to
   scroll it clear (owner, 26/09: "fix it in all the other apps too").

   One place instead of 270 pages: after each route change, and whenever the
   page's content changes, this finds the page's own scroller(s) — the shell's
   #main-scroll-container, or an app's inner `overflow-y-auto` pane — that
   actually scroll, run to the bottom of the screen and sit under the dock's
   side, and marks them .kx-dock-pad (globals.css adds the bottom room).
   Nothing else about the page changes; a pane that does not scroll, a side
   list away from the dock, and anything inside a dialog are left alone.

   Not on /ai or /discuss: their scrollers are conversations pinned to a
   composer, and the dock is lifted above that composer (or hidden) there. */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PAD = "kx-dock-pad";
/* The dock's footprint from the end edge: the pill is ~175px wide at end-6. */
const DOCK_ZONE = 320;
/* .kx-dock-pad's padding-bottom (8rem) — kept in step with globals.css. */
const PAD_PX = 128;

function isComposerRoute(p: string) {
  return p === "/ai" || p.startsWith("/ai/") || p === "/discuss" || p.startsWith("/discuss/");
}

function scan(pathname: string) {
  const main = document.getElementById("main-scroll-container");
  if (!main) return;
  /* Decide first, then change only what differs. Stripping every mark and
     re-measuring would shrink a scroller for a moment, and a reader sitting
     at the very bottom would be clamped up by the pad on every rescan. */
  const want = new Set<HTMLElement>();

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rtl = document.documentElement.dir === "rtl";
  const candidates: HTMLElement[] = [
    main,
    ...main.querySelectorAll<HTMLElement>('[class*="overflow-y-auto"], [class*="overflow-auto"], [class*="overflow-y-scroll"]'),
  ];
  for (const el of isComposerRoute(pathname) ? [] : candidates) {
    if (el !== main && el.closest('[role="dialog"], [aria-modal="true"]')) continue;
    /* A marked scroller's height already includes the pad — judge the
       content without it. */
    const own = el.scrollHeight - (el.classList.contains(PAD) ? PAD_PX : 0);
    if (own <= el.clientHeight + 1) continue;
    if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < vh * 0.4 || r.bottom < vh - 120) continue;
    if (rtl ? r.left > DOCK_ZONE : r.right < vw - DOCK_ZONE) continue;
    want.add(el);
  }
  for (const el of [main, ...main.querySelectorAll<HTMLElement>(`.${PAD}`)]) {
    if (el.classList.contains(PAD) && !want.has(el)) el.classList.remove(PAD);
  }
  want.forEach((el) => el.classList.add(PAD));
}

export default function DockClearance() {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    let timer: number | undefined;
    const schedule = (ms = 250) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => scan(pathname), ms);
    };
    /* The route paints, then its data lands — look again after both. */
    schedule(60);
    const late = window.setTimeout(() => scan(pathname), 1500);

    const main = document.getElementById("main-scroll-container");
    /* Lists that load, groups that open, tabs that switch: childList only,
       debounced, so typing and animations do not rescan on every frame. */
    const mo = main ? new MutationObserver(() => schedule()) : null;
    if (main && mo) mo.observe(main, { childList: true, subtree: true });
    const onResize = () => schedule();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(late);
      mo?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [pathname]);

  return null;
}
