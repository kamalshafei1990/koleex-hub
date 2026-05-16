/* ===========================================================================
   Phase 2.0.2  —  Intelligence Validation Runner

   runIntelligenceValidation() walks every deterministic scenario,
   builds the real intelligence pipeline against its inputs, runs the
   assertions, and returns a structured ValidationReport.

   The report doubles as calibration telemetry — false positive /
   negative rates, digest density, health volatility, severity
   distribution — so future calibration passes have an objective
   measurement to move.

   Pure: no fetch, no DB, no React. Safe to run in Node, in a Vercel
   build step, or from a CLI.
   ========================================================================== */

import { buildIntelligence, type IntelligencePicture } from "@/lib/intelligence";
import { assertScenario, type ValidationIssue } from "./assertions";
import { ALL_SCENARIOS, type Scenario } from "./scenarios";
import type { Severity } from "../types";

export interface ScenarioResult {
  name: string;
  description: string;
  passed: boolean;
  failures: ValidationIssue[];
  warnings: ValidationIssue[];
  picture: IntelligencePicture;
  metrics: {
    eventCount: number;
    correlationCount: number;
    digestCount: number;
    copilotCount: number;
    healthScore: number;
    healthPressure: string;
    averageCorrelationConfidence: number;
  };
}

export interface ValidationReport {
  scenarios: ScenarioResult[];
  summary: ValidationSummary;
}

export interface ValidationSummary {
  totalScenarios: number;
  passed: number;
  failed: number;
  totalAssertions: number;
  totalFailures: number;
  totalWarnings: number;
  /** Average digest items per scenario. Calmer is better. */
  digestDensity: number;
  /** Average confidence across all correlations. */
  averageConfidence: number;
  /** Severity distribution across all surviving events. */
  severityDistribution: Record<Severity, number>;
  /** Max health swing observed when running consecutive scenarios. */
  healthVolatility: number;
  /** Proxy false-positive rate — assertions classified as
   *  fail due to forbidden events / forbidden phrases / over-flooding. */
  falsePositiveRate: number;
  /** Proxy false-negative rate — assertions classified as fail
   *  due to expected events missing / digest under floor. */
  falseNegativeRate: number;
}

/* ---------------------------------------------------------------------------
   Runner
   --------------------------------------------------------------------------- */

export function runIntelligenceValidation(scenarios: Scenario[] = ALL_SCENARIOS()): ValidationReport {
  const results: ScenarioResult[] = [];
  let priorHealth: number | null = null;
  let healthVolatility = 0;

  for (const scenario of scenarios) {
    const picture = buildIntelligence(scenario.inputs);
    const issues = assertScenario(scenario, picture);
    const failures = issues.filter((i) => i.level === "fail");
    const warnings = issues.filter((i) => i.level === "warn");

    /* Track health swing between consecutive scenarios. */
    if (priorHealth != null) {
      healthVolatility = Math.max(healthVolatility, Math.abs(picture.health.composite - priorHealth));
    }
    priorHealth = picture.health.composite;

    const avgConf = picture.correlations.length > 0
      ? picture.correlations.reduce((s, c) => s + (c.confidence ?? 0), 0) / picture.correlations.length
      : 0;

    results.push({
      name: scenario.name,
      description: scenario.description,
      passed: failures.length === 0,
      failures,
      warnings,
      picture,
      metrics: {
        eventCount: picture.events.length,
        correlationCount: picture.correlations.length,
        digestCount: picture.digest.length,
        copilotCount: picture.copilotHints.length,
        healthScore: picture.health.composite,
        healthPressure: picture.health.pressure,
        averageCorrelationConfidence: Math.round(avgConf * 100) / 100,
      },
    });
  }

  /* ── Aggregate summary ─────────────────────────────────────────────── */
  const totalAssertions = results.reduce((s, r) => s + r.failures.length + r.warnings.length, 0);
  const totalFailures   = results.reduce((s, r) => s + r.failures.length, 0);
  const totalWarnings   = results.reduce((s, r) => s + r.warnings.length, 0);

  const digestDensity = results.reduce((s, r) => s + r.metrics.digestCount, 0) / Math.max(1, results.length);
  const confs = results.flatMap((r) => r.picture.correlations.map((c) => c.confidence ?? 0));
  const averageConfidence = confs.length === 0 ? 0 : confs.reduce((s, c) => s + c, 0) / confs.length;

  const severityDistribution: Record<Severity, number> = { critical: 0, risk: 0, watch: 0, info: 0 };
  for (const r of results) for (const e of r.picture.events) severityDistribution[e.severity] += 1;

  /* False-positive proxy: failures in `events` category caused by
     "forbidden event present" wording. False-negative proxy:
     failures in `events` caused by "missing" or in `digest` caused
     by "below floor". */
  let fpCount = 0;
  let fnCount = 0;
  for (const r of results) {
    for (const f of r.failures) {
      const m = f.message.toLowerCase();
      if (m.includes("forbidden") || m.includes("above") || m.includes("exceeded")) fpCount += 1;
      else if (m.includes("missing") || m.includes("below") || m.includes("at least")) fnCount += 1;
    }
  }
  const denom = Math.max(1, totalFailures);

  return {
    scenarios: results,
    summary: {
      totalScenarios: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      totalAssertions,
      totalFailures,
      totalWarnings,
      digestDensity: Math.round(digestDensity * 100) / 100,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      severityDistribution,
      healthVolatility,
      falsePositiveRate: Math.round((fpCount / denom) * 100) / 100,
      falseNegativeRate: Math.round((fnCount / denom) * 100) / 100,
    },
  };
}

