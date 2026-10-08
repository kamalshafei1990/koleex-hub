"use client";

/* Brand Center — small shared pieces of the library screens. */

export const FIELD =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--border-focus)]";

type T = (k: string) => string;

/** "{n} of {m}" → the numbers, written the reader's way. */
export function fill(template: string, vars: Record<string, number | string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (typeof vars[k] === "number" ? (vars[k] as number).toLocaleString() : String(vars[k] ?? "")));
}

export function ImportanceChip({ t, value }: { t: T; value: string }) {
  const strong = value === "core";
  return (
    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${strong ? "border-[var(--border-strong)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-dim)]"}`}>
      {t(`imp.${value}`)}
    </span>
  );
}

export function StatusChip({ t, value }: { t: T; value: string }) {
  const tone = value === "approved" || value === "active" ? "bg-emerald-500/12 text-emerald-500 border-emerald-500/35"
    : value === "retired" ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]";
  return <span className={`inline-flex h-[18px] items-center rounded-full border px-1.5 text-[10px] font-semibold ${tone}`}>{t(`st.${value}`)}</span>;
}
