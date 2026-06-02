/* ---------------------------------------------------------------------------
   Koleex Main Suppliers — sourcing-coverage domain helpers.

   A coverage row assigns ONE supplier to ONE taxonomy node
   (division → category → subcategory) with a sourcing role. This module holds
   the shared types, the coverage-health rule, and the board's index helpers.

   Taxonomy source-of-truth is the RUNTIME Supabase taxonomy (divisions /
   categories / subcategories tables — the same ones the /categories and
   /subcategories admin edit). The board fetches it from /api/suppliers/taxonomy
   so that adding or renaming a category/subcategory, or swapping an icon, is
   reflected here immediately. The per-subcategory coverage key is the
   subcategory `code` when set, else its `slug` — every subcategory is therefore
   assignable, including ones added later via the admin (which don't carry a
   KOLEEX code yet).
   --------------------------------------------------------------------------- */

export const COVERAGE_ROLES = ["preferred", "approved", "backup", "experimental", "blocked"] as const;
export type CoverageRole = (typeof COVERAGE_ROLES)[number];

/** Display order within a subcategory — strongest commitment first. */
export const COVERAGE_ROLE_RANK: Record<CoverageRole, number> = {
  preferred: 0,
  approved: 1,
  backup: 2,
  experimental: 3,
  blocked: 9,
};

/** Supplier identity + light intelligence snapshot shown on a coverage card. */
export interface CoverageSupplier {
  id: string;
  name: string;
  logo: string | null;
  country: string | null;
  active: boolean;
  strategicStatus: string | null;
  riskLevel: string | null;        // low | medium | high | critical | null
  evaluationScore: number | null;  // 0-100 (internal_evaluation_score)
  sourcingScore: number | null;    // 0-100 override, if set
  catalogUrl: string | null;       // latest product-catalog / brochure PDF, if any
  catalogName: string | null;      // its title / file name (for the popup header)
}

/** One persisted assignment, enriched with the supplier snapshot for the UI. */
export interface CoverageRow {
  id: string;
  supplier_id: string;
  division_slug: string;
  category_slug: string;
  subcategory_code: string;
  subcategory_label: string | null;
  sourcing_role: CoverageRole;
  sourcing_priority: number | null;
  is_main_supplier: boolean;
  supplier: CoverageSupplier | null;
}

export type CoverageHealthStatus = "healthy" | "warning" | "critical" | "none";

export interface CoverageHealth {
  status: CoverageHealthStatus;
  total: number;       // all assigned suppliers (incl. blocked)
  usable: number;      // non-blocked
  approved: number;    // preferred + approved
  backups: number;     // backup role
  soleSource: boolean; // exactly one usable supplier
}

/* ── Coverage-health rule ───────────────────────────────────────────────────
   Operational reading of sourcing depth per subcategory:
     · none     — nothing assigned yet
     · critical — sole source (≤1 usable supplier) OR no approved/preferred at all
     · healthy  — real depth: 3+ approved/preferred, OR ≥1 approved/preferred WITH a backup
     · warning  — has an approved source but thin (no backup / only one)            */
export function computeCoverageHealth(rows: CoverageRow[]): CoverageHealth {
  const usable = rows.filter((r) => r.sourcing_role !== "blocked");
  const approved = rows.filter((r) => r.sourcing_role === "preferred" || r.sourcing_role === "approved");
  const backups = rows.filter((r) => r.sourcing_role === "backup");
  const soleSource = usable.length === 1;

  let status: CoverageHealthStatus;
  if (rows.length === 0) status = "none";
  else if (usable.length <= 1 || approved.length === 0) status = "critical";
  else if (approved.length >= 3 || (approved.length >= 1 && backups.length >= 1)) status = "healthy";
  else status = "warning";

  return { status, total: rows.length, usable: usable.length, approved: approved.length, backups: backups.length, soleSource };
}

/* ── Taxonomy tree (runtime, DB-driven) ─────────────────────────────────────
   Mirrors the Supabase divisions/categories/subcategories tables. `key` is the
   per-subcategory coverage key (the subcategory `code` when set, else its
   `slug`); `code` is the human KOLEEX code for display (may be null); `slug`
   drives the icon lookup. The board fetches this from /api/suppliers/taxonomy. */
export interface TaxonomySubcategory { key: string; code: string | null; label: string; slug: string }
export interface TaxonomyCategory { slug: string; label: string; blurb: string; subcategories: TaxonomySubcategory[] }
export interface TaxonomyDivision {
  id: string;            // division slug — used as coverage `division_slug`
  name: string;
  description: string;
  status: "live" | "planned";
  categories: TaxonomyCategory[];
}

/** Index coverage rows by `${category_slug}::${subcategory_code}` for O(1) board lookups. */
export function indexCoverage(rows: CoverageRow[]): Map<string, CoverageRow[]> {
  const map = new Map<string, CoverageRow[]>();
  for (const r of rows) {
    const key = `${r.category_slug}::${r.subcategory_code}`;
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const ra = COVERAGE_ROLE_RANK[a.sourcing_role] ?? 5;
      const rb = COVERAGE_ROLE_RANK[b.sourcing_role] ?? 5;
      if (ra !== rb) return ra - rb;
      return (a.supplier?.name ?? "").localeCompare(b.supplier?.name ?? "");
    });
  }
  return map;
}

export const coverageNodeKey = (categorySlug: string, subcategoryCode: string) => `${categorySlug}::${subcategoryCode}`;
