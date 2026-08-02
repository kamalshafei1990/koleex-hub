"use client";
/* KDS SectionHeader — ELECTED SH-3 by owner 2026-08-02 (EmployeeForm
   style): icon chip + bold title + muted description, hairline rule
   below. `children` doubles as the title for terse call sites. */
import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  description,
  icon,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 mb-5 pb-4 border-b border-[var(--border-faint)] ${className}`}>
      {icon && (
        <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center text-[var(--text-dim)] shrink-0" aria-hidden>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">{title ?? children}</p>
        {description && <p className="text-[12px] text-[var(--text-dim)] mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}
