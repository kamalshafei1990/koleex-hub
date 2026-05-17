"use client";

/* ---------------------------------------------------------------------------
   ReportUi — unified report layout primitives.

   One vocabulary for every printable report (statements + operational
   reports). Apple-thin, monochrome, calm spacing, print-ready.

   Exports:
     · ReportShell        Page chrome with header / filters / body / footer
     · ReportHeader       Logo · title · period · as-of
     · ReportFilters      Standardized date range + selects + actions
     · ReportToolbar      Print / export buttons (right-aligned)
     · ReportSection      Titled group with optional subtitle + total
     · ReportRow          Label · value · indent · muted variant
     · ReportSubtotal     Subtotal divider row (light)
     · ReportTotal        Total bar (heavy)
     · ReportTable        Striped table with sticky header
     · ReportFooter       Company branding + page X of Y placeholder

   Reuse:
     - Statements (P&L / BS / CF / aging)
     - Operational reports (sales / purchases / inventory / expenses /
       customers / suppliers)
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import Link from "next/link";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

/* ─── Shell ─────────────────────────────────────────────────── */

export function ReportShell({
  title, subtitle, icon, backHref = "/", filters, toolbar, footer, children,
}: {
  title: string;
  subtitle?: string;
  icon?: RrIconName;
  backHref?: string;
  filters?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] print:bg-white print:text-black">
      <div className="mx-auto max-w-[1200px] px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Link href={backHref} aria-label="Back"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)]">
              <RrIcon name="arrow-left" size={16} />
            </Link>
            {icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
                <RrIcon name={icon} size={16} />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-[22px]">{title}</h1>
              {subtitle && <p className="text-[12px] text-[var(--text-dim)]">{subtitle}</p>}
            </div>
          </div>
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>

        {filters && (
          <div className="mt-4 print:hidden">{filters}</div>
        )}

        {/* PRINT-ONLY header */}
        <div className="hidden print:mb-4 print:block">
          <ReportHeader title={title} subtitle={subtitle} />
        </div>

        <div className="mt-5 print:mt-0">{children}</div>

        {footer && <div className="mt-8 hidden print:block">{footer}</div>}
      </div>
      <ReportPrintStyles />
    </div>
  );
}

/* ─── Header (print) ──────────────────────────────────────── */

export function ReportHeader({ title, subtitle, companyName = "KOLEEX" }: {
  title: string; subtitle?: string; companyName?: string;
}) {
  return (
    <header className="border-b border-black/20 pb-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-gray-600">{companyName}</div>
          <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
        </div>
        {subtitle && <div className="text-[11px] text-gray-600">{subtitle}</div>}
      </div>
    </header>
  );
}

/* ─── Filters ─────────────────────────────────────────────── */

