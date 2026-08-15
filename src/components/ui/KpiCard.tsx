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
import CountUp from "@/components/vendor/CountUp";

/* ── Should this value count up? ─────────────────────────────────────────────
   47 call sites pass `value` as an ALREADY-FORMATTED ReactNode: String(count),
   employees.length, formatMoney(total), dashStats?.headcount ?? "—". Asking
   all of them to pass a raw number instead would be 47 chances to change what
   a card says, to fix how it arrives.

   So the value is parsed instead — and the parse is only trusted when it
   ROUND-TRIPS. If re-formatting the number does not reproduce the original
   string character for character, this returns null and the card renders
   exactly what it was given, untouched. That check is the whole safety
   argument: an em-dash, "3 / 12", a percentage written a way we did not
   anticipate, or a locale that groups differently all fail it and are left
   alone rather than silently rewritten. */
function countable(v: ReactNode): { n: number; format: (x: number) => string } | null {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    /* A raw number renders through React as String(v) — NO grouping — so the
       format must reproduce that, commas included would change the card.
       Caught by the probe: 1316387.1 was being shown as "1316387", quietly
       dropping the decimals it was asked to display. */
    const dec = (String(v).split(".")[1] ?? "").length;
    const format = (x: number) => (dec > 0 ? x.toFixed(dec) : String(Math.round(x)));
    return format(v) === String(v) ? { n: v, format } : null;
  }
  if (typeof v !== "string") return null;

  /* The sign belongs to the NUMBER, not the prefix. Without -? the minus fell
     into `prefix`, so "-5" parsed as +5: the round-trip still passed (prefix +
     "5" reproduces "-5") and the card counted UPWARD toward a negative figure.
     A KPI showing a negative balance would have animated the wrong way. */
  const m = v.match(/^(\D*?)(-?\d[\d,\s.]*\d|-?\d)(\D*)$/);
  if (!m) return null;
  const [, prefix, digits, suffix] = m;

  /* A trailing dot with one or two digits is a decimal; anything else is
     grouping. "1,316,387.10" -> 2 decimals; "1.316.387" -> 0. */
  const dot = digits.lastIndexOf(".");
  const decimals = dot >= 0 && digits.length - dot - 1 > 0 && digits.length - dot - 1 <= 2
    ? digits.length - dot - 1 : 0;
  const sign = digits.startsWith("-") ? -1 : 1;
  const bare = decimals > 0
    ? digits.slice(0, dot).replace(/[^\d]/g, "") + "." + digits.slice(dot + 1)
    : digits.replace(/[^\d]/g, "");
  const n = sign * Number(bare);
  if (!Number.isFinite(n)) return null;

  /* A MINUS ANYWHERE OUTSIDE THE DIGITS AND WE DO NOT TOUCH IT. "-$1,200"
     puts the sign before the currency symbol, so it lands in `prefix` and the
     number parses as +1200 — the round-trip still passes, and the card would
     count upward while displaying a negative. Rather than enumerate every
     place a sign can sit, anything with a stray minus is left alone. */
  if (prefix.includes("-") || suffix.includes("-")) return null;

  const format = (x: number) => prefix + x.toLocaleString("en-US", {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }) + suffix;

  return format(n) === v ? { n, format } : null;
}

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
  /* Computed once per value, above the fit machinery, because CountUp
     reserves its final width — so the width this component measures is the
     final width from the first paint and the fit is calculated once, not on
     every frame of the count. */
  const counted = countable(value);
  const renderValue = counted
    ? <CountUp value={counted.n} format={counted.format} />
    : value;

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

  const interactive = !!(href || onClick);

  /* Writes the pointer into two custom properties; .kx-spotlight's ::before
     follows them. Attached only to interactive cards, so a card that cannot be
     clicked never lights up and never promises a click that does nothing. */
  const onPointer = interactive
    ? (e: React.PointerEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--kx-spot-x", `${e.clientX - r.left}px`);
        el.style.setProperty("--kx-spot-y", `${e.clientY - r.top}px`);
      }
    : undefined;

  /* kx-glass, because under kx-app the Aurora remap turns --bg-surface into
     rgba(255,255,255,0.04) — a translucent panel with NO blur, which shows the
     moving ground straight through the figure it exists to display. These are
     leaf tiles: nothing inside renders a fixed-without-portal child, so they
     can carry true frost. Under Core the class is inert and the card stays
     solid, exactly as it was. */
  const baseClass =
    "kx-glass block rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3.5 transition-colors " +
    (interactive
      ? "kx-spotlight hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] cursor-pointer "
      : "") +
    className;

  const inner = (
    <>
      <div className="flex items-center gap-2.5">
        {/* kx-stat on the chip below, because --bg-primary is TRANSPARENT
            inside an Aurora app scope: the remap is what lets the ground show
            through the page, so any element filled with that token stops being
            a surface and becomes a hole — here, an icon floating inside a bare
            rounded border. kx-stat is the system's answer for exactly this
            case: a 5% surface tint rather than a blur pass, because these chips
            appear a dozen to a screen and blur is priced per element.
            Aurora-scoped, so unconverted apps and Core are untouched. */}
        {icon !== undefined && (
          <span className="kx-stat flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-dim)]">
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
        {loading ? <span className="text-[var(--text-dim)]">—</span> : renderValue}
      </div>
      {hint && (
        <div className="mt-1 truncate text-[11px] text-[var(--text-dim)]">{hint}</div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseClass} onClick={onClick} onPointerMove={onPointer}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} onPointerMove={onPointer} className={baseClass + " w-full text-left"}>
        {inner}
      </button>
    );
  }
  return <div className={baseClass}>{inner}</div>;
}
