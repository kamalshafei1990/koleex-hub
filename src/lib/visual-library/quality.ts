/* ---------------------------------------------------------------------------
   Visual Quality engine — deterministic (no AI). Produces a full visual-quality
   profile for an asset from: its own metadata, a lightweight parse of its SVG,
   the collections it belongs to (preferred style), and deterministic duplicate
   matches. Structured so future AI scoring can override/augment the same shape.
   --------------------------------------------------------------------------- */

import type { VisualAsset, VisualCollection, QualityProfile, QualityStatus, QualityWarning } from "./types";

export interface SvgMetrics {
  pathCount: number;     // number of drawable elements
  bytes: number;         // normalized SVG size
  usesCurrentColor: boolean;
  hasHardCodedColor: boolean;
  square: boolean;       // viewBox is square (good padding/balance proxy)
}

/** Parse cheap, deterministic metrics from an SVG string. */
export function svgMetrics(svg: string): SvgMetrics {
  const drawables = (svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line)\b/gi) ?? []).length;
  const vb = (svg.match(/viewBox="([^"]+)"/i) ?? [])[1] ?? "0 0 24 24";
  const parts = vb.trim().split(/\s+/).map(Number);
  const square = parts.length === 4 ? Math.abs(parts[2] - parts[3]) < 0.5 : true;
  return {
    pathCount: drawables || 1,
    bytes: svg.length,
    usesCurrentColor: /fill="currentColor"/i.test(svg) || !/fill="#/i.test(svg),
    hasHardCodedColor: /fill="#[0-9a-f]/i.test(svg),
    square,
  };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export interface ComputeInput {
  asset: Pick<VisualAsset, "style" | "asset_type" | "approval_status" | "status" | "svg_path" | "keywords" | "title">;
  collections: Pick<VisualCollection, "name" | "preferred_style" | "preferred_monochrome">[];
  metrics: SvgMetrics | null;
  similarCount: number;       // # of deterministically-similar assets
}

export interface ComputeResult extends Omit<QualityProfile, "asset_id" | "visually_similar_to" | "duplicate_group_id" | "ai_notes" | "manual_notes" | "reviewed_by" | "reviewed_at"> {
  warnings: QualityWarning[];
}

