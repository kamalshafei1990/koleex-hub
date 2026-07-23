/* ---------------------------------------------------------------------------
   Behavior scoring engine — pure functions, shared by the employee form (live
   preview), the HR assessment workspace, and the server (persisted totals).
   One module = client and server can never disagree.

   Deliberately SEPARATE from src/lib/skills/scoring.ts. Skills measure what an
   employee can do; behavior measures how they conduct themselves. Their scores
   are never combined in this phase.

   Invariants:
   · score NULL = not assessed. score 0 = a valid "Unacceptable" assessment.
     Never collapse the two.
   · A critical indicator below its requirement is surfaced NO MATTER how high
     the overall average is — a good average must never hide a critical gap.
   · Totals are normalized weighted averages, bounded 0–100, count-independent.
   --------------------------------------------------------------------------- */

export type BehaviorLevel =
  | "Unacceptable" | "Poor" | "Needs Improvement" | "Acceptable" | "Strong" | "Exemplary";

/** 0-19 Unacceptable · 20-39 Poor · 40-59 Needs Improvement · 60-74 Acceptable
    · 75-89 Strong · 90-100 Exemplary */
export function behaviorLevel(score: number): BehaviorLevel {
  if (score >= 90) return "Exemplary";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Acceptable";
  if (score >= 40) return "Needs Improvement";
  if (score >= 20) return "Poor";
  return "Unacceptable";
}

export function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** One assessed indicator. `categoryId` lets us derive category scores. */
export interface BehaviorItem {
  /** NULL = unassessed. */
  score: number | null;
  weight?: number | null;
  /** Position requirement; null for additional indicators. */
  requiredScore?: number | null;
  isMandatory?: boolean;
  isCritical?: boolean;
  categoryId?: string;
}

function safeWeight(w: number | null | undefined): number {
  if (w == null || Number.isNaN(w) || w < 0) return 1;
  return w;
}

/** Normalized weighted average of ASSESSED scores. NULL excluded. Returns null
    when nothing is assessed (no score is not a score of 0). */
export function weightedScore(rows: readonly BehaviorItem[]): number | null {
  let sum = 0, wsum = 0;
  for (const r of rows) {
    if (r.score == null) continue;
    const w = safeWeight(r.weight);
    sum += clampScore(r.score) * w;
    wsum += w;
  }
  if (wsum === 0) {
    const assessed = rows.filter((r) => r.score != null);
    if (!assessed.length) return null;
    return Math.round(assessed.reduce((a, r) => a + clampScore(r.score!), 0) / assessed.length);
  }
  return Math.round(sum / wsum);
}

/** Weighted average of the REQUIRED scores this position demands. */
export function requiredScoreAvg(rows: readonly BehaviorItem[]): number | null {
  let sum = 0, wsum = 0;
  for (const r of rows) {
    if (r.requiredScore == null) continue;
    const w = safeWeight(r.weight);
    sum += clampScore(r.requiredScore) * w;
    wsum += w;
  }
  return wsum === 0 ? null : Math.round(sum / wsum);
}

/** Position Behavior Match %: weighted mean of per-indicator achievement
    ratios, each CAPPED at 1 — overperformance in one behavior cannot beyond
    100% compensate for a gap in another. required 0 = achieved; unassessed
    requirement = unmet. */
export function matchPercentage(rows: readonly BehaviorItem[]): number | null {
  const req = rows.filter((r) => r.requiredScore != null);
  if (!req.length) return null;
  let sum = 0, wsum = 0;
  for (const r of req) {
    const w = safeWeight(r.weight);
    const rq = clampScore(r.requiredScore!);
    const ratio = rq === 0 ? 1 : r.score == null ? 0 : Math.min(clampScore(r.score) / rq, 1);
    sum += ratio * w;
    wsum += w;
  }
  if (wsum === 0) {
    const ratios = req.map((r) => {
      const rq = clampScore(r.requiredScore!);
      return rq === 0 ? 1 : r.score == null ? 0 : Math.min(clampScore(r.score) / rq, 1);
    });
    return Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100);
  }
  return Math.round((sum / wsum) * 100);
}

export type GapStatus = "meets" | "below" | "unassessed";

export function gapStatus(row: BehaviorItem): GapStatus | null {
  if (row.requiredScore == null) return null;
  if (row.score == null) return "unassessed";
  return clampScore(row.score) >= clampScore(row.requiredScore) ? "meets" : "below";
}

/** A critical gap = a critical indicator whose assessed score is BELOW its
    requirement. Unassessed critical indicators are NOT counted as gaps (there
    is nothing to fail yet) but callers may surface them separately. */
export function isCriticalGap(row: BehaviorItem): boolean {
  if (!row.isCritical || row.requiredScore == null || row.score == null) return false;
  return clampScore(row.score) < clampScore(row.requiredScore);
}

export interface CategoryScore {
  categoryId: string;
  score: number | null;
  assessed: number;
  /** Total indicators of this category present in the assessment. */
  total: number;
  gaps: number;
  criticalGaps: number;
}