/* ---------------------------------------------------------------------------
   Health stability stress — feed the SAME baseline through small and
   large perturbations and confirm the smoothed health score moves
   proportionally (small change → small move; large change → capped
   move, never a swing > 12 between consecutive runs).
   --------------------------------------------------------------------------- */

export interface HealthStabilityResult {
  baselineScore: number;
  smallChangeScore: number;
  largeDeteriorationScore: number;
  smallDelta: number;
  largeDelta: number;
  /** Cap is ±12 per Phase 2.0.1; this should never exceed it. */
  withinCap: boolean;
}

export function runHealthStability(baseline: Scenario, perturbedSmall: Scenario, perturbedLarge: Scenario): HealthStabilityResult {
  const a = buildIntelligence(baseline.inputs);
  const small = buildIntelligence({ ...perturbedSmall.inputs, memory: a.nextMemory });
  const large = buildIntelligence({ ...perturbedLarge.inputs, memory: small.nextMemory });
  const smallDelta = Math.abs(small.health.composite - a.health.composite);
  const largeDelta = Math.abs(large.health.composite - small.health.composite);
  return {
    baselineScore: a.health.composite,
    smallChangeScore: small.health.composite,
    largeDeteriorationScore: large.health.composite,
    smallDelta,
    largeDelta,
    withinCap: smallDelta <= 12 && largeDelta <= 12,
  };
}

/* ---------------------------------------------------------------------------
   Pretty-print helper for CLI / dev consumption. Returns a string;
   callers decide whether to console.log it.
   --------------------------------------------------------------------------- */

export function formatReport(report: ValidationReport): string {
  const lines: string[] = [];
  lines.push("══════════════════════════════════════════════════════════════════════");
  lines.push("  KOLEEX HUB · Operational Intelligence Validation Report");
  lines.push("══════════════════════════════════════════════════════════════════════");
  lines.push("");
  for (const r of report.scenarios) {
    const tag = r.passed ? "PASS" : "FAIL";
    lines.push(`[${tag}]  ${r.name}`);
    lines.push(`        ${r.description}`);
    lines.push(`        health=${r.metrics.healthScore} (${r.metrics.healthPressure})`
      + `  events=${r.metrics.eventCount}`
      + `  correlations=${r.metrics.correlationCount}`
      + `  digest=${r.metrics.digestCount}`
      + `  copilot=${r.metrics.copilotCount}`);
    if (r.metrics.averageCorrelationConfidence > 0) {
      lines.push(`        avg correlation confidence: ${r.metrics.averageCorrelationConfidence}`);
    }
    for (const f of r.failures) lines.push(`        FAIL  [${f.category}] ${f.message}`);
    for (const w of r.warnings) lines.push(`        WARN  [${w.category}] ${w.message}`);
    lines.push("");
  }
  const s = report.summary;
  lines.push("──────────────────────────────────────────────────────────────────────");
  lines.push("  Summary");
  lines.push("──────────────────────────────────────────────────────────────────────");
  lines.push(`  Scenarios:            ${s.passed} passed / ${s.failed} failed (of ${s.totalScenarios})`);
  lines.push(`  Failures / Warnings:  ${s.totalFailures} fail · ${s.totalWarnings} warn`);
  lines.push(`  Digest density:       ${s.digestDensity} items/scenario`);
  lines.push(`  Avg correlation conf: ${s.averageConfidence}`);
  lines.push(`  Severity dist:        critical=${s.severityDistribution.critical}  risk=${s.severityDistribution.risk}  watch=${s.severityDistribution.watch}  info=${s.severityDistribution.info}`);
  lines.push(`  Health volatility:    ${s.healthVolatility} (max swing across scenarios)`);
  lines.push(`  FP rate:              ${s.falsePositiveRate}`);
  lines.push(`  FN rate:              ${s.falseNegativeRate}`);
  lines.push("══════════════════════════════════════════════════════════════════════");
  return lines.join("\n");
}