export function computeQuality(input: ComputeInput): ComputeResult {
  const { asset, collections, metrics, similarCount } = input;
  const warnings: QualityWarning[] = [];

  // ── Complexity / simplicity / noise (from SVG drawable count + size) ──
  const paths = metrics?.pathCount ?? 1;
  const bytes = metrics?.bytes ?? 800;
  const complexity_level: string = paths <= 2 && bytes < 2200 ? "minimal" : paths <= 6 && bytes < 6000 ? "medium" : "complex";
  const simplicity_score = clamp(complexity_level === "minimal" ? 100 : complexity_level === "medium" ? 72 : 42);
  const visual_noise_score = clamp(100 - simplicity_score + 8); // higher = noisier
  if (complexity_level === "complex") warnings.push({ kind: "too_detailed", severity: "warning", message: "Too detailed — may not read at small sizes." });

  // ── Dark mode / monochrome (currentColor = theme-safe) ──
  const themeSafe = metrics ? metrics.usesCurrentColor && !metrics.hasHardCodedColor : true;
  const dark_mode_score = clamp(themeSafe ? 100 : 45);
  const monochrome_compatibility = clamp(themeSafe ? 100 : 50);
  const dark_background_compatibility = dark_mode_score;
  if (!themeSafe && asset.svg_path) warnings.push({ kind: "dark_mode", severity: "warning", message: "Hard-coded colors — weak dark-mode contrast." });

  // ── Spacing / padding / symmetry (square viewBox proxy) ──
  const square = metrics?.square ?? true;
  const spacing_score = clamp(square ? 92 : 64);
  const padding_ratio = square ? 0.92 : 0.7;
  const symmetry_score = clamp(square ? 80 : 60);
  const optical_balance_score = clamp((spacing_score + symmetry_score) / 2);
  if (!square) warnings.push({ kind: "padding", severity: "warning", message: "Non-square canvas — padding/optical balance may be off." });

  // ── Stroke / style consistency vs collections ──
  const stroke_style = asset.style === "filled" ? "filled" : asset.style === "duotone" ? "duotone" : "outline";
  const corner_style = "rounded"; // KOLEEX pack is rounded; deterministic default
  const prefs = collections.map((c) => c.preferred_style).filter(Boolean) as string[];
  const mismatches = prefs.filter((p) => asset.style && p !== asset.style);
  const style_consistency_score = clamp(prefs.length === 0 ? 90 : 100 - (mismatches.length / prefs.length) * 60);
  const stroke_consistency_score = clamp(style_consistency_score);
  for (const c of collections) {
    if (c.preferred_style && asset.style && c.preferred_style !== asset.style) {
      warnings.push({ kind: "collection_style", severity: "warning", message: `Conflicts with “${c.name}” — stroke style “${asset.style}” ≠ preferred “${c.preferred_style}”.` });
    }
  }

  // ── Readability / scalability (driven by complexity) ──
  const small_size_readability = clamp(complexity_level === "minimal" ? 96 : complexity_level === "medium" ? 74 : 44);
  const readability_score = small_size_readability;
  const scalability_score = clamp((simplicity_score + (metrics ? 100 : 70)) / 2);

  // ── Uniqueness / duplicate risk ──
  const duplicate_risk_score = clamp(similarCount >= 5 ? 80 : similarCount >= 2 ? 55 : similarCount === 1 ? 30 : 5);
  const uniqueness_score = clamp(100 - duplicate_risk_score);
  if (similarCount >= 2) warnings.push({ kind: "duplicate", severity: "warning", message: `${similarCount} visually-similar assets — possible duplicate.` });

  // ── Outdated risk ──
  const outdated_risk_score = clamp(asset.approval_status === "deprecated" ? 90 : asset.status === "archived" ? 60 : 10);
  if (asset.approval_status === "deprecated") warnings.push({ kind: "outdated", severity: "error", message: "Deprecated — replace before reuse." });

  // ── Collection match ──
  const collection_match_score = clamp(collections.length === 0 ? 70 : style_consistency_score);

  if (!asset.svg_path) warnings.push({ kind: "missing_file", severity: "warning", message: "No icon file — quality is estimated from metadata only." });

  // ── Overall (weighted) ──
  const quality_score = clamp(
    simplicity_score * 0.16 + style_consistency_score * 0.16 + dark_mode_score * 0.12 +
    readability_score * 0.14 + spacing_score * 0.10 + uniqueness_score * 0.12 +
    scalability_score * 0.10 + collection_match_score * 0.10 -
    (outdated_risk_score > 50 ? 15 : 0),
  );
  const overall_status: QualityStatus =
    quality_score >= 88 ? "excellent" : quality_score >= 72 ? "good" : quality_score >= 55 ? "acceptable" : quality_score >= 35 ? "poor" : "rejected";

  return {
    quality_score, style_consistency_score, stroke_consistency_score, spacing_score, dark_mode_score,
    simplicity_score, uniqueness_score, readability_score, scalability_score, duplicate_risk_score,
    visual_noise_score, outdated_risk_score, collection_match_score, overall_status,
    stroke_width: null, stroke_style, corner_style, shape_language: asset.style ?? null, complexity_level,
    visual_density: Number((paths / 24).toFixed(2)), padding_ratio, symmetry_score, optical_balance_score,
    monochrome_compatibility, dark_background_compatibility, small_size_readability,
    warnings,
  };
}

export function statusTone(s: QualityStatus): "positive" | "warning" | "rose" {
  return s === "excellent" || s === "good" ? "positive" : s === "acceptable" ? "warning" : "rose";
}
