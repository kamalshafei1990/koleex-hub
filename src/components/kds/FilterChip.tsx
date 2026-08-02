"use client";

/* KDS FilterChip — ELECTED FC-1 by owner 2026-08-02 (Products ACTIVE
   row): h-7 pill, focus-border ring, round × remove button. */

export default function FilterChip({
  label,
  onRemove,
  className = "",
}: {
  label: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 ps-3 pe-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-focus)] text-[11px] font-medium text-[var(--text-primary)] ${className}`}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          className="h-5 w-5 rounded-full flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
        >
          <span className="text-[14px] leading-none">×</span>
        </button>
      )}
    </span>
  );
}
