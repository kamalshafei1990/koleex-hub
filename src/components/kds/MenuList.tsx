"use client";

/* KDS MenuList — ELECTED MN-4 by owner 2026-08-02 (combobox listbox
   style): rounded-lg bordered bg-secondary panel, full-bleed rows,
   active row = bg-surface. Position the wrapper yourself (absolute +
   anchor); this component is the visual shell. */

export function MenuItem({
  active,
  destructive,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; destructive?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`w-full text-start px-3 py-2 text-[13px] transition-colors ${
        destructive
          ? "text-red-400 hover:bg-red-500/10"
          : active
            ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default function MenuList({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`max-h-52 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl ${className}`}>
      {children}
    </div>
  );
}
