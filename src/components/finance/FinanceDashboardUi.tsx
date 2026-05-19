"use client";

/* ===========================================================================
   Phase UI.1 — Finance Dashboard primitives.

   New, dashboard-only typographic building blocks. Used ONLY by
   FinanceDashboard.tsx so we don't disturb the other Finance pages
   that still consume FinanceUi / FinanceUiX.

   Anchor principles:
     · subtraction beats addition — chrome is removed, not added
     · 5-token type scale: display · headline · body · caption · eyebrow
     · borders avoided in favour of spacing, opacity, and a single
       hairline rule above section headings
     · three-tier hierarchy:
         L1  DisplayKpi      — the company condition at a glance
         L2  OperationalKpi  — important but supporting
         L3  IntelligenceLine — interpretation, quieter

   No data-flow, no math, no business logic — pure presentation.
   ========================================================================== */

import type { ReactNode } from "react";
import Link from "next/link";
import GuidanceTip from "@/components/ui/GuidanceTip";

/* ─── 5-token type scale ──────────────────────────────────────────
   The dashboard previously used 10+ distinct font sizes. We collapse
   the value-side typography to five tokens. Class strings are exact
   pt-equivalents Tailwind can match. */
export const TYPE = {
  display:  "text-[40px] font-medium leading-[1.05] tracking-[-0.02em] tabular-nums",
  headline: "text-[22px] font-medium leading-[1.15] tracking-[-0.01em] tabular-nums",
  body:     "text-[13px] font-normal leading-[1.45]",
  caption:  "text-[11px] font-normal leading-[1.45] text-gray-500",
  eyebrow:  "text-[10px] font-semibold leading-none uppercase tracking-[0.18em] text-gray-500",
} as const;

/* ─── Tonal accent map ─────────────────────────────────────────────
   The 12-colour rainbow palette in FinanceUi is replaced here with a
   muted four-tone set used by every dashboard primitive. Charts will
   adopt a similar restrained ramp in Phase UI.2. */
type Tone = "positive" | "negative" | "warning" | "neutral" | "info";

const TONE_TEXT: Record<Tone, string> = {
  positive: "text-emerald-200",
  negative: "text-rose-200",
  warning:  "text-amber-200",
  info:     "text-[var(--text-primary)]",
  neutral:  "text-[var(--text-primary)]",
};
const TONE_ACCENT: Record<Tone, string> = {
  positive: "bg-emerald-300/55",
  negative: "bg-rose-300/55",
  warning:  "bg-amber-300/55",
  info:     "bg-white/30",
  neutral:  "bg-white/20",
};

/* ─── Eyebrow ────────────────────────────────────────────────────── */

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className={TYPE.eyebrow}>{children}</div>;
}

/* ─── Hairline ─────────────────────────────────────────────────────
   The single visual separator the dashboard uses between major
   sections. No background tint, no padding — pure horizontal rule
   at very low opacity. */
