import "server-only";

/* ---------------------------------------------------------------------------
   Server-side gather for registry coverage + intelligence. Bounded to a single
   scope (division / category / subcategory) so it never scans the whole library.
   Feeds the deterministic engine in registry.ts.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { computeCoverage, computeRegistryIntelligence } from "@/lib/visual-library/registry";
import type { RegistryUsageRole, RegistryCoverage, RegistryIntelligence } from "@/lib/visual-library/types";

type Scope = "division" | "category" | "subcategory";

const SCOPE_COL: Record<Scope, string> = { division: "division_id", category: "category_id", subcategory: "subcategory_id" };
const SCOPE_TABLE: Record<Scope, string> = { division: "visual_divisions", category: "visual_categories", subcategory: "visual_subcategories" };

/* Resolve the set of product systems that belong under a scope. */
async function systemsForScope(tid: string, scope: Scope, scopeId: string): Promise<{ id: string; name: string; ui_relevance: number }[]> {
  if (scope === "subcategory") {
    const { data } = await supabaseServer.from("visual_product_systems").select("id, name, ui_relevance").eq("tenant_id", tid).eq("subcategory_id", scopeId);
    return (data ?? []) as { id: string; name: string; ui_relevance: number }[];
  }
  let subIds: string[] = [];
  if (scope === "category") {
    const { data } = await supabaseServer.from("visual_subcategories").select("id").eq("tenant_id", tid).eq("category_id", scopeId);
    subIds = (data ?? []).map((r) => r.id as string);
  } else {
    const { data: cats } = await supabaseServer.from("visual_categories").select("id").eq("tenant_id", tid).eq("division_id", scopeId);
    const catIds = (cats ?? []).map((r) => r.id as string);
    if (catIds.length) {
      const { data: subs } = await supabaseServer.from("visual_subcategories").select("id").eq("tenant_id", tid).in("category_id", catIds);
      subIds = (subs ?? []).map((r) => r.id as string);
    }
  }
  if (!subIds.length) return [];
  const { data } = await supabaseServer.from("visual_product_systems").select("id, name, ui_relevance").eq("tenant_id", tid).in("subcategory_id", subIds);
  return (data ?? []) as { id: string; name: string; ui_relevance: number }[];
}

/* Collect visual_style values across the in-scope structure (for drift). */
async function stylesForScope(tid: string, scope: Scope, scopeId: string): Promise<string[]> {
  const styles: (string | null)[] = [];
  if (scope === "division") {
    const [{ data: cats }, { data: div }] = await Promise.all([
      supabaseServer.from("visual_categories").select("visual_style").eq("tenant_id", tid).eq("division_id", scopeId),
      supabaseServer.from("visual_divisions").select("visual_style").eq("id", scopeId).maybeSingle(),
    ]);
    styles.push(div?.visual_style as string | null);
    for (const c of cats ?? []) styles.push(c.visual_style as string | null);
  } else if (scope === "category") {
    const { data: subs } = await supabaseServer.from("visual_subcategories").select("visual_style").eq("tenant_id", tid).eq("category_id", scopeId);
    for (const s of subs ?? []) styles.push(s.visual_style as string | null);
  }
  return styles.filter(Boolean) as string[];
}

export interface ScopeResult { coverage: RegistryCoverage; intelligence: RegistryIntelligence; scope_name: string }

export async function gatherScope(tid: string, scope: Scope, scopeId: string): Promise<ScopeResult | null> {
  // visual_subcategories has no cover_asset_id column — select("*") and read defensively.
  const { data: rawRow } = await supabaseServer.from(SCOPE_TABLE[scope])
    .select("*").eq("id", scopeId).eq("tenant_id", tid).maybeSingle();
  if (!rawRow) return null;
  const scopeRow = rawRow as { id: string; name: string; icon_asset_id?: string | null; cover_asset_id?: string | null };

  const { data: links } = await supabaseServer.from("visual_asset_registry_links")
    .select("asset_id, usage_role, product_system_id").eq("tenant_id", tid).eq(SCOPE_COL[scope], scopeId);
  const rows = links ?? [];

  const roleCounts: Partial<Record<RegistryUsageRole, number>> = {};
  const assetSet = new Set<string>();
  const coveredSystems = new Set<string>();
  let orphanAssets = 0, erpRoleCount = 0, marketingRoleCount = 0, uiRoleCount = 0;
  for (const r of rows) {
    const role = r.usage_role as RegistryUsageRole;
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    if (r.asset_id) assetSet.add(r.asset_id as string);
    if (r.product_system_id) coveredSystems.add(r.product_system_id as string); else orphanAssets++;
    if (role === "erp-module") erpRoleCount++;
    if (role === "marketing") marketingRoleCount++;
    if (role === "navigation" || role === "dashboard" || role === "status" || role === "feature") uiRoleCount++;
  }

  const [systems, styles] = await Promise.all([systemsForScope(tid, scope, scopeId), stylesForScope(tid, scope, scopeId)]);
  const systemsTotal = systems.length;
  const systemsCovered = systems.filter((s) => coveredSystems.has(s.id)).length;
  const missingSystems = systems.filter((s) => !coveredSystems.has(s.id)).map((s) => s.name);

  // Quality / DNA / duplicate signals for the linked assets (bounded by assetSet).
  const assetIds = [...assetSet];
  let qualityScores: number[] = [], readabilityScores: number[] = [], duplicateHigh = 0, dnaScores: number[] = [];
  if (assetIds.length) {
    const [{ data: q }, { data: d }] = await Promise.all([
      supabaseServer.from("visual_asset_quality").select("quality_score, readability_score, duplicate_risk_score").eq("tenant_id", tid).in("asset_id", assetIds),
      supabaseServer.from("asset_dna_analysis").select("overall_score").eq("tenant_id", tid).in("asset_id", assetIds),
    ]);
    qualityScores = (q ?? []).map((r) => r.quality_score as number);
    readabilityScores = (q ?? []).map((r) => r.readability_score as number);
    duplicateHigh = (q ?? []).filter((r) => (r.duplicate_risk_score as number) >= 55).length;
    dnaScores = (d ?? []).map((r) => r.overall_score as number);
  }
  const avgUiRelevance = systemsTotal ? Math.round(systems.reduce((_s) => _s, 0)) : 0; // placeholder replaced below

  const coverage = computeCoverage({
    scope, scopeId, scopeName: scopeRow.name as string,
    totalAssets: assetIds.length, roleCounts, systemsTotal, systemsCovered, missingSystems,
  });
  const intelligence = computeRegistryIntelligence({
    qualityScores, dnaScores, readabilityScores, duplicateHigh,
    totalAssets: assetIds.length, distinctStyles: new Set(styles).size, orphanAssets,
    systemsTotal, systemsCovered, coverageScore: coverage.coverage_score,
    hasIcon: !!scopeRow.icon_asset_id, hasCover: !!(scopeRow as { cover_asset_id?: string }).cover_asset_id,
    erpRoleCount, marketingRoleCount, uiRoleCount, avgUiRelevance,
  });

  return { coverage, intelligence, scope_name: scopeRow.name as string };
}
