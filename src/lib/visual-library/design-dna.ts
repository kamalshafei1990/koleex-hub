/* ---------------------------------------------------------------------------
   KOLEEX Design DNA engine — deterministic brand visual-language scoring.
   No AI. Reuses the SVG metrics from the Quality engine + collection style +
   the seeded DNA rules/patterns. Produces: DNA scores, visual fingerprint,
   personality, temperature, brand-rule violations, and pattern-match %.
   --------------------------------------------------------------------------- */

import type { SvgMetrics } from "./quality";
import type { DnaRule, DnaPattern, DnaPatternMatch, DnaPersonality, DnaMatchStatus } from "./types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export interface DnaInput {
  asset: { style: string | null; asset_type: string; approval_status: string; category: string | null; svg_path: string | null };
  metrics: SvgMetrics | null;
  collections: { name: string; preferred_style: string | null }[];
  rules: DnaRule[];
  patterns: DnaPattern[];
}

export interface DnaResult {
  overall_score: number; geometry_score: number; spacing_score: number; corner_score: number;
  stroke_score: number; minimalism_score: number; futuristic_score: number; industrial_score: number;
  luxury_score: number; symmetry_score: number; balance_score: number; readability_score: number; consistency_score: number;
  shape_language: string; visual_density: number; stroke_family: string; corner_family: string;
  geometry_family: string; negative_space_ratio: number; complexity_level: string; visual_weight: string;
  icon_personality: DnaPersonality; visual_temperature: string;
  violates_brand_language: boolean; too_complex: boolean; inconsistent_stroke: boolean;
  weak_balance: boolean; over_detailed: boolean; poor_scalability: boolean;
  pattern_matches: DnaPatternMatch[];
  violations: { kind: string; message: string }[];
}

const INDUSTRIAL_CATS = new Set(["manufacturing", "inventory", "devices", "logistics"]);

