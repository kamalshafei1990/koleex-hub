"use client";

/* ---------------------------------------------------------------------------
   KpiCard — Koleex Hub canonical KPI tile.

   The single way to render a dashboard KPI across every app. Pure
   monochrome (matches Koleex brand) — no colored top borders, no
   colored backgrounds. Status/tone is communicated by the optional
   `tone` prop (used sparingly for warnings/critical numbers).

     ┌────────────────────────────────┐
     │ 📦  TOTAL EMPLOYEES            │  ← icon + label (uppercase, dim)
     │                                │
     │  42                            │  ← big number (26px tabular)
     │  ↑ 3 this week                 │  ← optional hint
     └────────────────────────────────┘

   Examples:
     <KpiCard label="Stock Items" value="142" icon="box-open" />
     <KpiCard label="Overdue" value="$5,200" icon="info" tone="rose" hint="3 invoices" />
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

/* The canonical value type size, and the floor we will not shrink past. */
const VALUE_PX = 26;
const VALUE_MIN_PX = 15;

export type KpiTone = "default" | "positive" | "warning" | "rose" | "info";

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Icon name OR a custom ReactNode (e.g. <UsersIcon />). */
  icon?: RrIconName | ReactNode;
  /** Optional small subtitle / trend below the value. */
  hint?: ReactNode;
  /** Subtle tone used only on the value text — monochrome stays the default. */
  tone?: KpiTone;
  /** Show a loading placeholder instead of the value. */
  loading?: boolean;
  /** Make the whole card a link. */
  href?: string;
  /** Click handler — turns the card into a button. */
  onClick?: () => void;
  /** Extra classes for the card wrapper. */
  className?: string;
}

const TONE_CLASSES: Record<KpiTone, string> = {
  default:  "text-[var(--text-primary)]",
  positive: "text-emerald-400",
  warning:  "text-amber-400",
  rose:     "text-rose-400",
  info:     "text-blue-400",
};

export default function KpiCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
  loading,
  href,
  onClick,
  className = "",
}: KpiCardProps) {
  /* ── Shrink-to-fit for long values ──────────────────────────────────────
     A formatted total is ONE unbreakable token: comma separators are not
     break opportunities, so `1,316,387.10` at 26px is 165px of ink that will
     not wrap, will not shrink and — with overflow visible — simply paints
     past the card's border. MEASURED on /quotations at 1024: 165px of ink in
     a 136px content box, 28px outside the tile. Nothing catches it: the
     element's own box stays 136px wide, so no bounding rect and no page
     overflow ever reports it. Only scrollWidth sees it (165 vs 136), which
     is exactly what this measures.

     Short values are untouched — the effect only ever sets a size when the
     text genuinely does not fit, so every existing dashboard keeps its 26px.

     The width guard is load-bearing: the observer watches this element, and
     changing the font size changes its HEIGHT, which fires the observer
     again. Re-fitting only when the WIDTH actually changed stops that from
     oscillating between 26px and the fitted size forever. */
  const valueRef = useRef<HTMLDivElement | null>(null);
  const lastWidth = useRef(-1);
  useLayoutEffect(() => {
    const el = valueRef.current;
    if (!el) return;
    lastWidth.current = -1; // the value changed — re-fit from scratch
    const fit = () => {
      const node = valueRef.current;
      if (!node) return;
      const width = node.clientWidth;
      if (width === lastWidth.current) return;
      lastWidth.current = width;
      node.style.fontSize = ""; // always measure against the canonical size
      const needed = node.scrollWidth;
      if (width > 0 && needed > width) {
        node.style.fontSize = `${Math.max(
          VALUE_MIN_PX,
          Math.floor((VALUE_PX * width) / needed),
        )}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  const baseClass =
    "block rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3.5 transition-colors " +
    (href || onClick
      ? "hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] cursor-pointer "
      : "") +
    className;

  const inner = (
    <>
      <div className="flex items-center gap-2.5">
        {icon !== undefined && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-dim)]">
            {typeof icon === "string" ? (
              <RrIcon name={icon as RrIconName} size={14} />
            ) : (
              icon
            )}
          </span>
        )}
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[var(--text-dim)]">
          {label}
        </div>
      </div>
      <div
        ref={valueRef}
        className={`mt-2 text-[26px] font-semibold leading-tight tracking-tight tabular-nums ${TONE_CLASSES[tone]}`}
      >
        {loading ? <span className="text-[var(--text-dim)]">—</span> : value}
      </div>
      {hint && (
        <div className="mt-1 truncate text-[11px] text-[var(--text-dim)]">{hint}</div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseClass} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClass + " w-full text-left"}>
        {inner}
      </button>
    );
  }
  return <div className={baseClass}>{inner}</div>;
}
