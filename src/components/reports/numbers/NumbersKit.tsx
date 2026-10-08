"use client";

/* ---------------------------------------------------------------------------
   The number reports' shared pieces (Reports 6C) — the frame, the tabs, the
   period bar, an amount per currency, the states, the table that becomes
   cards on a phone, and the print through the house recipe.

   The frame is the Reports app's own: the Hub header with its back control
   (to the Library), the same width and padding, the Aurora glass cards,
   Hub tokens only — so these pages read as part of Reports, not as a second
   app inside it. Amounts sit in their own left-to-right island so an Arabic
   page keeps "CNY 1,234.50" readable.
   --------------------------------------------------------------------------- */

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import TabStrip from "@/components/ui/TabStrip";
import SharedKpiCard from "@/components/ui/KpiCard";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DatePicker from "@/components/ui/DatePicker";
import { currencyOrder, dmy, moneyLine, quickAsOf, quickRange, type AsOfKey, type Money, type RangeKey } from "@/lib/reports/numbers";

export type T = (key: string, fallback?: string) => string;
/* The Reports app's card (app/shared CARD — validate:reports keeps the two
   equal). Not imported: shared.tsx carries the status chips and their words,
   which these pages never show. */
export const CARD = "kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]";

export function NumbersFrame({ t, lang, title, subtitle, icon, action, children }: {
  t: T; lang: string; title: string; subtitle: string; icon: RrIconName; action?: ReactNode; children: ReactNode;
}) {
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-full">
      <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-28">
        <PageHeader title={title} subtitle={subtitle} icon={icon} backHref="/reports?tab=library" backLabel={t("num.back")} action={action} showTabs={false} />
        <div className="mt-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

/** The report tabs — the Hub's one tab bar (TabStrip), without its own
 *  glass: it sits inside a glass card already (one edge blur, not two). A
 *  report this reader may not open carries a lock once the server said so. */
export function TabPills<K extends string>({ tabs, value, onChange, label }: {
  tabs: Array<{ key: K; label: string; locked?: boolean }>; value: K; onChange: (k: K) => void; label: string;
}) {
  return (
    <TabStrip ariaLabel={label} glass={false}
      items={tabs.map((tab) => ({ key: tab.key, label: tab.label, active: tab.key === value, onClick: () => onChange(tab.key), icon: tab.locked ? <RrIcon name="lock" size={11} /> : undefined }))} />
  );
}

const CHIP = "inline-flex h-8 shrink-0 items-center rounded-lg border px-2.5 text-[12px] font-medium transition-colors";
const chipCls = (on: boolean) => `${CHIP} ${on ? "border-[var(--border-focus)] bg-[var(--bg-surface)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`;

/** The period: quick choices, then the days themselves (D/M/Y). */
export function PeriodBar({ t, lang, today, mode, from, to, asOf, onRange, onAsOf }: {
  t: T; lang: string; today: string; mode: "range" | "asOf" | "none";
  from?: string; to?: string; asOf?: string;
  onRange?: (from: string, to: string) => void; onAsOf?: (day: string) => void;
}) {
  if (mode === "none") return null;
  if (mode === "asOf") {
    const keys: AsOfKey[] = ["today", "monthEnd", "yearEnd"];
    const words: Record<AsOfKey, string> = { today: t("num.range.today"), monthEnd: t("num.range.monthEnd"), yearEnd: t("num.range.yearEnd") };
    return (
      <div className="flex flex-wrap items-center gap-2">
        {keys.map((k) => { const d = quickAsOf(k, today); return <button key={k} type="button" onClick={() => onAsOf?.(d)} className={chipCls(asOf === d)} aria-pressed={asOf === d}>{words[k]}</button>; })}
        <label className="ms-auto flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
          <span className="shrink-0">{t("num.period.asOf")}</span>
          <span className="w-[150px]"><DatePicker id="kx-num-asof" value={asOf ?? today} onChange={(iso) => { if (iso) onAsOf?.(iso); }} lang={lang} heightCls="h-9" floating format={dmy} max={today} /></span>
        </label>
      </div>
    );
  }
  const keys: RangeKey[] = ["month", "quarter", "year", "lastYear"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {keys.map((k) => {
        const r = quickRange(k, today);
        const on = from === r.from && to === r.to;
        return <button key={k} type="button" onClick={() => onRange?.(r.from, r.to)} className={chipCls(on)} aria-pressed={on}>{t(`num.range.${k}`)}</button>;
      })}
      <div className="ms-auto flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-dim)]">
        <span className="shrink-0">{t("num.period.from")}</span>
        <span className="w-[140px]"><DatePicker id="kx-num-from" value={from ?? today} onChange={(iso) => { if (iso) onRange?.(iso, to && to >= iso ? to : iso); }} lang={lang} heightCls="h-9" floating format={dmy} max={to ?? today} /></span>
        <span className="shrink-0">{t("num.period.to")}</span>
        <span className="w-[140px]"><DatePicker id="kx-num-to" value={to ?? today} onChange={(iso) => { if (iso) onRange?.(from && from <= iso ? from : iso, iso); }} lang={lang} heightCls="h-9" floating format={dmy} min={from} /></span>
      </div>
    </div>
  );
}

/** An amount: one line per currency, each in its own LTR island. `dash`:
 *  a row with no money reads "—" (a total or a figure still reads 0.00). */
export function MoneyStack({ m, base, strong, tone, dash }: { m: Money | undefined; base: string; strong?: boolean; tone?: string; dash?: boolean }) {
  const codes = currencyOrder(base, m);
  if (!codes.length && dash) return <span className="text-[var(--text-faint)]">—</span>;
  const lines = codes.length ? codes.map((c) => moneyLine(c, m![c])) : [moneyLine(base, 0)];
  return (
    <span className={`inline-flex flex-col items-end gap-0.5 ${tone ?? ""}`}>
      {lines.map((l) => (
        <span key={l} dir="ltr" className={`whitespace-nowrap font-mono tabular-nums [unicode-bidi:isolate] ${strong ? "font-semibold" : ""}`}>{l}</span>
      ))}
    </span>
  );
}

/** One figure, in the house KPI card; a second currency rides in the hint. */
export function MoneyKpi({ label, m, base, icon, tone, loading, t }: {
  label: string; m: Money | undefined; base: string; icon: RrIconName; tone?: "positive" | "warning" | "rose" | "info"; loading?: boolean; t: T;
}) {
  const codes = currencyOrder(base, m);
  const first = codes.length ? moneyLine(codes[0], m![codes[0]]) : moneyLine(base, 0);
  const rest = codes.slice(1).map((c) => moneyLine(c, m![c]));
  const hint = rest.length ? <span dir="ltr" className="[unicode-bidi:isolate]">{rest.join(" · ")}</span> : undefined;
  return (
    <SharedKpiCard label={label} value={<span dir="ltr" className="whitespace-nowrap [unicode-bidi:isolate]">{first}</span>} hint={hint ?? (codes.length > 1 ? t("num.kpi.mixed").replace("{n}", String(codes.length)) : undefined)} icon={icon} tone={tone} loading={loading} />
  );
}

export function PlainKpi({ label, value, icon, hint, loading }: { label: string; value: string; icon: RrIconName; hint?: string; loading?: boolean }) {
  return <SharedKpiCard label={label} value={value} icon={icon} hint={hint} loading={loading} />;
}

export function StateCard({ kind, text, onRetry, t }: { kind: "loading" | "error" | "locked" | "empty"; text?: string; onRetry?: () => void; t: T }) {
  if (kind === "loading") return <div className={`${CARD} grid place-items-center py-16`}><SpinnerIcon size={18} /></div>;
  const icon: RrIconName = kind === "locked" ? "lock" : kind === "error" ? "info" : "document";
  return (
    <div className={`${CARD} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--bg-surface-subtle)] text-[var(--text-dim)]"><RrIcon name={icon} size={16} /></span>
      <p className="max-w-md text-[13px] leading-relaxed text-[var(--text-dim)]">{text ?? (kind === "error" ? t("num.error") : t("num.empty"))}</p>
      {kind === "error" && onRetry && (
        <button type="button" onClick={onRetry} className="rounded-xl border border-[var(--border-subtle)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]">{t("num.retry")}</button>
      )}
    </div>
  );
}

export type NumCol<R> = {
  key: string;
  label: string;
  align?: "start" | "end";
  /** The row's name — a link when it has a page. First on a phone card. */
  primary?: boolean;
  render: (r: R) => ReactNode;
  /** What the total row shows under this column. */
  foot?: ReactNode;
};

/** A table on a wide screen; on a phone each row is a card — the name, then
 *  each figure under its label. `rowTone` marks a section's own total. */
export function NumbersTable<R>({ cols, rows, rowKey, footLabel, empty, caption, rowTone }: {
  cols: Array<NumCol<R>>; rows: R[]; rowKey: (r: R) => string; footLabel?: ReactNode; empty: string; caption?: ReactNode;
  rowTone?: (r: R) => "sub" | "head" | undefined;
}) {
  const hasFoot = cols.some((c) => c.foot !== undefined);
  const primary = useMemo(() => cols.find((c) => c.primary) ?? cols[0], [cols]);
  const rest = cols.filter((c) => c !== primary);
  return (
    <section className={`${CARD} overflow-hidden`}>
      {caption && <div className="border-b border-[var(--border-subtle)] px-4 py-3 text-[12.5px] text-[var(--text-dim)] sm:px-5">{caption}</div>}
      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-[var(--text-dim)]">{empty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">
                  {cols.map((c) => <th key={c.key} scope="col" className={`px-4 py-2.5 font-semibold first:ps-5 last:pe-5 ${c.align === "end" ? "text-end" : "text-start"}`}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tone = rowTone?.(r);
                  return (
                    <tr key={rowKey(r)} className={`border-b border-[var(--border-subtle)] last:border-b-0 ${tone === "sub" ? "bg-[var(--bg-surface-subtle)] font-semibold" : tone === "head" ? "text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-dim)]" : "hover:bg-[var(--bg-surface-subtle)]"}`}>
                      {cols.map((c) => <td key={c.key} className={`px-4 py-2.5 align-top first:ps-5 last:pe-5 ${c.align === "end" ? "text-end" : "text-start"} ${c.primary ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{c.render(r)}</td>)}
                    </tr>
                  );
                })}
              </tbody>
              {hasFoot && (
                <tfoot>
                  <tr className="border-t border-[var(--border-color)] bg-[var(--bg-surface-subtle)] font-semibold text-[var(--text-primary)]">
                    {cols.map((c, i) => <td key={c.key} className={`px-4 py-3 align-top first:ps-5 last:pe-5 ${c.align === "end" ? "text-end" : "text-start"}`}>{i === 0 && c.foot === undefined ? footLabel : c.foot}</td>)}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)] sm:hidden">
            {rows.map((r) => {
              const tone = rowTone?.(r);
              return (
                <li key={rowKey(r)} className={`px-4 py-3 ${tone === "sub" ? "bg-[var(--bg-surface-subtle)]" : ""}`}>
                  <div className={`text-[13.5px] ${tone ? "font-semibold" : "font-medium"} text-[var(--text-primary)]`}>{primary.render(r)}</div>
                  {rest.length > 0 && tone !== "head" && (
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                      {rest.map((c) => (
                        <div key={c.key} className="min-w-0">
                          <dt className="text-[10.5px] uppercase tracking-[0.05em] text-[var(--text-dim)]">{c.label}</dt>
                          <dd className="text-[var(--text-secondary)]">{c.render(r)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
            {hasFoot && (
              <li className="bg-[var(--bg-surface-subtle)] px-4 py-3">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{footLabel}</div>
                <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                  {rest.filter((c) => c.foot !== undefined && c.foot !== null && c.foot !== "").map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-[10.5px] uppercase tracking-[0.05em] text-[var(--text-dim)]">{c.label}</dt>
                      <dd className="font-semibold text-[var(--text-primary)]">{c.foot}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}

/** A name that opens its record when it has a page. */
export function RowName({ href, children }: { href: string | null; children: ReactNode }) {
  return href
    ? <Link href={href} dir="auto" className="font-medium text-[var(--text-primary)] hover:underline">{children}</Link>
    : <span dir="auto">{children}</span>;
}

export function PrintButton({ t, onClick, disabled }: { t: T; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="kx-hover-glow inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 sm:h-10">
      <RrIcon name="print" size={14} /><span className="hidden sm:inline">{t("num.print")}</span>
    </button>
  );
}

/* The house print recipe lives in ./print-frame (small, so a screen that
   only prints — the Compliance tab — does not load this kit). */
export { printPaper } from "./print-frame";

/** The URL's own parameters, read once the navigation has committed (the
 *  ?tab= trap: a client navigation renders before the URL changes). */
export function readSearch(): URLSearchParams {
  return new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
}

/** Writes the page's state into its URL without a navigation, so a refresh
 *  or a shared link opens the same report and period. */
export function writeSearch(params: Record<string, string | null>) {
  try {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(params)) { if (v) url.searchParams.set(k, v); else url.searchParams.delete(k); }
    window.history.replaceState(window.history.state, "", url.toString());
  } catch { /* no history */ }
}
