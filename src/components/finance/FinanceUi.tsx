"use client";

/* ---------------------------------------------------------------------------
   Finance App — shared visual primitives

   These are the small composable building blocks the rest of the Finance
   pages reuse. They lean on the Koleex Hub theme tokens (--bg-secondary,
   --border-subtle, etc.) so they automatically adapt to the dark/light
   theme without any hardcoded colors.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { fmtMoney, fmtPct } from "@/lib/finance/calc";

/* ── KpiCard ──────────────────────────────────────────────────────
   Large statistic with delta indicator + sub-label + optional trend
   sparkline. Used on the dashboard and at the top of every list page. */
export function KpiCard({
  label,
  value,
  delta,
  deltaValue,
  currency,
  accent,
  hint,
  loading,
  invertDelta,
}: {
  label: string;
  value: number | string;
  delta?: number | null;
  deltaValue?: number;
  currency?: string;
  accent?: "emerald" | "rose" | "amber" | "sky" | "violet" | "default";
  hint?: string;
  loading?: boolean;
  /* For expenses-style metrics where a DROP is good and a RISE is bad */
  invertDelta?: boolean;
}) {
  const numericValue = typeof value === "number" ? value : null;
  const display =
    typeof value === "string"
      ? value
      : fmtMoney(numericValue ?? 0, currency || "USD", { compact: true });
  const deltaSign = delta == null ? 0 : delta > 0 ? 1 : delta < 0 ? -1 : 0;
  const goodDirection = invertDelta ? deltaSign < 0 : deltaSign > 0;
  const neutralDelta = deltaSign === 0;
  const accentClass = (() => {
    switch (accent) {
      case "emerald": return "text-emerald-400";
      case "rose":    return "text-rose-400";
      case "amber":   return "text-amber-400";
      case "sky":     return "text-sky-400";
      case "violet":  return "text-violet-400";
      default:        return "text-[var(--text-primary)]";
    }
  })();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--bg-secondary)] p-5 transition hover:border-white/[0.10]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</div>
      <div className={`mt-3 text-2xl font-semibold tabular-nums ${accentClass}`}>
        {loading ? <span className="inline-block h-6 w-32 animate-pulse rounded bg-white/5" /> : display}
      </div>
      {(delta != null || hint) && (
        <div className="mt-3 flex items-center gap-2 text-[11px]">
          {delta != null && (
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold " +
                (neutralDelta
                  ? "bg-white/5 text-gray-400"
                  : goodDirection
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-rose-500/15 text-rose-400")
              }
              title={
                deltaValue != null && currency
                  ? `${deltaValue > 0 ? "+" : ""}${fmtMoney(deltaValue, currency, { compact: true })} vs previous period`
                  : undefined
              }
            >
              {neutralDelta ? "—" : deltaSign > 0 ? "▲" : "▼"} {fmtPct(delta)}
            </span>
          )}
          {hint && <span className="text-gray-500">{hint}</span>}
        </div>
      )}
    </div>
  );
}

/* ── StatusBadge ─────────────────────────────────────────────────── */
const STATUS_PALETTE: Record<string, { bg: string; text: string; label?: string }> = {
  paid:           { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  partial:        { bg: "bg-amber-500/15",   text: "text-amber-400" },
  unpaid:         { bg: "bg-gray-500/15",    text: "text-gray-400" },
  overdue:        { bg: "bg-rose-500/15",    text: "text-rose-400" },
  open:           { bg: "bg-sky-500/15",     text: "text-sky-400" },
  in_production:  { bg: "bg-violet-500/15",  text: "text-violet-400", label: "In production" },
  shipped:        { bg: "bg-blue-500/15",    text: "text-blue-400" },
  delivered:      { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  closed:         { bg: "bg-gray-500/15",    text: "text-gray-400" },
  cancelled:      { bg: "bg-rose-500/15",    text: "text-rose-400" },
  good:           { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  watch:          { bg: "bg-amber-500/15",   text: "text-amber-400" },
  hold:           { bg: "bg-orange-500/15",  text: "text-orange-400" },
  blocked:        { bg: "bg-rose-500/15",    text: "text-rose-400" },
  scheduled:      { bg: "bg-sky-500/15",     text: "text-sky-400" },
  sent:           { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  done:           { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  snoozed:        { bg: "bg-amber-500/15",   text: "text-amber-400" },
  completed:      { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  pending:        { bg: "bg-amber-500/15",   text: "text-amber-400" },
  bounced:        { bg: "bg-rose-500/15",    text: "text-rose-400" },
  collect:        { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Money to collect" },
  pay:            { bg: "bg-rose-500/15",    text: "text-rose-400",    label: "Money to pay" },
};

export function StatusBadge({ status }: { status: string }) {
  const p = STATUS_PALETTE[status] ?? { bg: "bg-white/5", text: "text-gray-400" };
  const label = p.label ?? status.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${p.bg} ${p.text}`}
    >
      {label}
    </span>
  );
}

/* ── EmptyState ─────────────────────────────────────────────────── */
export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[var(--bg-secondary)] py-16 text-center">
      <div className="mb-4 opacity-50">{icon}</div>
      <p className="text-base font-medium text-[var(--text-primary)]">{title}</p>
      {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── SectionCard ────────────────────────────────────────────────── */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[var(--bg-secondary)] p-5">
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── PageHeader ─────────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/* ── PeriodTabs ─────────────────────────────────────────────────── */
export function PeriodTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/[0.06] bg-[var(--bg-secondary)] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium transition " +
            (o.value === value
              ? "bg-white/10 text-[var(--text-primary)]"
              : "text-gray-400 hover:text-gray-200")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── TrendChart — simple stacked bar chart of revenue vs expenses ── */
export function TrendChart({
  data,
  currency,
}: {
  data: { label: string; revenue: number; expenses: number; net_profit: number }[];
  currency: string;
}) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.expenses)));
  return (
    <div>
      <div className="flex items-end gap-2 h-44">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end gap-0.5 h-full">
              <div
                className="flex-1 rounded-t bg-emerald-500/70 transition hover:bg-emerald-400"
                style={{ height: `${(d.revenue / max) * 100}%`, minHeight: d.revenue > 0 ? 4 : 0 }}
                title={`Revenue: ${fmtMoney(d.revenue, currency, { compact: true })}`}
              />
              <div
                className="flex-1 rounded-t bg-rose-500/70 transition hover:bg-rose-400"
                style={{ height: `${(d.expenses / max) * 100}%`, minHeight: d.expenses > 0 ? 4 : 0 }}
                title={`Costs + Expenses: ${fmtMoney(d.expenses, currency, { compact: true })}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 px-0.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-gray-500">{d.label}</div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-gray-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500/70" /> Revenue</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500/70" /> Costs + Expenses</span>
      </div>
    </div>
  );
}

/* ── ProgressBar — used for "X% of selling price collected" etc. ── */
export function ProgressBar({
  value,
  max,
  color = "emerald",
}: {
  value: number;
  max: number;
  color?: "emerald" | "amber" | "rose" | "sky";
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bg =
    color === "emerald" ? "bg-emerald-500"
    : color === "amber" ? "bg-amber-500"
    : color === "rose"  ? "bg-rose-500"
    : "bg-sky-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <div className={`h-full ${bg} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}
