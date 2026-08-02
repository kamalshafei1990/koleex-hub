"use client";

/* KDS Pagination — ELECTED PG-1 by owner 2026-08-02 (server-list
   style): summary on the start side, Prev / Page N of M / Next on the
   end side. Tailwind re-expression of the inline-styled original. */

export default function Pagination({
  page,
  pages,
  summary,
  onPrev,
  onNext,
  prevLabel = "Prev",
  nextLabel = "Next",
  className = "",
}: {
  page: number;
  pages: number;
  summary?: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  prevLabel?: string;
  nextLabel?: string;
  className?: string;
}) {
  const btn =
    "px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] transition-colors hover:border-[var(--border-color)] disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <div className={`flex items-center justify-between gap-3 flex-wrap text-[13px] text-[var(--text-secondary)] ${className}`}>
      <span>{summary}</span>
      <span className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={onPrev}>{prevLabel}</button>
        <span className="tabular-nums">Page {page} / {Math.max(1, pages)}</span>
        <button type="button" className={btn} disabled={page >= pages} onClick={onNext}>{nextLabel}</button>
      </span>
    </div>
  );
}
