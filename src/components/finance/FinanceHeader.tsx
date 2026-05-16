"use client";

/* ---------------------------------------------------------------------------
   FinanceHeader — premium hero strip used at the top of every Finance
   page. Provides a consistent executive feel: page title + subtitle on
   the left, period selector + action button on the right, optional
   financial-health badge underneath, and the FinanceTabs sub-nav
   bottom-aligned so navigation feels integrated, not bolted on.

   The visual language mirrors the rest of Koleex Hub:
     · subtle gradient (var(--bg-secondary) → transparent) for depth
     · rounded-2xl card surface
     · white/0.06 hairline border
     · 10/12 px uppercase 0.12em labels for system metadata
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import FinanceTabs from "@/components/finance/FinanceTabs";

export type HealthStatus = "healthy" | "watch" | "stress" | "unknown";

const HEALTH_STYLE: Record<HealthStatus, { dot: string; chip: string; label: string; hint: string }> = {
  healthy: {
    dot:  "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    label: "Healthy",
    hint: "Profit positive, cash flowing, nothing overdue.",
  },
  watch: {
    dot:  "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    label: "Watch",
    hint: "Some overdue items or tight cash position.",
  },
  stress: {
    dot:  "bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.6)]",
    chip: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    label: "Stress",
    hint: "Negative net profit or major overdue exposure.",
  },
  unknown: {
    dot:  "bg-gray-500",
    chip: "border-white/[0.08] bg-white/5 text-gray-400",
    label: "—",
    hint: "Not enough activity yet to score.",
  },
};

export default function FinanceHeader({
  title,
  subtitle,
  action,
  controls,
  health,
  showTabs = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /* Slot for the Week/Quarter/Year selector or any inline filters. */
  controls?: ReactNode;
  health?: HealthStatus;
  showTabs?: boolean;
}) {
  return (
    <div className="relative">
      {/* Soft accent gradient sitting behind the header — gives the
          Finance app its own subtle "look" without departing from the
          Hub's dark surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, rgba(59,130,246,0.08) 0%, rgba(0,0,0,0) 55%), radial-gradient(80% 60% at 100% 0%, rgba(167,139,250,0.06) 0%, rgba(0,0,0,0) 60%)",
        }}
      />
      <div className="rounded-3xl border border-white/[0.06] bg-[var(--bg-secondary)]/60 px-5 py-5 backdrop-blur-sm sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-[22px] font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">{title}</h1>
              {health && health !== "unknown" && (
                <HealthBadge status={health} />
              )}
            </div>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            {controls}
            {action}
          </div>
        </div>
        {showTabs && (
          <div className="mt-5">
            <FinanceTabs />
          </div>
        )}
      </div>
    </div>
  );
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  const s = HEALTH_STYLE[status];
  return (
    <span
      title={s.hint}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${s.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
