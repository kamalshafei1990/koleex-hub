/* ---------------------------------------------------------------------------
   Skill scoring engine — pure functions, shared by the form (live totals)
   and the server (persisted validation). Keeping the math in ONE module is
   what lets the client preview and the server verdict never disagree.

   Two invariants the whole system leans on:
   · score NULL  = not assessed yet.   score 0 = assessed as "no experience".
     They are different facts and must never collapse into each other.
   · Totals are NORMALIZED weighted averages, so the result stays 0–100
     regardless of how many skills a position happens to define.
   --------------------------------------------------------------------------- */

export type SkillLevel =
  | "No Experience" | "Beginner" | "Intermediate" | "Advanced" | "Expert" | "Master";

/** 0–19 No Experience · 20–39 Beginner · 40–59 Intermediate · 60–79 Advanced
    · 80–94 Expert · 95–100 Master */
export function levelForScore(score: number): SkillLevel {
  if (score >= 95) return "Master";
  if (score >= 80) return "Expert";
  if (score >= 60) return "Advanced";
  if (score >= 40) return "Intermediate";
  if (score >= 20) return "Beginner";
  return "No Experience";
}

export function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** One assessable row, position-derived or additional. */
export interface ScorableSkill {
  /** NULL = unassessed. */
  score: number | null;
  /** Requirement weight; anything missing/invalid degrades to 1. */
  weight?: number | null;
  /** Position requirement; null/undefined for additional skills. */
  requiredScore?: number | null;
  isMandatory?: boolean;
}

function safeWeight(w: number | null | undefined): number {
  /* Weight 0 is a legal "tracked but doesn't count" configuration; negative
     or NaN degrades to the default 1 rather than corrupting the average. */
  if (w == null || Number.isNaN(w) || w < 0) return 1;
  return w;
}

/** Normalized weighted average of ASSESSED scores. NULL rows are excluded —
    an unassessed skill must not drag the average toward zero. Returns null
    when nothing is assessed (there is no score, not a score of 0). */
export function weightedScore(rows: readonly ScorableSkill[]): number | null {
  let sum = 0, wsum = 0;
  for (const r of rows) {
    if (r.score == null) continue;
    const w = safeWeight(r.weight);
    sum += clampScore(r.score) * w;
    wsum += w;
  }
  /* All-zero weights: fall back to an unweighted mean of assessed rows —
     "every configured weight is 0" cannot mean "the employee has no score". */
  if (wsum === 0) {
    const assessed = rows.filter((r) => r.score != null);
    if (!assessed.length) return null;
    return Math.round(assessed.reduce((a, r) => a + clampScore(r.score!), 0) / assessed.length);
  }
  return Math.round(sum / wsum);
}

/** Weighted average of the REQUIRED scores — "what this position demands". */
export function requiredScoreAvg(rows: readonly ScorableSkill[]): number | null {
  let sum = 0, wsum = 0;
  for (const r of rows) {
    if (r.requiredScore == null) continue;
    const w = safeWeight(r.weight);
    sum += clampScore(r.requiredScore) * w;
    wsum += w;
  }
  return wsum === 0 ? null : Math.round(sum / wsum);
}

/** Position match %: weighted average of per-skill achievement ratios, each
    CAPPED at 1 — overperforming one skill must not hide a gap in another.
    requiredScore 0 counts as fully achieved (nothing was demanded).
    Unassessed rows count as ratio 0: an unmeasured requirement is unmet. */
export function matchPercentage(rows: readonly ScorableSkill[]): number | null {
  const reqRows = rows.filter((r) => r.requiredScore != null);
  if (!reqRows.length) return null;
  let sum = 0, wsum = 0;
  for (const r of reqRows) {
    const w = safeWeight(r.weight);
    const req = clampScore(r.requiredScore!);
    const ratio = req === 0 ? 1 : r.score == null ? 0 : Math.min(clampScore(r.score) / req, 1);
    sum += ratio * w;
    wsum += w;
  }
  if (wsum === 0) {
    const ratios = reqRows.map((r) => {
      const req = clampScore(r.requiredScore!);
      return req === 0 ? 1 : r.score == null ? 0 : Math.min(clampScore(r.score) / req, 1);
    });
    return Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100);
  }
  return Math.round((sum / wsum) * 100);
}

export type GapStatus = "meets" | "below" | "unassessed";

export function gapStatus(row: ScorableSkill): GapStatus | null {
  if (row.requiredScore == null) return null;      // additional skill — no gap concept
  if (row.score == null) return "unassessed";
  return clampScore(row.score) >= clampScore(row.requiredScore) ? "meets" : "below";
}

export interface SkillsSummary {
  positionScore: number | null;
  requiredScore: number | null;
  matchPct: number | null;
  additionalScore: number | null;
  overallScore: number | null;
  meets: number;
  below: number;
  unassessed: number;
  mandatoryGaps: number;
  /** ── Coverage: a position score computed from 2 of 10 required skills is
     easy to misread as a verdict. The summary always carries how much of the
     required set has actually been assessed. */
  positionTotal: number;
  positionAssessed: number;
  coveragePct: number | null;
  mandatoryUnassessed: number;
}

/** Everything the summary cards show, in one derivation. `overallScore` is a
    plain weighted average across BOTH groups (transparent: same formula, one
    pool) — shown alongside, never instead of, the position score. */
export function summarize(
  positionRows: readonly ScorableSkill[],
  additionalRows: readonly ScorableSkill[],
): SkillsSummary {
  let meets = 0, below = 0, unassessed = 0, mandatoryGaps = 0;
  let positionAssessed = 0, mandatoryUnassessed = 0;
  for (const r of positionRows) {
    if (r.score != null) positionAssessed++;
    const g = gapStatus(r);
    if (g === "meets") meets++;
    else if (g === "below") below++;
    else if (g === "unassessed") unassessed++;
    if ((g === "below" || g === "unassessed") && r.isMandatory) mandatoryGaps++;
    if (r.score == null && r.isMandatory) mandatoryUnassessed++;
  }
  return {
    positionScore: weightedScore(positionRows),
    requiredScore: requiredScoreAvg(positionRows),
    matchPct: matchPercentage(positionRows),
    additionalScore: weightedScore(additionalRows),
    overallScore: weightedScore([...positionRows, ...additionalRows]),
    meets, below, unassessed, mandatoryGaps,
    positionTotal: positionRows.length,
    positionAssessed,
    coveragePct: positionRows.length ? Math.round((positionAssessed / positionRows.length) * 100) : null,
    mandatoryUnassessed,
  };
}
