/* SectionCard — Security Center section container (Phase 2A · A2).
   Read-only, presentational. Brand-aligned hairline card with an uppercase dim
   label, optional icon, and an actions slot. RSC-safe (no client interactivity). */

import type { ReactNode } from "react";

export interface SectionCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function SectionCard({ title, subtitle, icon, actions, children, className = "" }: SectionCardProps) {
  const hasHeader = title || subtitle || actions || icon;
  return (
    <section
      aria-label={typeof title === "string" ? title : undefined}
      className={`rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/60 p-4 ${className}`}
    >
      {hasHeader && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="shrink-0 text-[var(--text-dim)]">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</h2>
              )}
              {subtitle && <p className="mt-0.5 truncate text-xs text-[var(--text-dim)]">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