/** Per-category weighted averages + gap counts. */
export function categoryScores(rows: readonly BehaviorItem[]): CategoryScore[] {
  const byCat = new Map<string, BehaviorItem[]>();
  for (const r of rows) {
    const c = r.categoryId ?? "?";
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(r);
  }
  return [...byCat.entries()].map(([categoryId, items]) => ({
    categoryId,
    score: weightedScore(items),
    assessed: items.filter((i) => i.score != null).length,
    total: items.length,
    gaps: items.filter((i) => gapStatus(i) === "below").length,
    criticalGaps: items.filter(isCriticalGap).length,
  }));
}

/** A category is a fair candidate for "strongest/weakest" only when it has
    enough assessed depth — one indicator scored 100 must not crown a whole
    category over a thoroughly-assessed one. */
export const MIN_CATEGORY_ASSESSED = 3;
export function categoryQualifies(c: CategoryScore): boolean {
  if (c.score == null) return false;
  return c.assessed >= MIN_CATEGORY_ASSESSED || (c.total > 0 && c.assessed / c.total >= 0.6);
}

export interface BehaviorSummary {
  overallScore: number | null;
  requiredScore: number | null;
  matchPct: number | null;
  meets: number;
  below: number;
  unassessed: number;
  mandatoryGaps: number;
  criticalGaps: number;
  /** Critical indicators below requirement — the ones that must be surfaced. */
  criticalAlerts: BehaviorItem[];
  /** ── Coverage: a high average on a handful of indicators is misleading, so
     the summary always carries how much of the assessment is actually done. */
  total: number;
  assessed: number;
  coveragePct: number | null;
  /** Critical / mandatory indicators NOT yet assessed. Distinct from gaps: an
     unassessed critical isn't a failure yet, but "Critical Gaps: 0" while
     criticals are unmeasured is dangerous — so it is counted separately. */
  criticalUnassessed: number;
  mandatoryUnassessed: number;
  strongestCategoryId: string | null;
  weakestCategoryId: string | null;
}

/** Everything the Behavior Summary cards show, in one derivation. */
export function summarize(rows: readonly BehaviorItem[]): BehaviorSummary {
  let meets = 0, below = 0, unassessed = 0, mandatoryGaps = 0, criticalGaps = 0;
  let criticalUnassessed = 0, mandatoryUnassessed = 0, assessed = 0;
  const criticalAlerts: BehaviorItem[] = [];
  for (const r of rows) {
    if (r.score != null) assessed++;
    const g = gapStatus(r);
    if (g === "meets") meets++;
    else if (g === "below") below++;
    else if (g === "unassessed") unassessed++;
    if ((g === "below" || g === "unassessed") && r.isMandatory) mandatoryGaps++;
    if (isCriticalGap(r)) { criticalGaps++; criticalAlerts.push(r); }
    if (r.score == null && r.isCritical) criticalUnassessed++;
    if (r.score == null && r.isMandatory) mandatoryUnassessed++;
  }
  const cats = categoryScores(rows).filter(categoryQualifies);
  const strongest = cats.length ? cats.reduce((a, b) => (b.score! > a.score! ? b : a)) : null;
  const weakest = cats.length ? cats.reduce((a, b) => (b.score! < a.score! ? b : a)) : null;
  return {
    overallScore: weightedScore(rows),
    requiredScore: requiredScoreAvg(rows),
    matchPct: matchPercentage(rows),
    meets, below, unassessed, mandatoryGaps, criticalGaps, criticalAlerts,
    total: rows.length,
    assessed,
    coveragePct: rows.length ? Math.round((assessed / rows.length) * 100) : null,
    criticalUnassessed, mandatoryUnassessed,
    strongestCategoryId: strongest?.categoryId ?? null,
    weakestCategoryId: weakest?.categoryId ?? null,
  };
}

export type CriticalStatus = "clear" | "attention" | "incomplete";

/** Overall critical posture for an assessment. `clear` requires that NO
    critical indicator is below requirement AND every critical/mandatory
    indicator has actually been assessed — otherwise the green light would
    be a false negative. */
export function criticalStatus(s: BehaviorSummary): CriticalStatus {
  if (s.criticalGaps > 0) return "attention";
  if (s.criticalUnassessed > 0 || s.mandatoryUnassessed > 0) return "incomplete";
  return "clear";
}

/** Finalize precondition: an assessment must not be frozen with mandatory or
    critical indicators left unmeasured. Pure predicate — the API enforces it,
    the client mirrors it. */
export function canFinalize(s: BehaviorSummary): boolean {
  return s.criticalUnassessed === 0 && s.mandatoryUnassessed === 0;
}

/** A justification comment is required when the score is extreme, a critical
    indicator is below its requirement, or the assessment is being finalized.
    Pure predicate — callers gate the save on it. */
export function requiresJustification(row: BehaviorItem, comment: string | null | undefined): boolean {
  if (row.score == null) return false;
  const extreme = row.score < 40 || row.score > 95;
  const critical = isCriticalGap(row);
  if (!extreme && !critical) return false;
  return !comment || !comment.trim();
}
