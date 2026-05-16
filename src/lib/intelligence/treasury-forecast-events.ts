/* ===========================================================================
   Forecast → OperationalEvent synthesis (Phase 2.8)
   ----------------------------------------------------------------------------
   Reads a base ForecastResult + (optionally) a stress ForecastDiff and
   produces the 6 forecast-aware operational events.

   The materiality rule is strict: events only fire when a concrete
   number crosses a threshold the dashboard would care about. We never
   emit a "forecast is fine" event — silence is the baseline.

   Pure function. Same shape as every other Phase 2.x snapshot.
   ========================================================================== */

import type {
  ForecastResult,
  ForecastDiff,
  ScenarioAssumptions,
} from "./treasury-forecast";
import type { OperationalEvent, Severity } from "./types";
import { stableId } from "./behavior";

export interface ForecastSnapshot {
  events: OperationalEvent[];
  base: ForecastResult | null;
  stress: ForecastResult | null;
  diff: ForecastDiff | null;
  assumptions: ScenarioAssumptions | null;
}

const NOW = () => Date.now();

const NEGATIVE_CASH_MATERIAL_USD = 5_000;
const SCENARIO_SHOCK_MATERIAL_USD = 5_000;
const RUNWAY_WATCH_DAYS = 30;
const RUNWAY_RISK_DAYS = 14;
const RUNWAY_CRITICAL_DAYS = 7;

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export interface ForecastEventInput {
  base: ForecastResult;
  stress?: ForecastResult | null;
  diff?: ForecastDiff | null;
  assumptions?: ScenarioAssumptions | null;
}

