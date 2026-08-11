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
const SHELL =
  "kx-glass relative flex items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function tabClass(active: boolean, aurora: boolean): string {
  const base =
    "relative shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ";
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
}: {
  items: TabStripItem[];
  className?: string;
  ariaLabel?: string;
}) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aurora, activeKey, items.length]);

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

  return (
    <div ref={listRef} role="tablist" aria-label={ariaLabel} className={`${SHELL} ${className}`}>
      {aurora && (
        <span
          aria-hidden
          className="kx-tabstrip-ind"
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
          className: tabClass(active, aurora),
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
  );
}
