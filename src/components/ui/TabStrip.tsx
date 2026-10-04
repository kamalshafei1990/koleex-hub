"use client";

/* ---------------------------------------------------------------------------
   TabStrip — the ONE canonical tab bar for the whole system.

   Style: pill buttons inside a bordered, rounded "shell" (the Product Data
   form's tab grammar). CORE: active pill = filled inverted, byte-identical
   to the original. AURORA: the selected state is ONE Hub-Blue outlined pill
   that SLIDES between tabs (the dock/language-bar mechanic) — measured, not
   fixed-width, because tab labels vary; buttons themselves only speak in
   text colour. Horizontally scrollable, scrollbar hidden.

   Use this everywhere instead of bespoke tab markup so every tab in every
   app looks and behaves the same. Pair the swapped content with the
   `kx-tab-in` class (keyed on the active value) for the smooth entrance.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useSkin } from "@/lib/appearance";

export interface TabStripItem {
  /** Stable identity — also used as the React key. */
  key: string;
  label: ReactNode;
  /** Optional leading icon (already-sized node). */
  icon?: ReactNode;
  /** Route-driven tab → renders a <Link>. */
  href?: string;
  /** State-driven tab → renders a <button>. */
  onClick?: () => void;
  /** Is this the active tab? */
  active?: boolean;
  /** Optional trailing count/badge. */
  badge?: ReactNode;
  disabled?: boolean;
}

/* kx-glass: the strip is a real glass surface, not a flat panel (owner, on
   the Divisions bar: "this tab bar make it's background with glass effect").
   The class evaluates to nothing under Core, so this is Aurora-only. */
/* Two shapes, because the Hub genuinely has two and pretending otherwise would
   mean restyling shipped screens to adopt this component:

     "rounded"  app-level tabs — rounded-xl shell, rounded-lg tabs. The default.
     "pill"     fully-round, the shape the employee and customer DETAIL forms
                already use for their section tabs.

   The shape is a prop rather than a fork so both stay one implementation. If
   the two should collapse into one, that is a design call to make once, here,
   and every caller follows. */
export type TabStripShape = "rounded" | "pill";

const shellCls = (pill: boolean, glass: boolean) =>
  `${glass ? "kx-glass " : ""}relative flex items-center gap-1 overflow-x-auto ${pill ? "rounded-full" : "rounded-xl"} border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`;

function tabClass(active: boolean, aurora: boolean, pill: boolean): string {
  const base =
    `relative shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap ${pill ? "rounded-full" : "rounded-lg"} px-3 py-1.5 max-sm:py-2 text-[12.5px] font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] `;
  if (aurora) {
    /* The sliding pill carries the selected state; buttons only speak in
       text colour (the header language bar's rule). */
    return base + (active
      ? "text-[var(--text-primary)]"
      : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]");
  }
  return base + (active
    ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
    : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]");
}

