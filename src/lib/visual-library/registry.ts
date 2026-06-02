/* ---------------------------------------------------------------------------
   Visual Division Registry engine — deterministic coverage + intelligence +
   DNA inheritance. No AI. Pure functions over already-fetched data so the API
   stays compute-on-read and never scans the whole library on a drawer open.
   --------------------------------------------------------------------------- */

import type {
  RegistryUsageRole, CoverageRow, RegistryCoverage, RegistryIntelligence, InheritedDna,
} from "./types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/* Roles we expect a healthy machine/subcategory to visually cover. */
export const KEY_ROLES: RegistryUsageRole[] = [
  "navigation", "feature", "machine-control", "warning", "safety",
  "onboarding", "status", "instruction", "operation", "dashboard",
];

/* ── DNA inheritance: subcategory → category → division ── */
export function resolveInheritedDna(chain: {
  subcategory?: { dna_profile_id: string | null; visual_style: string | null } | null;
  category?: { dna_profile_id: string | null; visual_style: string | null } | null;
  division?: { dna_profile_id: string | null; visual_style: string | null } | null;
  profileName?: (id: string) => string | null;
}): InheritedDna {
  const order: { src: InheritedDna["source"]; node?: { dna_profile_id: string | null; visual_style: string | null } | null }[] = [
    { src: "subcategory", node: chain.subcategory },
    { src: "category", node: chain.category },
    { src: "division", node: chain.division },
  ];
  for (const { src, node } of order) {
    if (node?.dna_profile_id) {
      return { profile_id: node.dna_profile_id, source: src, profile_name: chain.profileName?.(node.dna_profile_id) ?? null, visual_style: node.visual_style ?? null };
    }
  }
  // No explicit DNA profile — fall back to nearest visual_style for style guidance.
  const style = chain.subcategory?.visual_style ?? chain.category?.visual_style ?? chain.division?.visual_style ?? null;
  return { profile_id: null, source: "none", profile_name: null, visual_style: style };
}

/* ── Coverage ── */
export interface CoverageInput {
  scope: RegistryCoverage["scope"];
  scopeId: string; scopeName: string;
  totalAssets: number;                     // distinct assets linked into scope
  roleCounts: Partial<Record<RegistryUsageRole, number>>;
  systemsTotal: number;                    // product systems under scope
  systemsCovered: number;                  // systems with ≥1 linked asset
  missingSystems: string[];                // names of uncovered systems
}
export function computeCoverage(i: CoverageInput): RegistryCoverage {
  const roles: CoverageRow[] = (Object.keys(i.roleCounts) as RegistryUsageRole[])
    .map((role) => ({ role, count: i.roleCounts[role] ?? 0, pct: clamp(((i.roleCounts[role] ?? 0) / Math.max(1, i.totalAssets)) * 100) }))
    .sort((a, b) => b.count - a.count);

  const present = new Set(roles.filter((r) => r.count > 0).map((r) => r.role));
  const missing_roles = KEY_ROLES.filter((r) => !present.has(r));

  const systemsPct = i.systemsTotal > 0 ? (i.systemsCovered / i.systemsTotal) * 100 : (i.totalAssets > 0 ? 100 : 0);
  const keyRolesPct = (KEY_ROLES.filter((r) => present.has(r)).length / KEY_ROLES.length) * 100;
  const coverage_score = clamp(0.55 * systemsPct + 0.45 * keyRolesPct);

  return {
    scope: i.scope, scope_id: i.scopeId, scope_name: i.scopeName,
    total_assets: i.totalAssets, roles, missing_roles,
    systems_total: i.systemsTotal, systems_covered: i.systemsCovered, systems_missing: i.missingSystems,
    coverage_score,
  };
}

/* ── Intelligence ── */
export interface IntelligenceInput {
  qualityScores: number[];      // visual_asset_quality.quality_score for scope assets
  dnaScores: number[];          // asset_dna_analysis.overall_score for scope assets
  readabilityScores: number[];  // visual_asset_quality.readability_score
  duplicateHigh: number;        // # assets w/ duplicate_risk ≥ 55
  totalAssets: number;
  distinctStyles: number;       // distinct visual_style across scope structure
  orphanAssets: number;         // linked assets with no product_system_id
  systemsTotal: number; systemsCovered: number;
  coverageScore: number;
  hasIcon: boolean; hasCover: boolean;
  erpRoleCount: number; marketingRoleCount: number; uiRoleCount: number;
  avgUiRelevance: number;       // 0..100 from product systems
}
export function computeRegistryIntelligence(i: IntelligenceInput): RegistryIntelligence {
  const visual_consistency = clamp(i.qualityScores.length ? avg(i.qualityScores) : 60);
  const dna_purity = clamp(i.dnaScores.length ? avg(i.dnaScores) : 60);
  const readability = clamp(i.readabilityScores.length ? avg(i.readabilityScores) : 70);
  const duplicate_exposure = clamp((i.duplicateHigh / Math.max(1, i.totalAssets)) * 100);
  const style_drift = clamp(i.distinctStyles > 1 ? (i.distinctStyles - 1) * 22 : 0);
  const missing_systems = Math.max(0, i.systemsTotal - i.systemsCovered);
  const coverage_score = clamp(i.coverageScore);

  const health = clamp(
    0.28 * visual_consistency + 0.24 * dna_purity + 0.18 * coverage_score + 0.12 * readability
    - 0.18 * duplicate_exposure - 0.12 * style_drift,
  );
  const ui_readiness = clamp(0.5 * coverage_score + 0.3 * (i.uiRoleCount > 0 ? Math.min(100, 50 + i.uiRoleCount * 12) : 0) + 0.2 * i.avgUiRelevance);
  const erp_readiness = clamp(0.6 * coverage_score + 0.4 * (i.erpRoleCount > 0 ? Math.min(100, 40 + i.erpRoleCount * 20) : 0));
  const website_readiness = clamp(0.4 * coverage_score + 0.3 * (i.hasCover ? 100 : 0) + 0.3 * (i.marketingRoleCount > 0 ? 100 : 0));
  const product_page_readiness = clamp(0.4 * coverage_score + 0.25 * (i.hasIcon ? 100 : 0) + 0.2 * dna_purity + 0.15 * (i.systemsCovered > 0 ? 100 : 0));

  const notes: string[] = [];
  if (i.totalAssets === 0) notes.push("No visual assets linked yet.");
  if (missing_systems > 0) notes.push(`${missing_systems} product system(s) have no visual asset.`);
  if (i.orphanAssets > 0) notes.push(`${i.orphanAssets} linked asset(s) not tied to a product system.`);
  if (duplicate_exposure >= 30) notes.push("High duplicate exposure — consolidate similar assets.");
  if (style_drift >= 40) notes.push("Style drift detected across the structure.");
  if (dna_purity < 55) notes.push("Low brand-DNA purity — off-brand visuals present.");
  if (readability < 55) notes.push("Weak small-size readability across the set.");
  if (!i.hasIcon) notes.push("No representative icon assigned.");

  return {
    visual_consistency, dna_purity, duplicate_exposure, style_drift,
    coverage_score, readability, orphan_assets: i.orphanAssets, missing_systems,
    health, ui_readiness, erp_readiness, website_readiness, product_page_readiness, notes,
  };
}
