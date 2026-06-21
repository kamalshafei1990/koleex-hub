"use client";

/* ---------------------------------------------------------------------------
   TabStrip — the ONE canonical tab bar for the whole system.

   Style: pill buttons inside a bordered, rounded "shell" (the Product Data
   form's tab grammar). Active pill = filled inverted; inactive = muted with
   hover. Horizontally scrollable, scrollbar hidden. Works for both
   state-driven tabs (onClick + active) and route-driven tabs (href).

   Use this everywhere instead of bespoke tab markup so every tab in every
   app looks and behaves the same. Pair the swapped content with the
   `kx-tab-in` class (keyed on the active value) for the smooth entrance.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import type { ReactNode } from "react";

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

const SHELL =
  "flex items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function tabClass(active: boolean): string {
  return (
    "shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] " +
    (active
      ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
      : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]")
  );
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
  return (
    <div role="tablist" aria-label={ariaLabel} className={`${SHELL} ${className}`}>
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
          className: tabClass(active),
        };
        if (it.href && !it.onClick) {
          return (
            <Link key={it.key} href={it.href} {...common}>
              {inner}
            </Link>
          );
        }
        return (
          <button key={it.key} type="button" onClick={it.onClick} disabled={it.disabled} {...common}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
