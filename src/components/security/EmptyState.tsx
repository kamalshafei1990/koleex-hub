/* EmptyState — reassurance-first empty/calm states (Phase 2A · A2).
   Empty = good news, never a broken/blank card. Calm tone; only `error` uses a
   restrained rose title. Optional progress bar (for low-traffic soak). RSC-safe. */

import type { ReactNode } from "react";

export type EmptyVariant = "all_clear" | "low_traffic" | "no_anomalies" | "inactive" | "error";

const COPY: Record<EmptyVariant, { title: string; message: string }> = {
  all_clear: { title: "All clear", message: "No suspicious sign-in activity in this window. Nothing needs your attention." },
  low_traffic: { title: "Building a baseline", message: "Sign-in activity is light so far — observe mode keeps learning. Readiness firms up as more data arrives." },
  no_anomalies: { title: "Nothing unusual", message: "Sign-ins are behaving normally right now." },
  inactive: { title: "Quiet window", message: "No sign-in attempts were recorded here — a calm, healthy default." },
  error: { title: "Couldn’t load", message: "Something went wrong fetching this data. Please try again." },
};

/* Calm default glyph so a positive empty never reads as a broken/blank card. */
const GLYPH: Partial<Record<EmptyVariant, string>> = {
  all_clear: "✓",
  no_anomalies: "✓",
  low_traffic: "◷",
  inactive: "—",
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
  const glyph = GLYPH[variant];

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40 px-6 py-10 text-center ${className}`}
    >
      {icon ? (
        <div className="mb-3 text-[var(--text-dim)]">{icon}</div>
      ) : glyph ? (
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface-hover)] text-[var(--text-dim)]" aria-hidden="true">
          {glyph}
        </div>
      ) : null}
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