export interface ReportFilterField {
  key: string;
  label: string;
  type: "date" | "select" | "text";
  value: string;
  options?: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

export function ReportFilters({
  fields, onApply, onReset,
}: {
  fields: ReportFilterField[];
  onApply?: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] p-3">
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500">{f.label}</span>
          {f.type === "select" ? (
            <select
              value={f.value} onChange={(e) => f.onChange(e.target.value)}
              className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[12.5px]"
            >
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={f.type} value={f.value} onChange={(e) => f.onChange(e.target.value)}
              className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[12.5px] tabular-nums"
            />
          )}
        </label>
      ))}
      <div className="ml-auto flex gap-2">
        {onReset && (
          <button type="button" onClick={onReset}
                  className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] hover:bg-white/[0.05]">
            Reset
          </button>
        )}
        {onApply && (
          <button type="button" onClick={onApply}
                  className="rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10]">
            Apply
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Toolbar ─────────────────────────────────────────────── */

export function ReportToolbar({ onPrint, extra }: { onPrint?: () => void; extra?: ReactNode }) {
  return (
    <>
      {extra}
      {onPrint && (
        <button type="button" onClick={onPrint}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10]">
          <RrIcon name="print" size={12} />
          Print / PDF
        </button>
      )}
    </>
  );
}

/* ─── Section ─────────────────────────────────────────────── */

export function ReportSection({
  title, subtitle, total, totalLabel = "Subtotal", children, defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  total?: number;
  totalLabel?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  void defaultOpen;
  return (
    <section className="mb-6 break-inside-avoid">
      <header className="mb-2 flex items-baseline justify-between">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
          {subtitle && <div className="text-[10.5px] text-gray-500">{subtitle}</div>}
        </div>
        {typeof total === "number" && (
          <div className="text-right">
            <div className="text-[9.5px] uppercase tracking-[0.14em] text-gray-500">{totalLabel}</div>
            <div className="font-mono text-[14px] tabular-nums">{fmtMoney(total)}</div>
          </div>
        )}
      </header>
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] print:rounded-none print:border-x-0 print:border-b print:border-t print:border-black/15 print:bg-transparent">
        {children}
      </div>
    </section>
  );
}

/* ─── Row primitives ─────────────────────────────────────── */

export function ReportRow({
  label, code, amount, indent = 0, muted = false, href, right,
}: {
  label: ReactNode;
  code?: string;
  amount?: number;
  indent?: number;
  muted?: boolean;
  href?: string;
  /** Custom right column override (e.g. text instead of amount). */
  right?: ReactNode;
}) {
  const padL = 12 + indent * 16;
  const tone = muted ? "text-gray-500" : "text-gray-200";
  const inner = (
    <div className={`flex items-baseline justify-between px-3 py-1.5 text-[12.5px] ${tone}`}
         style={{ paddingLeft: padL }}>
      <div className="flex items-baseline gap-2">
        {code && <span className="font-mono text-[10.5px] text-gray-500">{code}</span>}
        <span>{label}</span>
      </div>
      <div className="font-mono text-[12.5px] tabular-nums">
        {right ?? (typeof amount === "number" ? fmtMoney(amount) : "")}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block border-b border-white/[0.025] last:border-b-0 hover:bg-white/[0.02]">{inner}</Link>;
  return <div className="border-b border-white/[0.025] last:border-b-0">{inner}</div>;
}

export function ReportSubtotal({ label, amount, indent = 0 }: { label: string; amount: number; indent?: number }) {
  const padL = 12 + indent * 16;
  return (
    <div className="flex items-baseline justify-between border-t border-white/[0.06] bg-white/[0.012] px-3 py-1.5 text-[12.5px] font-medium"
         style={{ paddingLeft: padL }}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{fmtMoney(amount)}</span>
    </div>
  );
}

export function ReportTotal({ label, amount, tone = "neutral" }: { label: string; amount: number; tone?: "neutral" | "positive" | "warning" }) {
  const accent =
    tone === "positive" ? "border-emerald-300/40 bg-emerald-300/[0.04]" :
    tone === "warning"  ? "border-amber-300/40 bg-amber-300/[0.04]"   :
                          "border-white/[0.10] bg-white/[0.03]";
  return (
    <div className={`mt-2 flex items-baseline justify-between rounded-md border ${accent} px-3 py-2 text-[13.5px] font-semibold`}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">{fmtMoney(amount)}</span>
    </div>
  );
}

/* ─── Table ──────────────────────────────────────────────── */

export interface ReportColumn<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: T) => ReactNode;
}

export function ReportTable<T>({
  rows, columns, rowKey, empty = "No rows.", footerTotals,
}: {
  rows: T[];
  columns: Array<ReportColumn<T>>;
  rowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  footerTotals?: ReactNode[];   // one cell per column in totals row
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[12px]">
        <thead className="bg-white/[0.02] print:bg-black/[0.04]">
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500 print:text-black">
            {columns.map((c) => (
              <th key={c.key}
                  className={`px-3 py-2 text-${c.align ?? "left"} font-semibold`}
                  style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-[11px] text-gray-600">{empty}</td></tr>
          ) : rows.map((r, i) => (
            <tr key={rowKey(r, i)} className="border-b border-white/[0.025] last:border-b-0 hover:bg-white/[0.02]">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-1.5 text-${c.align ?? "left"} ${c.align === "right" ? "tabular-nums font-mono" : ""}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footerTotals && (
          <tfoot>
            <tr className="border-t border-white/[0.08] bg-white/[0.02] text-[12px] font-semibold">
              {footerTotals.map((cell, idx) => (
                <td key={idx}
                    className={`px-3 py-2 ${columns[idx]?.align === "right" ? "text-right tabular-nums font-mono" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ─── Footer (print) ─────────────────────────────────────── */

export function ReportFooter({ companyName = "KOLEEX", note }: { companyName?: string; note?: string }) {
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  return (
    <footer className="flex items-baseline justify-between border-t border-black/15 pt-2 text-[9.5px] text-gray-600">
      <span>{companyName} · generated {stamp}</span>
      {note && <span>{note}</span>}
    </footer>
  );
}

/* ─── Print CSS shim ─────────────────────────────────────── */

function ReportPrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        @page { size: A4; margin: 14mm 12mm 16mm 12mm; }
        body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print\\:hidden { display: none !important; }
      }
    `}</style>
  );
}

/* ─── Formatting helpers ─────────────────────────────────── */

export function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 0.005) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
}
export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}