export default function TabStrip({
  items,
  className = "",
  ariaLabel,
  shape = "rounded",
  glass = true,
}: {
  items: TabStripItem[];
  className?: string;
  ariaLabel?: string;
  shape?: TabStripShape;
  /** Set FALSE when the strip sits inside a surface that already frosts — a
   *  `kx-bar-host` / `kx-glass-bar` pane, say. The strip is a glass surface by
   *  default, and two blurred layers at the same edge is the "ONE edge blur,
   *  not three" mistake. This prop is that rule, made sayable. */
  glass?: boolean;
}) {
  const pill = shape === "pill";
  const aurora = useSkin() === "aurora";
  const listRef = useRef<HTMLDivElement | null>(null);
  /* Measured geometry of the active tab, in the scroll-content's own
     coordinates (offsetLeft scrolls WITH the tabs, so the pill stays glued
     under its tab while the strip scrolls). null until first measurement —
     the pill renders invisible rather than in a wrong place. */
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const activeKey = items.find((it) => it.active)?.key ?? null;

  useLayoutEffect(() => {
    if (!aurora) return;
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const el = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
      else setInd(null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [aurora, activeKey, items.length]);

  /* THE SELECTED TAB HAS TO BE ON SCREEN. The strip scrolls horizontally and
     never scrolled itself: with twelve sections in 932px, choosing Review
     moved the selection pill to x=995 — 149px past the right edge — so the
     content changed while every tab still on screen looked unselected. The
     tab you just picked is the one thing that must be visible.

     `scrollIntoView` was the obvious call and is NOT the one used, because it
     also walks every scrollable ancestor — here the whole app shell — and it
     was measured doing nothing at all in RTL. This computes the one number the
     strip needs and sets it, so nothing outside the strip moves. */
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const bring = (smooth: boolean) => {
      const el = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!el) return;
      const max = list.scrollWidth - list.clientWidth;
      if (max <= 1) return;
      /* RTL scrollLeft runs 0 (at the right-hand start) down to -max, so every
         reading and every write is normalised through `fromLeft` — the plain
         "how far from the physical left edge" number the maths wants. */
      const rtl = getComputedStyle(list).direction === "rtl";
      const from = rtl ? max + list.scrollLeft : list.scrollLeft;
      const pad = 12;                                   // a sliver of the neighbour, so it reads as scrollable
      let want = from;
      if (el.offsetLeft - pad < from) want = el.offsetLeft - pad;
      else if (el.offsetLeft + el.offsetWidth + pad > from + list.clientWidth)
        want = el.offsetLeft + el.offsetWidth + pad - list.clientWidth;
      want = Math.max(0, Math.min(max, want));
      if (Math.abs(want - from) < 1) return;
      const left = rtl ? want - max : want;
      list.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
      /* Smooth scrolling is a no-op in some embedded/preview runtimes, and a
         tab that stays off screen is the whole bug — so land it either way. */
      if (smooth) window.setTimeout(() => {
        const now = rtl ? max + list.scrollLeft : list.scrollLeft;
        if (Math.abs(now - want) > 2) list.scrollLeft = left;
      }, 400);
    };
    bring(true);
    /* A narrowing window pushes the selected tab off the end just as surely as
       selecting an off-screen one does — so watch for it. `bring` is a no-op
       when the tab is already in view, so this never yanks a strip the user
       has scrolled themselves. */
    const ro = new ResizeObserver(() => bring(false));
    ro.observe(list);
    return () => ro.disconnect();
  }, [activeKey]);

  /* Which PHYSICAL edge still has tabs behind it. The scrollbar is hidden by
     design, so without this the strip cuts a label mid-word and offers no hint
     that anything else exists.

     Physical, not logical, because `scrollLeft` is physical too — and in RTL
     it runs 0 (at the right-hand start) down to -max, so the reading has to be
     normalised before it means anything. `fromLeft` is that normalisation. */
  const [edges, setEdges] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const read = () => {
      const max = list.scrollWidth - list.clientWidth;
      if (max <= 1) { setEdges({ left: false, right: false }); return; }
      const rtl = getComputedStyle(list).direction === "rtl";
      const fromLeft = rtl ? max + list.scrollLeft : list.scrollLeft;
      setEdges({ left: fromLeft > 1, right: fromLeft < max - 1 });
    };
    read();
    list.addEventListener("scroll", read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(list);
    return () => { list.removeEventListener("scroll", read); ro.disconnect(); };
  }, [items.length]);

  /* Fonts settling after hydration can shift tab widths once — re-measure
     one beat later so the pill never sits a few px off. */
  useEffect(() => {
    if (!aurora) return;
    const id = window.setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
    }, 250);
    return () => window.clearTimeout(id);
  }, [aurora, activeKey]);

  /* Where tabs continue past an edge, the STRIP ITSELF fades out there — a
     mask on the scroller, so it reads the same on solid Core and on Aurora
     glass. The first version laid a gradient of the shell's own colour over
     the edge; under Aurora that colour is translucent, so on a frosted bar
     the hint vanished and "Knowledge" was simply cut mid-word (owner's UI
     review, 22 Sep 2026). Physical sides, like `edges`. */
  const fade = 44;
  const maskStops = [
    edges.left ? `transparent 0, #000 ${fade}px` : "#000 0",
    edges.right ? `#000 calc(100% - ${fade}px), transparent 100%` : "#000 100%",
  ].join(", ");
  const maskStyle = edges.left || edges.right
    ? { WebkitMaskImage: `linear-gradient(to right, ${maskStops})`, maskImage: `linear-gradient(to right, ${maskStops})` }
    : undefined;
  return (
    /* `className` belongs to the WRAPPER, not the scroller: every caller that
       passes one is positioning the strip in its parent's layout (`flex-1
       min-w-0`, `inline-flex max-w-full`), and that is the outer box's job. */
    <div className={`relative min-w-0 ${className}`}>
    <div ref={listRef} role="tablist" aria-label={ariaLabel} className={shellCls(pill, glass)} style={maskStyle}>
      {aurora && (
        <span
          aria-hidden
          className={`kx-tabstrip-ind${pill ? " !rounded-full" : ""}`}
          style={ind
            ? { transform: `translateX(${ind.x}px)`, width: ind.w, opacity: 1 }
            : { opacity: 0, width: 0 }}
        />
      )}
      {items.map((it) => {
        const active = !!it.active;
        const inner = (
          <>
            {it.icon}
            <span>{it.label}</span>
            {it.badge != null && it.badge !== false && (
              <span className="ms-0.5 text-[10px] font-semibold opacity-70">{it.badge}</span>
            )}
          </>
        );
        const common = {
          role: "tab" as const,
          "aria-selected": active,
          "aria-current": active ? ("page" as const) : undefined,
          className: tabClass(active, aurora, pill),
        };
        if (it.href && !it.onClick) {
          return (
            <Link key={it.key} href={it.href} {...common}>
              {inner}
            </Link>
          );
        }
        return (
          <button key={it.key} type="button" disabled={it.disabled} onClick={it.onClick} {...common}>
            {inner}
          </button>
        );
      })}
    </div>
    </div>
  );
}