export function Hairline({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-white/[0.05] ${className}`} aria-hidden />;
}

/* ─── DashboardSection ────────────────────────────────────────────
   Replaces the boxed SectionCard for dashboard surfaces. A typographic
   section heading + an optional description, sitting above a
   children slot with generous vertical spacing. The heading is
   preceded by a hairline rule so the visual grouping is unmistakable
   without painting a box around it. */
export function DashboardSection({
  eyebrow,
  title,
  description,
  action,
  helpId,
  children,
  /* Tight = smaller top spacing — used when a section follows
     directly after another non-section block (e.g. a stat row). */
  tight = false,
}: {
  eyebrow: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  helpId?: string;
  children: ReactNode;
  tight?: boolean;
}) {
  return (
    <section className={tight ? "mt-8" : "mt-12"}>
      <Hairline />
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Eyebrow>{eyebrow}</Eyebrow>
            {helpId && <GuidanceTip guidanceId={helpId} />}
          </div>
          {title && <h2 className="mt-1 text-[15px] font-medium tracking-tight text-[var(--text-primary)]">{title}</h2>}
          {description && <p className="mt-1 max-w-prose text-[12px] text-gray-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/* ─── DisplayKpi (L1) ──────────────────────────────────────────────
   The dominant number on the dashboard. Used for the four lead
   metrics: Net Profit · Revenue · Cash Position · Composite Health.
   No card chrome — only a hairline accent rule on top with the
   tonal colour. Value at display (40pt), label as eyebrow above,
   optional hint below. */
export function DisplayKpi({
  label,
  value,
  hint,
  tone = "info",
  helpId,
  loading = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  helpId?: string;
  loading?: boolean;
}) {
  return (
    <div className="relative pt-3">
      {/* Tonal accent rule — the only chrome the L1 metric carries. */}
      <div aria-hidden className={`absolute left-0 top-0 h-px w-10 ${TONE_ACCENT[tone]}`} />
      <div className="flex items-center gap-1.5">
        <Eyebrow>{label}</Eyebrow>
        {helpId && <GuidanceTip guidanceId={helpId} />}
      </div>
      <div className={`mt-2 ${TYPE.display} ${TONE_TEXT[tone]}`}>
        {loading ? <span className="text-gray-700">—</span> : value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-gray-500">{hint}</div>}
    </div>
  );
}

/* ─── OperationalKpi (L2) ──────────────────────────────────────────
   Important but supporting metric. Headline-sized value (22pt) with
   label as eyebrow. Lives next to other L2 metrics in a single grid
   row; no border, no card. */
export function OperationalKpi({
  label,
  value,
  hint,
  tone = "info",
  helpId,
  loading = false,
  deltaPct,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  helpId?: string;
  loading?: boolean;
  /** Optional period-over-period delta percent. Rendered as a small
   *  triangle + signed number, never as a coloured pill. */
  deltaPct?: number | null;
  /** Optional drill-down route. When set, the whole tile becomes a
   *  clickable Link so the operator can navigate from the number. */
  href?: string;
}) {
  const delta = deltaPct ?? null;
  const deltaSign = delta == null ? null : delta > 0 ? "▲" : delta < 0 ? "▼" : "·";
  const deltaCls = delta == null ? "text-gray-500"
    : tone === "warning" ? "text-amber-300/80"
    : (tone === "positive" && delta >= 0) || (tone === "negative" && delta < 0) ? "text-emerald-300/80"
    : (tone === "positive" && delta < 0) || (tone === "negative" && delta >= 0) ? "text-rose-300/80"
    : "text-gray-400";
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <Eyebrow>{label}</Eyebrow>
        {helpId && <GuidanceTip guidanceId={helpId} />}
      </div>
      <div className={`mt-1.5 ${TYPE.headline} ${TONE_TEXT[tone]}`}>
        {loading ? <span className="text-gray-700">—</span> : value}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] tabular-nums ${deltaCls}`}>
            <span aria-hidden>{deltaSign}</span>
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-[10px] text-gray-500">{hint}</span>}
      </div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block rounded-md transition-opacity hover:opacity-95" aria-label={`Open ${label}`}>
        {body}
      </Link>
    );
  }
  return <div>{body}</div>;
}

/* ─── IntelligenceLine (L3) ────────────────────────────────────────
   The quietest tier. Used for "what the numbers mean" — single-line
   observations, secondary analytics, supporting context. Body-size
   text, no chrome at all, optional severity dot. */
