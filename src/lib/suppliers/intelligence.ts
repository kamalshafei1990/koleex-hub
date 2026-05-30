/* ---------------------------------------------------------------------------
   Supplier Intelligence — shared vocabulary, visibility model, and the
   computed Readiness score.

   This is the typed contract over the Supplier Intelligence schema
   (migration: supplier_intelligence_foundation). A supplier is a `contacts`
   row (contact_type='supplier'); intelligence hangs off it via child tables.
   Pure + server-safe — no React, no fetch.
   --------------------------------------------------------------------------- */

/* ── Visibility tiers (mirror the Postgres `visibility_tier` enum) ──
   Monotonic: a caller at tier N sees tiers 0..N. Drives server-side
   projection so internal/finance/management intel never leaks to public
   or product surfaces. */
export type VisibilityTier =
  | "public"
  | "internal"
  | "procurement"
  | "finance"
  | "management";

export const VISIBILITY_ORDER: VisibilityTier[] = [
  "public",
  "internal",
  "procurement",
  "finance",
  "management",
];

/** True when a caller at `callerTier` may see data classified `fieldTier`. */
export function canSee(callerTier: VisibilityTier, fieldTier: VisibilityTier): boolean {
  return VISIBILITY_ORDER.indexOf(callerTier) >= VISIBILITY_ORDER.indexOf(fieldTier);
}

/* ── Strategic lifecycle ── */
export type StrategicStatus =
  | "strategic"
  | "preferred"
  | "approved"
  | "trial"
  | "inactive"
  | "blocked"
  | "blacklisted";

export const STRATEGIC_STATUS_LABELS: Record<StrategicStatus, string> = {
  strategic: "Strategic",
  preferred: "Preferred",
  approved: "Approved",
  trial: "Trial",
  inactive: "Inactive",
  blocked: "Blocked",
  blacklisted: "Blacklisted",
};

/* tone hint for monochrome UI: positive (filled), neutral, or danger */
export function strategicStatusTone(s: string | null | undefined): "positive" | "neutral" | "danger" {
  switch (s) {
    case "strategic":
    case "preferred":
    case "approved":
      return "positive";
    case "blocked":
    case "blacklisted":
      return "danger";
    default:
      return "neutral";
  }
}

/* ── Classification vocabulary ── */
export type SupplierClassification =
  | "manufacturer"
  | "factory_trading"
  | "pure_trading"
  | "oem_specialist"
  | "odm_specialist"
  | "component"
  | "electronics"
  | "packaging"
  | "raw_material"
  | "assembly"
  | "software"
  | "logistics_partner"
  | "service_provider";

export const CLASSIFICATION_LABELS: Record<SupplierClassification, string> = {
  manufacturer: "Manufacturer",
  factory_trading: "Factory + Trading",
  pure_trading: "Pure Trading",
  oem_specialist: "OEM Specialist",
  odm_specialist: "ODM Specialist",
  component: "Component Supplier",
  electronics: "Electronics Supplier",
  packaging: "Packaging Supplier",
  raw_material: "Raw Material Supplier",
  assembly: "Assembly Supplier",
  software: "Software Supplier",
  logistics_partner: "Logistics Partner",
  service_provider: "Service Provider",
};

export const classificationLabel = (v: string): string =>
  CLASSIFICATION_LABELS[v as SupplierClassification] ?? v;

/* ── Readiness / completeness score (computed, never stored stale) ──
   Eight weighted dimensions summing to 100. Each scores the share of its
   checks met × weight; per-dimension fraction is returned so the UI can
   show "Certifications 1/2". Inputs reuse existing contacts fields + child
   counts — no new scoring columns. */
export interface ReadinessContext {
  /** the supplier contacts row (raw) */
  supplier: Record<string, unknown>;
  classifications: number;
  contactPersons: number;
  media: number;
  purchaseOrders: number;
  bills: number;
  receipts: number;
}

export interface ReadinessDimension {
  key: string;
  label: string;
  weight: number;
  met: number;
  total: number;
  fraction: number;
}
export interface Readiness {
  score: number;
  dimensions: ReadinessDimension[];
}

const filled = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return v;
  return true;
};

export function computeReadiness(ctx: ReadinessContext): Readiness {
  const s = ctx.supplier;
  const g = (...keys: string[]) => keys.some((k) => filled(s[k]));

  const dims: Array<Omit<ReadinessDimension, "fraction">> = [
    {
      key: "identity",
      label: "Identity",
      weight: 15,
      total: 5,
      met:
        Number(g("company_name_en", "company_name", "display_name")) +
        Number(g("country", "origin_country")) +
        Number(g("year_established")) +
        Number(g("business_registration_number", "tax_id")) +
        Number(g("supplier_type") || ctx.classifications > 0),
    },
    {
      key: "commercial",
      label: "Commercial",
      weight: 15,
      total: 5,
      met:
        Number(g("payment_terms")) +
        Number(g("currency")) +
        Number(g("moq")) +
        Number(g("lead_time")) +
        Number(g("incoterms")),
    },
    {
      key: "factory",
      label: "Factory",
      weight: 12,
      total: 3,
      met:
        Number(g("employee_count_range")) +
        Number(g("annual_revenue_range")) +
        Number(g("factory_visit_date")),
    },
    {
      key: "certifications",
      label: "Certifications",
      weight: 13,
      total: 2,
      met: Number(g("certifications")) + Number(g("sample_status")),
    },
    {
      key: "contacts",
      label: "Contacts",
      weight: 10,
      total: 3,
      met:
        Number(g("supplier_email", "email")) +
        Number(g("supplier_tel", "supplier_mobile", "phone")) +
        Number(g("contact_persons") || ctx.contactPersons > 0),
    },
    {
      key: "media",
      label: "Media",
      weight: 10,
      total: 2,
      met: Number(g("photo_url")) + Number(ctx.media > 0),
    },
    {
      key: "legal",
      label: "Legal",
      weight: 15,
      total: 3,
      met:
        Number(g("kyc_status")) +
        Number(g("tax_id", "business_registration_number")) +
        Number(g("website", "supplier_website")),
    },
    {
      key: "operational",
      label: "Operational",
      weight: 10,
      total: 3,
      met:
        Number(ctx.purchaseOrders > 0) +
        Number(ctx.receipts > 0) +
        Number(ctx.bills > 0),
    },
  ];

  const dimensions: ReadinessDimension[] = dims.map((d) => ({
    ...d,
    fraction: d.total > 0 ? d.met / d.total : 0,
  }));
  const score = Math.round(
    dimensions.reduce((sum, d) => sum + d.fraction * d.weight, 0),
  );
  return { score: Math.max(0, Math.min(100, score)), dimensions };
}
