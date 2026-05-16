"use client";

/* ---------------------------------------------------------------------------
   FinanceHeader  —  Phase 1.5 alignment with the Koleex Hub native page
   bar pattern.

   Replaces the previous custom rounded-3xl gradient hero card with the
   compact layout every other Hub app uses: back arrow → app icon →
   h1 page title → small subtitle/count → action button on the right.
   The global MainHeader already renders "KOLEEX Finance" beside the
   logo so this bar focuses on the section heading.

   Below the title bar, a thin secondary row carries the FinanceTabs
   sub-nav (and optional period selector / health badge) — both
   monochrome, sized to match the other Hub app sub-navs.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import Link from "next/link";
import RrIcon from "@/components/ui/RrIcon";
import FinanceTabs from "@/components/finance/FinanceTabs";

export type HealthStatus = "healthy" | "watch" | "stress" | "unknown";

const HEALTH_STYLE: Record<HealthStatus, { dot: string; label: string; hint: string }> = {
  healthy: {
    dot:  "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]",
    label: "Healthy",
    hint: "Profit positive, cash flowing, nothing overdue.",
  },
  watch: {
    dot:  "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.55)]",
    label: "Watch",
    hint: "Some overdue items or tight cash position.",
  },
  stress: {
    dot:  "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.65)]",
    label: "Stress",
    hint: "Negative net profit or major overdue exposure.",
  },
  unknown: {
    dot:  "bg-gray-500",
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
    <div>
      {/* ── Native Hub page bar ─────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            aria-label="Back to Hub"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
          >
            <RrIcon name="arrow-left" size={16} />
          </Link>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
            <RrIcon name="coins" size={16} />
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight md:text-[22px]">{title}</h1>
            {subtitle && (
              <p className="hidden text-[12px] text-[var(--text-dim)] sm:block">{subtitle}</p>
            )}
            {health && health !== "unknown" && (
              <HealthPill status={health} />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          {action}
        </div>
      </div>

      {/* ── Sub-navigation row ──────────────────────────────────── */}
      {showTabs && (
        <div className="mt-5">
          <FinanceTabs />
        </div>
      )}
    </div>
  );
}

/* Compact health pill used in the title row. The bigger HealthBadge
   was reserved for the old hero — this lighter version sits inline
   alongside the title without dominating. */
export function HealthPill({ status }: { status: HealthStatus }) {
  const s = HEALTH_STYLE[status];
  return (
    <span
      title={s.hint}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-gray-300"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* Re-export legacy badge name in case callers reference it. */
export { HealthPill as HealthBadge };
