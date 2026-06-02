/* ---------------------------------------------------------------------------
   Visual governance engine — pure, deterministic (no AI). Computes a
   compatibility score between an asset and a collection's style rules, and
   surfaces rule violations. Used by the governance API + UI.
   --------------------------------------------------------------------------- */

import type { VisualAsset, VisualCollection, GovernanceViolation } from "./types";

type AssetLike = Pick<VisualAsset, "style" | "asset_type" | "approval_status" | "svg_path">;
type CollectionLike = Pick<VisualCollection, "preferred_style" | "preferred_monochrome" | "name">;

/** 0–100 compatibility of an asset with a collection's preferred style rules. */
export function compatibilityScore(asset: AssetLike, col: CollectionLike): number {
  let score = 100;
  if (col.preferred_style && asset.style && col.preferred_style !== asset.style) score -= 40;
  if (asset.approval_status === "deprecated") score -= 30;
  if (!asset.svg_path) score -= 25; // missing file
  // monochrome preference: our icons are monochrome SVG, so only penalize photos
  if (col.preferred_monochrome && asset.asset_type === "photo") score -= 20;
  return Math.max(0, Math.min(100, score));
}

/** Verdict label for a score. */
export function scoreVerdict(score: number): { label: string; tone: "positive" | "warning" | "rose" } {
  if (score >= 80) return { label: "Compatible", tone: "positive" };
  if (score >= 50) return { label: "Partial", tone: "warning" };
  return { label: "Low", tone: "rose" };
}

/** Build violation list for an asset given its forbidden-context rules and the
 *  collections it belongs to (with their preferred styles). */
export function assetViolations(
  asset: AssetLike,
  forbiddenContextNames: string[],
  memberCollections: CollectionLike[],
): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  if (!asset.svg_path) out.push({ kind: "missing_file", severity: "warning", message: "No icon file attached yet." });
  if (asset.approval_status === "deprecated") out.push({ kind: "deprecated", severity: "warning", message: "This asset is deprecated — avoid using in new work." });
  for (const name of forbiddenContextNames) {
    out.push({ kind: "forbidden_context", severity: "error", message: `Forbidden in “${name}” contexts.` });
  }
  for (const c of memberCollections) {
    if (c.preferred_style && asset.style && c.preferred_style !== asset.style) {
      out.push({ kind: "style_mismatch", severity: "warning", message: `Style “${asset.style}” differs from “${c.name}” preferred “${c.preferred_style}”.` });
    }
  }
  return out;
}