export function buildForecastEvents(input: ForecastEventInput): ForecastSnapshot {
  const { base, stress, diff, assumptions } = input;
  const events: OperationalEvent[] = [];
  const now = NOW();

  /* ── forecast_negative_cash ── */
  if (base.firstNegativeDate && Math.abs(base.lowestProjected) >= NEGATIVE_CASH_MATERIAL_USD) {
    const severity: Severity =
      base.runwayDays != null && base.runwayDays <= RUNWAY_CRITICAL_DAYS ? "critical"
      : base.runwayDays != null && base.runwayDays <= RUNWAY_RISK_DAYS ? "risk"
      : "watch";
    events.push({
      key: stableId(["forecast-negative-cash"]),
      source: "treasury",
      kind: "forecast_negative_cash",
      severity,
      amount: Math.abs(base.lowestProjected),
      magnitude: base.runwayDays ?? 0,
      label: `Cash projected negative on ${base.firstNegativeDate}`,
      detail: `Base-case forecast crosses zero in ${base.runwayDays ?? "—"} days; lowest projected position ${fmtCompact(base.lowestProjected)} USD.`,
      ts: now,
    });
  }

  /* ── forecast_runway_risk — runway exists but inside the watch band. */
  if (base.runwayDays != null && base.runwayDays > RUNWAY_CRITICAL_DAYS && base.runwayDays <= RUNWAY_WATCH_DAYS) {
    const severity: Severity =
      base.runwayDays <= RUNWAY_RISK_DAYS ? "risk" : "watch";
    events.push({
      key: stableId(["forecast-runway"]),
      source: "treasury",
      kind: "forecast_runway_risk",
      severity,
      magnitude: base.runwayDays,
      label: `Cash runway ${base.runwayDays} days`,
      detail: `Forward projection runs out in ${base.runwayDays} days at current expected inflow/outflow profile.`,
      ts: now,
    });
  }

  /* ── scenario_liquidity_shock + targeted variants ── */
  if (stress && diff && assumptions) {
    const impactUsd = Math.abs(diff.d90Delta);
    if (impactUsd >= SCENARIO_SHOCK_MATERIAL_USD && diff.direction === "deteriorates") {
      const severity: Severity =
        stress.firstNegativeDate && !base.firstNegativeDate ? "risk" :
        impactUsd >= 50_000 ? "risk" :
        "watch";
      events.push({
        key: stableId(["forecast-shock"]),
        source: "treasury",
        kind: "scenario_liquidity_shock",
        severity,
        amount: impactUsd,
        label: `Stress scenario reduces 90-day cash by ${fmtCompact(impactUsd)} USD`,
        detail: `Applied assumptions: ${stress.assumptions.map((a) => a.label).join("; ")}. 90-day cash falls from ${fmtCompact(base.d90)} to ${fmtCompact(stress.d90)} USD.`,
        ts: now,
      });
    }

    /* — customer_delay_cash_risk — */
    if (assumptions.customerDelay && assumptions.customerDelay.days > 0) {
      const targeted = stress.assumptions.find((a) => a.key === "customer_delay");
      if (targeted && targeted.cashImpact >= SCENARIO_SHOCK_MATERIAL_USD) {
        const severity: Severity =
          stress.firstNegativeDate && !base.firstNegativeDate ? "risk" :
          targeted.cashImpact >= 50_000 ? "risk" :
          "watch";
        events.push({
          key: stableId(["forecast-customer-delay"]),
          source: "treasury",
          kind: "customer_delay_cash_risk",
          severity,
          amount: targeted.cashImpact,
          label: `${assumptions.customerDelay.days}d customer delay shifts ${fmtCompact(targeted.cashImpact)} USD`,
          detail: `${targeted.label}. ${stress.firstNegativeDate ? `Cash turns negative on ${stress.firstNegativeDate}.` : `Lowest projected position drops by ${fmtCompact(diff.lowestDelta)} USD.`}`,
          ts: now,
        });
      }
    }

    /* — fx_shock_cash_risk — */
    if (assumptions.fxShock && Math.abs(assumptions.fxShock.pct) > 0) {
      const targeted = stress.assumptions.find((a) => a.key === "fx_shock");
      if (targeted && targeted.cashImpact >= SCENARIO_SHOCK_MATERIAL_USD) {
        const severity: Severity = targeted.cashImpact >= 25_000 ? "risk" : "watch";
        events.push({
          key: stableId(["forecast-fx-shock"]),
          source: "treasury",
          kind: "fx_shock_cash_risk",
          severity,
          amount: targeted.cashImpact,
          label: `FX shock ${assumptions.fxShock.pct}% costs ${fmtCompact(targeted.cashImpact)} USD`,
          detail: `${targeted.label}. Treasury sits in mixed-currency positions; a ${assumptions.fxShock.pct}% adverse move on ${assumptions.fxShock.currency ?? "all non-USD"} flows reduces 90-day cash by ${fmtCompact(targeted.cashImpact)} USD.`,
          ts: now,
        });
      }
    }

    /* — supplier_acceleration_risk — */
    if (assumptions.supplierAcceleration && assumptions.supplierAcceleration.days > 0) {
      const targeted = stress.assumptions.find((a) => a.key === "supplier_acceleration");
      if (targeted && targeted.cashImpact >= SCENARIO_SHOCK_MATERIAL_USD) {
        const severity: Severity = targeted.cashImpact >= 50_000 ? "risk" : "watch";
        events.push({
          key: stableId(["forecast-supplier-accel"]),
          source: "treasury",
          kind: "supplier_acceleration_risk",
          severity,
          amount: targeted.cashImpact,
          label: `Supplier acceleration of ${assumptions.supplierAcceleration.days}d pulls ${fmtCompact(targeted.cashImpact)} USD forward`,
          detail: `${targeted.label}. ${stress.runwayDays != null && stress.runwayDays !== base.runwayDays ? `Runway moves to ${stress.runwayDays}d.` : `Lowest projected position drops by ${fmtCompact(diff.lowestDelta)} USD.`}`,
          ts: now,
        });
      }
    }
  }

  return {
    events,
    base,
    stress: stress ?? null,
    diff: diff ?? null,
    assumptions: assumptions ?? null,
  };
}
