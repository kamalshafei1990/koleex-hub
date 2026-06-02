/* ---------------------------------------------------------------------------
   Visual Review engine — deterministic production-readiness recommendation.
   Combines the existing Quality + DNA + Governance + duplicate + collection
   signals into one operational verdict. No AI.
   --------------------------------------------------------------------------- */

import type { ReviewRecommendation, RiskLevel, ReviewStatus } from "./types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export interface ReviewInput {
  asset: { approval_status: string; status: string; svg_path: string | null; semantic_meaning: string | null };
  quality: number | null;          // visual_asset_quality.quality_score
  dna: number | null;              // asset_dna_analysis.overall_score
  duplicateRisk: number | null;    // visual_asset_quality.duplicate_risk_score
  readability: number | null;      // visual_asset_quality.readability_score
  darkMode: number | null;         // visual_asset_quality.dark_mode_score
  governanceForbidden: number;     // # forbidden context rules
  collectionsCount: number;
  relationshipsCount: number;
}

export function computeReview(i: ReviewInput): ReviewRecommendation {
  const q = i.quality ?? 60, d = i.dna ?? 60, dup = i.duplicateRisk ?? 20;
  const read = i.readability ?? 70, dark = i.darkMode ?? 80;
  const deprecated = i.asset.approval_status === "deprecated";
  const archived = i.asset.status === "archived";
  const missingFile = !i.asset.svg_path;

  const safety: ReviewRecommendation["safety"] = [];
  if (deprecated) safety.push({ kind: "deprecated", severity: "error", message: "Asset is deprecated — block production." });
  if (i.governanceForbidden > 0) safety.push({ kind: "forbidden_context", severity: "error", message: `Forbidden in ${i.governanceForbidden} context(s).` });
  if (missingFile) safety.push({ kind: "missing_file", severity: "error", message: "No icon file attached." });
  if (dup >= 55) safety.push({ kind: "duplicate", severity: "warning", message: "High duplicate risk — verify before production." });
  if (read < 55) safety.push({ kind: "readability", severity: "warning", message: "Weak small-size readability." });
  if (dark < 55) safety.push({ kind: "dark_mode", severity: "warning", message: "Weak dark-mode contrast." });
  if (d < 55) safety.push({ kind: "off_brand", severity: "warning", message: "Off-brand — low KOLEEX DNA match." });
  if (i.collectionsCount === 0) safety.push({ kind: "no_collection", severity: "warning", message: "Not part of any collection." });
  if (!i.asset.semantic_meaning) safety.push({ kind: "no_meaning", severity: "warning", message: "Missing semantic meaning." });

  // Approval score: quality + dna dominate, minus duplicate + governance penalties.
  const approval_score = clamp(
    q * 0.4 + d * 0.4 + read * 0.1 + dark * 0.1
    - dup * 0.25
    - i.governanceForbidden * 12
    - (deprecated ? 40 : 0) - (archived ? 25 : 0) - (missingFile ? 30 : 0),
  );

  // Risk level
  let risk_level: RiskLevel = "low";
  if (deprecated || i.governanceForbidden > 0 || missingFile || approval_score < 40) risk_level = "critical";
  else if (approval_score < 60 || dup >= 55 || d < 55) risk_level = "high";
  else if (approval_score < 78 || read < 60) risk_level = "medium";

  // Hard blocks
  const blocked = deprecated || i.governanceForbidden > 0 || missingFile;
  const production_ready = !blocked && approval_score >= 80 && dup < 55 && d >= 70 && read >= 60;

  let suggested_status: ReviewStatus;
  let recommendation: string;
  if (deprecated) { suggested_status = "deprecated"; recommendation = "Deprecated — block production use."; }
  else if (blocked) { suggested_status = "needs_revision"; recommendation = "Blocked from production — resolve safety issues."; }
  else if (production_ready && approval_score >= 90) { suggested_status = "approved"; recommendation = "Approved for production."; }
  else if (production_ready) { suggested_status = "approved_with_notes"; recommendation = "Approve with minor notes."; }
  else if (dup >= 55) { suggested_status = "replace_recommended"; recommendation = "High duplicate risk — consider replacing with an existing approved asset."; }
  else if (approval_score < 50) { suggested_status = "rejected"; recommendation = "Below production bar — reject or redesign."; }
  else { suggested_status = "needs_revision"; recommendation = "Needs revision before production."; }

  return { approval_score, production_ready, risk_level, recommendation, suggested_status, safety };
}

export const RISK_TONE: Record<RiskLevel, "positive" | "warning" | "rose"> = {
  low: "positive", medium: "warning", high: "rose", critical: "rose",
};
export function reviewStatusTone(s: ReviewStatus): "positive" | "warning" | "rose" | "neutral" {
  if (s === "approved" || s === "approved_with_notes") return "positive";
  if (s === "pending") return "neutral";
  if (s === "needs_revision" || s === "replace_recommended") return "warning";
  return "rose";
}
