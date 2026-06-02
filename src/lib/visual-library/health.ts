/* ---------------------------------------------------------------------------
   Asset Health Score — deterministic 0–100 (no AI). Rewards a complete,
   approved, well-described, governed, connected asset; penalizes deprecated
   / orphan / missing-file states. Used by the Asset Workspace.
   --------------------------------------------------------------------------- */

import type { VisualAsset } from "./types";

export interface HealthInput {
  asset: Pick<VisualAsset,
    | "svg_path" | "approval_status" | "status" | "semantic_meaning"
    | "keywords" | "description" | "style">;
  relationshipCount?: number;
  collectionCount?: number;
  governanceRuleCount?: number;
}

export interface HealthResult {
  score: number;
  label: string;
  tone: "positive" | "warning" | "rose";
  factors: { label: string; ok: boolean; weight: number }[];
}

export function assetHealth(input: HealthInput): HealthResult {
  const { asset, relationshipCount = 0, collectionCount = 0, governanceRuleCount = 0 } = input;
  const factors: { label: string; ok: boolean; weight: number }[] = [
    { label: "Has icon file", ok: !!asset.svg_path, weight: 20 },
    { label: "Approved", ok: asset.approval_status === "approved", weight: 18 },
    { label: "Semantic meaning", ok: !!asset.semantic_meaning, weight: 14 },
    { label: "Keywords", ok: (asset.keywords?.length ?? 0) >= 2, weight: 10 },
    { label: "Description", ok: !!asset.description, weight: 6 },
    { label: "Style set", ok: !!asset.style, weight: 6 },
    { label: "In a collection", ok: collectionCount > 0, weight: 10 },
    { label: "Has relationships", ok: relationshipCount > 0, weight: 8 },
    { label: "Governance rules", ok: governanceRuleCount > 0, weight: 8 },
  ];
  let score = factors.reduce((s, f) => s + (f.ok ? f.weight : 0), 0);
  // Hard penalties
  if (asset.approval_status === "deprecated") score -= 30;
  if (asset.status === "archived") score -= 20;
  score = Math.max(0, Math.min(100, score));

  const tone = score >= 80 ? "positive" : score >= 50 ? "warning" : "rose";
  const label = score >= 80 ? "Healthy" : score >= 50 ? "Needs work" : "Incomplete";
  return { score, label, tone, factors };
}