export function computeDna(input: DnaInput): DnaResult {
  const { asset, metrics, collections, patterns } = input;
  const paths = metrics?.pathCount ?? 1;
  const bytes = metrics?.bytes ?? 800;
  const square = metrics?.square ?? true;
  const themeSafe = metrics ? metrics.usesCurrentColor && !metrics.hasHardCodedColor : true;

  // ── Fingerprint ──
  const complexity_level = paths <= 2 && bytes < 2200 ? "minimal" : paths <= 6 && bytes < 6000 ? "medium" : "complex";
  const stroke_family = asset.style === "filled" ? "filled" : asset.style === "duotone" ? "duotone" : "outline";
  const corner_family = "rounded"; // KOLEEX pack
  const geometry_family = complexity_level === "complex" ? "organic" : "geometric";
  const shape_language = `${corner_family}-${stroke_family}`;
  const visual_density = Number((paths / 24).toFixed(2));
  const negative_space_ratio = Number(Math.max(0.2, 1 - paths / 14).toFixed(2));
  const visual_weight = bytes < 1500 ? "light" : bytes < 4500 ? "balanced" : "heavy";

  // ── Group scores ──
  const minimalism_score = clamp(complexity_level === "minimal" ? 100 : complexity_level === "medium" ? 68 : 38);
  const geometry_score = clamp(geometry_family === "geometric" ? 88 : 52);
  const stroke_score = clamp(stroke_family === "outline" ? 95 : stroke_family === "duotone" ? 60 : 70);
  const corner_score = 88; // rounded family
  const spacing_score = clamp(square ? 92 : 60);
  const symmetry_score = clamp(square ? 82 : 58);
  const balance_score = clamp((spacing_score + symmetry_score) / 2);
  const readability_score = clamp(complexity_level === "minimal" ? 96 : complexity_level === "medium" ? 72 : 42);
  const prefs = collections.map((c) => c.preferred_style).filter(Boolean) as string[];
  const mismatches = prefs.filter((p) => asset.style && p !== asset.style);
  const consistency_score = clamp(prefs.length === 0 ? 85 : 100 - (mismatches.length / prefs.length) * 60);

  // ── Personality dimensions ──
  const futuristic_score = clamp((minimalism_score * 0.5 + geometry_score * 0.4 + (themeSafe ? 10 : 0)));
  const industrial_score = clamp((INDUSTRIAL_CATS.has(asset.category ?? "") ? 60 : 30) + geometry_score * 0.3 + (complexity_level === "medium" ? 15 : 0));
  const luxury_score = clamp(minimalism_score * 0.5 + negative_space_ratio * 40 + (stroke_family === "outline" ? 12 : 0));

  // ── Overall (weighted by KOLEEX rule emphasis) ──
  const overall_score = clamp(
    minimalism_score * 0.20 + stroke_score * 0.16 + geometry_score * 0.14 +
    readability_score * 0.16 + balance_score * 0.12 + corner_score * 0.08 +
    consistency_score * 0.08 + (themeSafe ? 6 : 0) -
    (asset.approval_status === "deprecated" ? 15 : 0),
  );

  // ── Personality (dominant deterministic label) ──
  const personalityScores: [DnaPersonality, number][] = [
    ["minimal", minimalism_score],
    ["geometric", geometry_score],
    ["industrial", industrial_score],
    ["futuristic", futuristic_score],
    ["luxury", luxury_score],
    ["technical", complexity_level === "medium" ? 70 : 40],
    ["dense", 100 - minimalism_score],
    ["soft", corner_family === "rounded" ? 75 : 30],
  ];
  personalityScores.sort((a, b) => b[1] - a[1]);
  const icon_personality: DnaPersonality = personalityScores[0][1] >= 55 ? personalityScores[0][0] : "neutral";
  const visual_temperature = themeSafe ? "cool" : "warm";

  // ── Flags / violations ──
  const violations: { kind: string; message: string }[] = [];
  const too_complex = complexity_level === "complex";
  const over_detailed = paths > 8;
  const poor_scalability = readability_score < 55;
  const inconsistent_stroke = prefs.length > 0 && !!asset.style && mismatches.length > 0;
  const weak_balance = !square;
  const violates_brand_language = overall_score < 55;
  if (too_complex) violations.push({ kind: "too_detailed", message: "Too detailed for the KOLEEX minimal language." });
  if (inconsistent_stroke) violations.push({ kind: "inconsistent_stroke", message: `Stroke “${asset.style}” conflicts with collection preference.` });
  if (poor_scalability) violations.push({ kind: "poor_scaling", message: "Weak readability at 16px." });
  if (weak_balance) violations.push({ kind: "off_geometry", message: "Non-square canvas — off-brand geometry / weak balance." });
  if (!themeSafe && asset.svg_path) violations.push({ kind: "off_color", message: "Hard-coded color — KOLEEX is monochrome-first." });
  if (over_detailed) violations.push({ kind: "excessive_density", message: "Excessive element density." });

  // ── Pattern matching (deterministic trait comparison) ──
  const traits: Record<string, unknown> = {
    stroke: stroke_family, corner: corner_family, complexity: complexity_level,
    geometry: geometry_family, monochrome: themeSafe, square,
    personality: icon_personality, density: minimalism_score >= 70 ? "low" : "medium",
    symmetry: square ? "high" : "low",
  };
  const pattern_matches: DnaPatternMatch[] = patterns.map((pat) => {
    const v = pat.pattern_vector ?? {};
    const keys = Object.keys(v);
    if (keys.length === 0) return { pattern_name: pat.pattern_name, score: 0 };
    let hit = 0;
    for (const k of keys) if (String(v[k]).toLowerCase() === String(traits[k]).toLowerCase()) hit++;
    return { pattern_name: pat.pattern_name, score: clamp((hit / keys.length) * 100) };
  }).sort((a, b) => b.score - a.score);

  return {
    overall_score, geometry_score, spacing_score, corner_score, stroke_score, minimalism_score,
    futuristic_score, industrial_score, luxury_score, symmetry_score, balance_score, readability_score, consistency_score,
    shape_language, visual_density, stroke_family, corner_family, geometry_family, negative_space_ratio,
    complexity_level, visual_weight, icon_personality, visual_temperature,
    violates_brand_language, too_complex, inconsistent_stroke, weak_balance, over_detailed, poor_scalability,
    pattern_matches, violations,
  };
}

export function dnaMatchStatus(score: number): { status: DnaMatchStatus; label: string; tone: "positive" | "warning" | "rose" } {
  if (score >= 88) return { status: "excellent", label: "Excellent Match", tone: "positive" };
  if (score >= 74) return { status: "strong", label: "Strong Match", tone: "positive" };
  if (score >= 58) return { status: "partial", label: "Partial Match", tone: "warning" };
  if (score >= 40) return { status: "weak", label: "Weak Match", tone: "warning" };
  return { status: "off_brand", label: "Off Brand", tone: "rose" };
}
