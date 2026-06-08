/* EmptyState — reassurance-first empty/calm states (Phase 2A · A2).
   Empty = good news, never a broken/blank card. Calm tone; only `error` uses a
   restrained rose title. Optional progress bar (for low-traffic soak). RSC-safe. */

import type { ReactNode } from "react";

export type EmptyVariant = "all_clear" | "low_traffic" | "no_anomalies" | "inactive" | "error";

const COPY: Record<EmptyVariant, { title: string; message: string }> = {
  all_clear: { title: "All clear", message: "No suspicious sign-in activity in this window." },
  low_traffic: { title: "Building a baseline", message: "Limited sign-in activity so far — keep observing to gain confidence." },
  no_anomalies: { title: "No anomalies", message: "Nothing here needs your attention right now." },
  inactive: { title: "No activity", message: "No sign-in attempts were recorded in this window." },
  error: { title: "Couldn’t load", message: "Something went wrong fetching this data. Please try again." },
};

export interface EmptyStateProps {
  variant: EmptyVariant;
  title?: string;
  message?: string;
  icon?: ReactNode;
  /** 0..1 — renders a quiet progress bar (meaningful for low_traffic). */
  progress?: number;
  className?: string;
}

export default function EmptyState({ variant, title, message, icon, progress, className = "" }: EmptyStateProps) {
  const copy = COPY[variant];
  const isError = variant === "error";
  const pct = typeof progress === "number" ? Math.max(0, Math.min(1, progress)) : null;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40 px-6 py-10 text-center ${className}`}
    >
      {icon && <div className="mb-3 text-[var(--text-dim)]">{icon}</div>}
      <p className={`text-sm font-semibold ${isError ? "text-rose-300" : "text-[var(--text-primary)]"}`}>
        {title ?? copy.title}
      </p>
      <p className="mt-1 max-w-sm text-sm text-[var(--text-dim)]">{message ?? copy.message}</p>
      {pct !== null && (
        <div className="mt-4 w-full max-w-xs">
          <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]">
            <div className="h-full rounded-full bg-[var(--text-dim)]" style={{ width: `${(pct * 100).toFixed(0)}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-dim)]">{(pct * 100).toFixed(0)}% toward a confident baseline</p>
        </div>
      )}
    </div>
  );
}