export function IntelligenceLine({
  text,
  severity = "info",
  prefix,
}: {
  text: string;
  severity?: "info" | "watch" | "risk" | "positive";
  prefix?: string;
}) {
  const dotCls =
    severity === "risk"    ? "bg-rose-400"
    : severity === "watch" ? "bg-amber-300"
    : severity === "positive" ? "bg-emerald-400"
    : "bg-gray-500";
  return (
    <div className="flex items-baseline gap-2.5">
      <span aria-hidden className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${dotCls}`} />
      <div className="flex-1 text-[12.5px] leading-[1.55] text-gray-300">
        {prefix && <span className="font-medium text-[var(--text-primary)]">{prefix} </span>}
        {text}
      </div>
    </div>
  );
}

/* ─── HealthRail ───────────────────────────────────────────────────
   The system-health surface that opens the dashboard. Composite
   health number (large, tonal) + per-module thin bars beneath. NO
   border, NO box — just typography on a hairline-separated band. */
export function HealthRail({
  headline,
  composite,
  pressure,
  modules,
  helpId,
}: {
  headline: string;
  composite: number;
  pressure: "calm" | "watch" | "risk" | "critical";
  modules: Array<{ key: string; label: string; score: number; pressure: "calm" | "watch" | "risk" | "critical" }>;
  helpId?: string;
}) {
  const compositeTone: Tone =
    pressure === "critical" || pressure === "risk" ? "negative"
    : pressure === "watch" ? "warning"
    : "positive";
  const pressureLabel = pressure[0].toUpperCase() + pressure.slice(1);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        {/* Left: composite + headline */}
        <div className="min-w-0 max-w-[680px]">
          <div className="flex items-center gap-1.5">
            <Eyebrow>System health</Eyebrow>
            {helpId && <GuidanceTip guidanceId={helpId} />}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className={`${TYPE.display} ${TONE_TEXT[compositeTone]}`}>{composite}</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{pressureLabel}</div>
          </div>
          <p className="mt-2 text-[12.5px] leading-[1.55] text-gray-400">{headline}</p>
        </div>
        {/* Right: per-module thin bars */}
        <div className="grid w-full max-w-[560px] grid-cols-5 gap-x-3 gap-y-1.5">
          {modules.map((m) => {
            const fillCls =
              m.pressure === "critical" ? "bg-rose-300/70"
              : m.pressure === "risk"   ? "bg-rose-300/55"
              : m.pressure === "watch"  ? "bg-amber-300/65"
              :                            "bg-emerald-300/65";
            const pct = Math.max(4, Math.min(100, m.score));
            return (
              <div key={m.key} className="flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-[0.10em] text-gray-500">{m.label}</div>
                <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <div className={`absolute inset-y-0 left-0 ${fillCls}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] tabular-nums text-gray-400">{m.score}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── OperationsDigest ─────────────────────────────────────────────
   Replaces the four stacked CrossModule / Approval / Payment /
   Treasury panels. A single typographic strip with three inline
   pills (Approvals · Payments · Treasury) and a single combined
   correlation line beneath. No card chrome. */
export interface OpsPillData {
  label: string;
  score: number;
  pressure: "calm" | "watch" | "risk" | "critical";
  hint?: string;
  href?: string;
}
export function OperationsDigest({
  pills,
  note,
}: {
  pills: OpsPillData[];
  note?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
        {pills.map((p) => {
          const tone: Tone =
            p.pressure === "critical" || p.pressure === "risk" ? "negative"
            : p.pressure === "watch" ? "warning"
            : "positive";
          const dot =
            p.pressure === "critical" ? "bg-rose-400"
            : p.pressure === "risk"   ? "bg-rose-400/80"
            : p.pressure === "watch"  ? "bg-amber-300"
            :                            "bg-emerald-400";
          return (
            <div key={p.label} className="min-w-[120px]">
              <div className="flex items-center gap-1.5">
                <span aria-hidden className={`h-1 w-1 rounded-full ${dot}`} />
                <Eyebrow>{p.label}</Eyebrow>
              </div>
              <div className={`mt-1.5 ${TYPE.headline} ${TONE_TEXT[tone]}`}>{p.score}</div>
              {p.hint && <div className="mt-1 text-[10px] text-gray-500">{p.hint}</div>}
            </div>
          );
        })}
      </div>
      {note && <p className="mt-5 max-w-[680px] text-[12.5px] leading-[1.55] text-gray-400">{note}</p>}
    </div>
  );
}

/* ─── A subtle "calm" / "info" inline chip used for L3 context.
   No background, no border — only a coloured dot + label. */
export function CalmTag({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "positive" | "warning" | "neutral";
}) {
  const dot = tone === "positive" ? "bg-emerald-400"
    : tone === "warning" ? "bg-amber-300"
    : "bg-gray-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-gray-400">
      <span aria-hidden className={`h-1 w-1 rounded-full ${dot}`} />
      {text}
    </span>
  );
}
