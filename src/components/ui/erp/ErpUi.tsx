"use client";

/* ---------------------------------------------------------------------------
   ErpUi — unified ERP design system primitives.

   One small file, one consistent vocabulary, used by every new ERP
   surface (currency, workflows, …). Existing modules keep their own
   primitives untouched per the no-redesign rule.

   Exports:
     · ErpPage              standard page chrome (back arrow · icon ·
                              title · subtitle · action slot)
     · ErpEyebrow / Hairline mirror the Finance dashboard vocabulary
     · ErpKpi               tonal-rule KPI tile (Apple-thin)
     · ErpPanel             rounded panel with hairline border
     · ErpTable             clean table with sticky header, hoverable
                              rows, optional click handler
     · ErpStatusDot         four-tone status dot (complete / started
                              / empty / blocked)
     · ErpStageTimeline     workflow timeline used by the workflow pages
     · ErpQuickAction       icon-fronted action button
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import Link from "next/link";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import PageHeader from "@/components/ui/PageHeader";

/* ─── Page — thin wrapper around canonical PageHeader ───────── */

export function ErpPage({
  title, subtitle, backHref = "/", icon, action, children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  icon: RrIconName;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <PageHeader
          title={title}
          subtitle={subtitle}
          icon={icon}
          backHref={backHref}
          action={action}
          showTabs={false}
        />
        {children}
      </div>
    </div>
  );
}

/* ─── Typographic primitives ───────────────────────────────── */

export function ErpEyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">{children}</div>;
}
export function ErpHairline({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`h-px w-full bg-[var(--border-subtle)] ${className}`} />;
}

/* ─── KPI tile ─────────────────────────────────────────────── */

export function ErpKpi({
  label, value, hint, tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "warning" | "info";
}) {
  const accent =
    tone === "positive" ? "bg-emerald-300/55" :
    tone === "warning"  ? "bg-amber-300/55"   :
    tone === "info"     ? "bg-blue-300/55"    :
                          "bg-white/30";
  return (
    <div className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3.5">
      <div aria-hidden className={`absolute left-4 top-0 h-px w-8 ${accent}`} />
      <ErpEyebrow>{label}</ErpEyebrow>
      <div className="mt-2 font-mono text-[22px] leading-none tabular-nums tracking-[-0.01em]">{value}</div>
      {hint && <div className="mt-1.5 text-[10.5px] text-[var(--text-ghost)]">{hint}</div>}
    </div>
  );
}

/* ─── Panel ────────────────────────────────────────────────── */

export function ErpPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] ${className}`}>
      {children}
    </div>
  );
}

/* ─── Table ────────────────────────────────────────────────── */

export interface ErpColumn<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: T) => ReactNode;
}

export function ErpTable<T>({
  rows, columns, rowKey, empty = "No data.", onRowClick,
}: {
  rows: T[];
  columns: Array<ErpColumn<T>>;
  rowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  return (
    <ErpPanel>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead className="sticky top-0 z-[1] bg-[var(--bg-primary)]">
            <tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2 text-${c.align ?? "left"} font-semibold`}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-[11px] text-[var(--text-ghost)]">{empty}</td></tr>
            ) : rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-[var(--border-faint)] last:border-b-0 hover:bg-[var(--bg-secondary)] ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-1.5 text-${c.align ?? "left"} ${c.align === "right" ? "tabular-nums font-mono" : ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ErpPanel>
  );
}

/* ─── Status Dot ───────────────────────────────────────────── */

export type ErpStatus = "complete" | "started" | "empty" | "blocked";
const STATUS_CLS: Record<ErpStatus, string> = {
  complete: "bg-emerald-400/80",
  started:  "bg-amber-300/80",
  empty:    "bg-[var(--bg-surface-hover)]",
  blocked:  "bg-rose-400/70",
};
export function ErpStatusDot({ status }: { status: ErpStatus }) {
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_CLS[status]}`} />;
}

/* ─── Workflow timeline ───────────────────────────────────── */

export interface WorkflowStage {
  key: string;
  label: string;
  icon: RrIconName;
  href?: string;
  status: ErpStatus;
  /** Optional count: "12 open", "3 pending" … */
  hint?: string;
}

export function ErpStageTimeline({ stages, current }: { stages: WorkflowStage[]; current?: string }) {
  return (
    <ol className="flex flex-wrap items-stretch gap-2">
      {stages.map((s, i) => {
        const isCurrent = current === s.key;
        const tone =
          s.status === "complete" ? "border-emerald-400/30 bg-emerald-500/[0.06]" :
          s.status === "started"  ? "border-amber-400/30 bg-amber-500/[0.06]"   :
          s.status === "blocked"  ? "border-rose-400/30 bg-rose-500/[0.06]"     :
                                    "border-[var(--border-subtle)] bg-[var(--bg-secondary)]";
        const ring = isCurrent ? "ring-1 ring-white/[0.18]" : "";
        const inner = (
          <div className={`flex h-full items-center gap-2 rounded-xl border px-3 py-2 ${tone} ${ring}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-highlight)]">
              <RrIcon name={s.icon} size={12} />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <ErpStatusDot status={s.status} />
                <span className="text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">{`Step ${i + 1}`}</span>
              </div>
              <div className="text-[12.5px] font-medium text-[var(--text-primary)]">{s.label}</div>
              {s.hint && <div className="text-[10.5px] text-[var(--text-dim)]">{s.hint}</div>}
            </div>
          </div>
        );
        return (
          <li key={s.key} className="flex">
            {s.href ? (
              <Link href={s.href} className="block transition-colors hover:opacity-95">{inner}</Link>
            ) : inner}
            {i < stages.length - 1 && (
              <span aria-hidden className="mx-1 hidden self-center text-[var(--text-ghost)] sm:inline">›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Quick action ─────────────────────────────────────────── */

export function ErpQuickAction({
  href, icon, label, hint, onClick,
}: { href?: string; icon: RrIconName; label: string; hint?: string; onClick?: () => void }) {
  const cls =
    "flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2.5 text-left hover:bg-[var(--bg-surface-subtle)] transition-colors";
  const inner = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-highlight)]">
        <RrIcon name={icon} size={14} />
      </span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium">{label}</div>
        {hint && <div className="text-[10.5px] text-[var(--text-dim)]">{hint}</div>}
      </div>
      <span className="ml-auto text-[var(--text-dim)]">
        <RrIcon name="arrow-up-right" size={11} />
      </span>
    </>
  );
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={`${cls} w-full`}>{inner}</button>;
}
