/* TrendPanel — the single trend chart + demoted outcome split (Phase 2A · A3).
   Reuses the finance AreaChart (currency="" → plain counts via formatCompact).
   The donut is retired in favour of a slim success/failed bar. RSC-safe. */

import type { TrendView, OutcomeSplitView, AnalyticsWindow } from "@/lib/security/view-model";
import { AreaChart } from "@/components/finance/charts";
import SectionCard from "./SectionCard";

function formatLabel(iso: string, window: AnalyticsWindow): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return window === "24h"
    ? d.toLocaleTimeString(undefined, { hour: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface TrendPanelProps {
  trend: TrendView;
  outcome: OutcomeSplitView;
  window: AnalyticsWindow;
}

export default function TrendPanel({ trend, outcome, window }: TrendPanelProps) {
  const successPct = (outcome.successPct * 100).toFixed(0);
  const failurePct = (outcome.failurePct * 100).toFixed(0);

  return (
    <SectionCard title="Attempts over time">
      {trend.hasData ? (
        <AreaChart
          height={200}
          currency=""
          labels={trend.labels.map((l) => formatLabel(l, window))}
          series={[
            { name: "Attempts", values: trend.attempts, tone: "info" },
            { name: "Failures", values: trend.failures, tone: "warning" },
          ]}
        />
      ) : (
        <p className="py-10 text-center text-sm text-[var(--text-dim)]">No sign-in activity to chart in this window.</p>
      )}

      {/* Outcome split — replaces the donut. */}
      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-[var(--text-dim)]">
          <span>Outcome split</span>
          <span className="tabular-nums normal-case text-[var(--text-dim)]">
            {outcome.successes} ok · {outcome.failures} failed
          </span>
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-hover)]" aria-hidden="true">
          <div className="h-full bg-[var(--text-dim)]" style={{ width: `${successPct}%` }} />
          <div className="h-full bg-amber-400/70" style={{ width: `${failurePct}%` }} />
        </div>
      </div>
    </SectionCard>
  );
}
