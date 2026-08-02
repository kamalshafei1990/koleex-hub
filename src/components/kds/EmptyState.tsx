/* KDS EmptyState — ELECTED ES-3 by owner 2026-08-02 (Database style):
   dashed border = "a slot waiting to be filled", surface-subtle wash,
   centered icon / title / hint, optional action (use kds Button). */

export default function EmptyState({
  icon,
  title,
  hint,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-6 py-16 text-center ${className}`}
    >
      {icon && <div className="text-[var(--text-dim)]">{icon}</div>}
      <p className={`text-[13px] font-medium text-[var(--text-muted)] ${icon ? "mt-3" : ""}`}>{title}</p>
      {hint && <p className="mt-1 text-[12px] text-[var(--text-dim)]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
