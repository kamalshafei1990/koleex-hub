/* ===========================================================================
   Phase 2.0.2  —  Validation Assertions

   Pure functions that compare an IntelligencePicture against a
   ScenarioExpectations spec and return a list of ValidationIssues.

   Each assertion produces a single issue (or none) so callers can
   read the failure list as a punch-list rather than a wall of text.
   ========================================================================== */

import type { IntelligencePicture } from "@/lib/intelligence";
import type { Severity } from "../types";
import type { Scenario, ScenarioExpectations } from "./scenarios";

export type IssueLevel = "fail" | "warn";

export interface ValidationIssue {
  level: IssueLevel;
  scenario: string;
  category: "digest" | "events" | "health" | "correlations" | "copilot" | "language";
  message: string;
}

const SEV_RANK: Record<Severity, number> = { critical: 0, risk: 1, watch: 2, info: 3 };

/* ---------------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------------- */

function fail(scenario: string, category: ValidationIssue["category"], message: string): ValidationIssue {
  return { level: "fail", scenario, category, message };
}

function warn(scenario: string, category: ValidationIssue["category"], message: string): ValidationIssue {
  return { level: "warn", scenario, category, message };
}

/* ---------------------------------------------------------------------------
   The full validation runner for one (scenario, picture) pair.
   --------------------------------------------------------------------------- */

export function assertScenario(scenario: Scenario, picture: IntelligencePicture): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const e: ScenarioExpectations = scenario.expectations;

  /* ── Digest ─────────────────────────────────────────────────────────── */
  if (e.digestRange) {
    const [lo, hi] = e.digestRange;
    if (picture.digest.length < lo) {
      out.push(fail(scenario.name, "digest", `Digest has ${picture.digest.length} item(s); expected at least ${lo}.`));
    }
    if (picture.digest.length > hi) {
      out.push(fail(scenario.name, "digest", `Digest has ${picture.digest.length} item(s); expected at most ${hi}.`));
    }
  }
  if (picture.digest.length > 5) {
    out.push(fail(scenario.name, "digest", `Digest exceeded the absolute cap of 5 items (${picture.digest.length}).`));
  }
  if (e.maxCriticalDigestItems != null) {
    const critical = picture.digest.filter((d) => d.severity === "critical" || d.severity === "risk").length;
    if (critical > e.maxCriticalDigestItems) {
      out.push(fail(scenario.name, "digest", `${critical} risk/critical digest item(s); expected at most ${e.maxCriticalDigestItems}.`));
    }
  }
  /* No-duplicate-headline rule. */
  const headlines = new Set<string>();
  for (const d of picture.digest) {
    if (headlines.has(d.headline)) {
      out.push(fail(scenario.name, "digest", `Duplicate digest headline: "${d.headline}".`));
    }
    headlines.add(d.headline);
  }

  /* ── Events ─────────────────────────────────────────────────────────── */
  if (e.eventRange) {
    const [lo, hi] = e.eventRange;
    if (picture.events.length < lo) {
      out.push(warn(scenario.name, "events", `Events count ${picture.events.length} below expected floor ${lo}.`));
    }
    if (picture.events.length > hi) {
      out.push(fail(scenario.name, "events", `Events count ${picture.events.length} above expected ceiling ${hi}.`));
    }
  }
  if (e.expectEventKinds) {
    const kinds = new Set(picture.events.map((ev) => ev.kind));
    for (const k of e.expectEventKinds) {
      if (!kinds.has(k)) {
        out.push(fail(scenario.name, "events", `Expected event kind "${k}" missing from output.`));
      }
    }
  }
  if (e.forbidEventKinds) {
    for (const k of e.forbidEventKinds) {
      const found = picture.events.filter((ev) => ev.kind === k);
      if (found.length > 0) {
        out.push(fail(scenario.name, "events", `Forbidden event kind "${k}" present (${found.length}).`));
      }
    }
  }

  /* ── Correlations ───────────────────────────────────────────────────── */
  if (e.maxCorrelationSeverity) {
    const cap = SEV_RANK[e.maxCorrelationSeverity];
    for (const c of picture.correlations) {
      if (SEV_RANK[c.severity] < cap) {
        out.push(fail(scenario.name, "correlations", `Correlation "${c.headline}" severity ${c.severity} exceeds ceiling ${e.maxCorrelationSeverity}.`));
      }
    }
  }
  if (e.minCorrelationConfidence != null) {
    for (const c of picture.correlations) {
      const conf = c.confidence ?? 0;
      if (conf < e.minCorrelationConfidence) {
        out.push(fail(scenario.name, "correlations", `Correlation "${c.headline}" confidence ${conf.toFixed(2)} below minimum ${e.minCorrelationConfidence}.`));
      }
    }
  }
  /* Each correlation must cite ≥ 2 supporting events; otherwise the
     narrative is single-signal. */
  for (const c of picture.correlations) {
    if ((c.evidenceCount ?? c.sources.length) < 2) {
      out.push(fail(scenario.name, "correlations", `Correlation "${c.headline}" has fewer than 2 supporting signals.`));
    }
  }

  /* ── Health ─────────────────────────────────────────────────────────── */
  if (e.healthRange) {
    const [lo, hi] = e.healthRange;
    if (picture.health.composite < lo) {
      out.push(fail(scenario.name, "health", `Health ${picture.health.composite} below floor ${lo}.`));
    }
    if (picture.health.composite > hi) {
      out.push(fail(scenario.name, "health", `Health ${picture.health.composite} above ceiling ${hi}.`));
    }
  }
  if (picture.health.composite < 0 || picture.health.composite > 100) {
    out.push(fail(scenario.name, "health", `Health composite out of 0..100 bounds: ${picture.health.composite}.`));
  }

  /* ── Copilot ────────────────────────────────────────────────────────── */
  if (e.copilotMaxHints != null && picture.copilotHints.length > e.copilotMaxHints) {
    out.push(fail(scenario.name, "copilot", `Copilot returned ${picture.copilotHints.length} hints; max ${e.copilotMaxHints}.`));
  }
  if (e.copilotCalm) {
    if (picture.copilotHints.length !== 1 || picture.copilotHints[0].severity !== "info") {
      out.push(fail(scenario.name, "copilot", `Expected calm Copilot (1 info hint); got ${picture.copilotHints.length} hint(s).`));
    }
  }
  /* No duplicate hint texts. */
  const seenTexts = new Set<string>();
  for (const h of picture.copilotHints) {
    if (seenTexts.has(h.text)) {
      out.push(fail(scenario.name, "copilot", `Duplicate Copilot hint text: "${h.text.slice(0, 60)}…".`));
    }
    seenTexts.add(h.text);
  }

  /* ── Language (forbidden phrases anywhere narrative is rendered) ──── */
  if (e.forbiddenPhrases && e.forbiddenPhrases.length > 0) {
    const allText = [
      ...picture.digest.map((d) => d.headline + " " + d.narrative),
      ...picture.correlations.map((c) => c.headline + " " + c.narrative),
      ...picture.copilotHints.map((h) => h.text),
      ...picture.health.dimensions.map((d) => d.driver),
      picture.health.headline,
    ].join(" ").toLowerCase();
    for (const phrase of e.forbiddenPhrases) {
      if (allText.includes(phrase.toLowerCase())) {
        out.push(fail(scenario.name, "language", `Forbidden phrase present anywhere in output: "${phrase}".`));
      }
    }
  }

  return out;
}
