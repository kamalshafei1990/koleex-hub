/* ===========================================================================
   Treasury Planning Intelligence — Phase 2.9
   ----------------------------------------------------------------------------
   Compares the current forecast (Phase 2.8) against saved + approved
   treasury plans (Phase 2.9) and synthesises operational events.

   4 event kinds:
     · treasury_plan_expired               — approved plan ≥ 30 days old
     · treasury_plan_vs_actual_divergence  — actual cash diverges
                                              ≥ USD 5K from approved plan
     · unreviewed_treasury_plan            — plan in `under_review` ≥ 7 days
     · approved_plan_liquidity_risk        — approved plan's stored
                                              projection now negative

   Pure function. No DB, no React, no fetch.
   ========================================================================== */

import type { TreasuryPlan, TreasuryPlanMetrics } from "@/lib/finance/types";
import type { ForecastResult } from "./treasury-forecast";
import type { OperationalEvent, Severity } from "./types";
import { stableId } from "./behavior";

const NOW = () => Date.now();

const STALE_PLAN_DAYS = 30;
const UNREVIEWED_PLAN_DAYS = 7;
const DIVERGENCE_MATERIAL_USD = 5_000;

function daysAgo(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((NOW() - t) / 86_400_000));
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export interface PlansSnapshot {
  events: OperationalEvent[];
  /** The active approved plan (most-recent approved row), if any. */
  activePlan: TreasuryPlan | null;
  /** Plan-vs-actual divergence in reporting USD on 90-day cash. */
  divergence: number;
  /** Days since the active plan was approved. */
  activePlanAgeDays: number | null;
  /** Plans sitting in `under_review`. */
  pendingReviewCount: number;
  /** Oldest under-review plan age in days. */
  oldestUnreviewedDays: number;
}

export interface PlansInput {
  plans: TreasuryPlan[];
  currentForecast: ForecastResult | null;
}

export function buildTreasuryPlansSnapshot(input: PlansInput): PlansSnapshot {
  const plans = input.plans ?? [];
  const current = input.currentForecast ?? null;

  if (plans.length === 0) {
    return {
      events: [],
      activePlan: null,
      divergence: 0,
      activePlanAgeDays: null,
      pendingReviewCount: 0,
      oldestUnreviewedDays: 0,
    };
  }

  /* Active approved plan = newest approved row. */
  const approved = plans
    .filter((p) => p.status === "approved" && p.approved_at)
    .sort((a, b) => new Date(b.approved_at!).getTime() - new Date(a.approved_at!).getTime());
  const activePlan = approved[0] ?? null;
  const activePlanAgeDays = activePlan?.approved_at ? Math.floor(daysAgo(activePlan.approved_at)) : null;

  /* Plans sitting under review — single-reviewer flow, but the
     event fires when a plan has been waiting longer than the
     threshold (7 days). */
  const underReview = plans.filter((p) => p.status === "under_review");
  const pendingReviewCount = underReview.length;
  let oldestUnreviewedDays = 0;
  for (const p of underReview) {
    const age = Math.floor(daysAgo(p.updated_at ?? p.created_at));
    if (age > oldestUnreviewedDays) oldestUnreviewedDays = age;
  }

  /* Divergence — compare the active plan's stored d90 against the
     current forecast's d90. We use d90 because it captures the
     full horizon; the chart UI also shows d7/d30/d60 deltas. */
  let divergence = 0;
  if (activePlan && current) {
    const planned = (activePlan.projected_metrics as TreasuryPlanMetrics).d90 ?? 0;
    const actual = current.d90;
    divergence = actual - planned;
  }

  const events: OperationalEvent[] = [];
  const now = NOW();

  /* ── treasury_plan_expired ── */
  if (activePlan && activePlanAgeDays != null && activePlanAgeDays >= STALE_PLAN_DAYS) {
    const severity: Severity = activePlanAgeDays >= 90 ? "risk" : "watch";
    events.push({
      key: stableId(["plan-expired", activePlan.id]),
      source: "treasury",
      kind: "treasury_plan_expired",
      severity,
      magnitude: activePlanAgeDays,
      label: `Approved treasury plan is ${activePlanAgeDays} days old`,
      detail: `"${activePlan.name}" was approved ${activePlanAgeDays} days ago — review or refresh against current treasury state.`,
      ts: now,
    });
  }

  /* ── unreviewed_treasury_plan ── */
  if (oldestUnreviewedDays >= UNREVIEWED_PLAN_DAYS) {
    const severity: Severity = oldestUnreviewedDays >= 21 ? "watch" : "watch";
    events.push({
      key: stableId(["plan-unreviewed"]),
      source: "treasury",
      kind: "unreviewed_treasury_plan",
      severity,
      magnitude: oldestUnreviewedDays,
      label: `${pendingReviewCount} treasury plan${pendingReviewCount === 1 ? "" : "s"} awaiting review`,
      detail: `Oldest plan has been under review for ${oldestUnreviewedDays} days. Decide on approve / request changes / archive.`,
      ts: now,
    });
  }

  /* ── treasury_plan_vs_actual_divergence ── */
  if (activePlan && current && Math.abs(divergence) >= DIVERGENCE_MATERIAL_USD) {
    /* Severity scales with magnitude. A negative divergence (actual
       worse than planned) is more serious. */
    const severity: Severity =
      Math.abs(divergence) >= 50_000 ? "risk" :
      Math.abs(divergence) >= 25_000 ? "watch" :
      "watch";
    const direction = divergence < 0 ? "below" : "above";
    events.push({
      key: stableId(["plan-divergence", activePlan.id]),
      source: "treasury",
      kind: "treasury_plan_vs_actual_divergence",
      severity,
      amount: Math.abs(divergence),
      label: `Treasury diverges by ${fmtCompact(divergence)} USD from approved plan`,
      detail: `90-day cash is ${fmtCompact(Math.abs(divergence))} USD ${direction} the position locked in "${activePlan.name}" on ${activePlan.approved_at?.slice(0, 10) ?? "—"}.`,
      ts: now,
    });
  }

  /* ── approved_plan_liquidity_risk ──
     Fires when the APPROVED plan's *own stored projection* shows a
     negative cash window. That tells the operator the plan was a bad
     plan — independent of whether actual reality diverged. */
  if (activePlan) {
    const m = activePlan.projected_metrics as TreasuryPlanMetrics;
    if (m?.firstNegativeDate && Math.abs(m.lowestProjected ?? 0) >= 1) {
      const severity: Severity = m.runwayDays != null && m.runwayDays <= 14 ? "risk" : "watch";
      events.push({
        key: stableId(["plan-liquidity", activePlan.id]),
        source: "treasury",
        kind: "approved_plan_liquidity_risk",
        severity,
        amount: Math.abs(m.lowestProjected ?? 0),
        magnitude: m.runwayDays ?? 0,
        label: `Approved plan predicts negative cash on ${m.firstNegativeDate}`,
        detail: `Plan "${activePlan.name}" forecasts cash crossing zero in ${m.runwayDays ?? "—"} days; lowest point ${fmtCompact(m.lowestProjected ?? 0)} USD.`,
        ts: now,
      });
    }
  }

  return {
    events,
    activePlan,
    divergence,
    activePlanAgeDays,
    pendingReviewCount,
    oldestUnreviewedDays,
  };
}
