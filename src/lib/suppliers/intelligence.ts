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

/** Resolve the visibility tier a server caller is entitled to, from their
 *  auth flags. Super admins (and break-glass `can_view_private` roles) get
 *  full management-tier visibility; everyone else with Suppliers access is
 *  treated as procurement. This is the gate used to project communication
 *  intelligence (contacts + QR) so finance/management-tier records never
 *  reach lower tiers. Conservative by design. */
export function resolveCallerTier(auth: {
  is_super_admin?: boolean;
  can_view_private?: boolean;
}): VisibilityTier {
  if (auth.is_super_admin) return "management";
  if (auth.can_view_private) return "finance";
  return "procurement";
}

/** Tiers at or below `callerTier` — the set safe to query/return. */
export function visibleTiers(callerTier: VisibilityTier): VisibilityTier[] {
  const max = VISIBILITY_ORDER.indexOf(callerTier);
  return VISIBILITY_ORDER.filter((_, i) => i <= max);
}

/* ── Contact-person role hierarchy (mirrors the supplier_contact_persons
   .role_category CHECK exactly — do not add values without a migration).
   Finer titles (e.g. "Sales Manager" vs "Sales Representative", "Export
   Manager") live in the free-text role/position fields. */
export const ROLE_CATEGORY_LABELS: Record<string, string> = {
  boss: "Boss",
  owner: "Owner",
  management: "Management",
  sales: "Sales",
  support: "Technical Support",
  qc: "QC",
  engineering: "Engineering",
  logistics: "Logistics",
  finance: "Finance",
  other: "Other",
};
export const ROLE_CATEGORY_ORDER: string[] = [
  "boss", "owner", "management", "sales", "support",
  "engineering", "qc", "logistics", "finance", "other",
];
export const roleCategoryLabel = (v: string): string => ROLE_CATEGORY_LABELS[v] ?? v;

/* contact reliability rating (mirrors supplier_contact_persons.reliability CHECK) */
export const RELIABILITY_LABELS: Record<string, string> = {
  high: "High", medium: "Medium", low: "Low", unknown: "Unknown",
};

/* ── Preferred communication channels ── */
export const CHANNEL_LABELS: Record<string, string> = {
  wechat: "WeChat",
  wecom: "WeCom",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "Email",
  mobile: "Phone / Mobile",
  line: "LINE",
  skype: "Skype",
};
export const channelLabel = (v: string): string => CHANNEL_LABELS[v] ?? v;

/* ── QR / communication-media categories (supplier_media.category for QR) ── */
export const QR_CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  support: "Technical Support",
  finance: "Finance",
  boss: "Boss",
  logistics: "Logistics",
  group: "Group",
  showroom: "Showroom",
  factory: "Factory",
};
export const QR_CATEGORY_ORDER: string[] = [
  "sales", "support", "boss", "finance", "logistics", "group", "showroom", "factory",
];
export const qrCategoryLabel = (v: string): string => QR_CATEGORY_LABELS[v] ?? v;

/* ── Media & Documents evidence taxonomy (mirrors supplier_media.category) ──
   Grouped for the Media tab. QR categories live with the Contacts tranche;
   here we cover certifications, commercial, factory, legal, procurement. */
export const DOC_CATEGORY_LABELS: Record<string, string> = {
  // certifications
  certification: "Certification",
  // commercial
  product_catalog: "Catalog", quotation: "Quotation", price_list: "Price list",
  brochure: "Brochure", presentation: "Presentation",
  // factory
  factory_photo: "Factory photo", factory_video: "Factory video",
  production_line: "Production line", qc_photo: "QC photo",
  warehouse_photo: "Warehouse photo", showroom_photo: "Showroom photo",
  production_video: "Production video",
  // legal
  nda: "NDA", contract: "Contract", license: "License",
  business_license: "Business license", registration: "Registration",
  compliance_doc: "Compliance document",
  // procurement
  sample_report: "Sample report", audit_report: "Audit report",
  inspection_report: "Inspection report", packing_standard: "Packing standard",
  // misc
  product_photo: "Product photo", product_video: "Product video",
  team_photo: "Team photo", company_logo: "Company logo",
  business_card: "Business card", other: "Other",
};
export const docCategoryLabel = (v: string): string => DOC_CATEGORY_LABELS[v] ?? v;

/* Ordered groups for the Media tab (certifications shown first as evidence). */
export const DOC_CATEGORY_GROUPS: { key: string; label: string; categories: string[] }[] = [
  { key: "certifications", label: "Certifications", categories: ["certification"] },
  { key: "commercial", label: "Commercial", categories: ["product_catalog", "quotation", "price_list", "brochure", "presentation"] },
  { key: "factory", label: "Factory", categories: ["factory_photo", "factory_video", "production_line", "qc_photo", "warehouse_photo", "showroom_photo", "production_video"] },
  { key: "legal", label: "Legal", categories: ["nda", "contract", "license", "business_license", "registration", "compliance_doc"] },
  { key: "procurement", label: "Procurement", categories: ["sample_report", "audit_report", "inspection_report", "packing_standard"] },
  { key: "other", label: "Other", categories: ["product_photo", "product_video", "team_photo", "company_logo", "business_card", "other"] },
];

/* Certification types (stored in supplier_media.cert_type). */
export const CERT_TYPE_LABELS: Record<string, string> = {
  iso: "ISO", ce: "CE", rohs: "RoHS", bsci: "BSCI", sedex: "SEDEX",
  fda: "FDA", gots: "GOTS", reach: "REACH", other: "Other",
};
export const CERT_TYPE_ORDER = ["iso", "ce", "rohs", "bsci", "sedex", "fda", "gots", "reach", "other"];
export const certTypeLabel = (v: string): string => CERT_TYPE_LABELS[v] ?? v;

/* Lifecycle status labels (mirrors supplier_media.lifecycle_status CHECK). */
export const LIFECYCLE_LABELS: Record<string, string> = {
  active: "Active", expired: "Expired", superseded: "Superseded",
  revoked: "Revoked", archived: "Archived", pending_review: "Pending review",
};
export const lifecycleLabel = (v: string): string => LIFECYCLE_LABELS[v] ?? v;

/* Categories whose assets are sensitive by nature → stored privately and
   served via signed URLs (never a public bucket). Visibility finance/management
   is also treated as sensitive regardless of category. */
export const SENSITIVE_CATEGORIES = new Set<string>([
  "contract", "nda", "audit_report", "inspection_report",
  "business_license", "license", "registration", "compliance_doc",
]);

/** True when a media asset must use the private (signed-URL) storage path. */
export function isSensitiveAsset(category: string, visibility: string): boolean {
  if (visibility === "finance" || visibility === "management") return true;
  return SENSITIVE_CATEGORIES.has(category);
}

/** A certification is "trusted" when it's verified, active, and not past expiry. */
export function certIsTrusted(row: {
  lifecycle_status?: string | null;
  verified_at?: string | null;
  expiry_date?: string | null;
}, today: string): boolean {
  if (row.lifecycle_status && row.lifecycle_status !== "active") return false;
  if (!row.verified_at) return false;
  if (row.expiry_date && row.expiry_date < today) return false;
  return true;
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

/* ── Factory type vocabulary (mirrors supplier_factory_profile CHECK) ── */
export const FACTORY_TYPE_LABELS: Record<string, string> = {
  own_factory: "Own factory",
  partner_factory: "Partner factory",
  contract_manufacturer: "Contract manufacturer",
  trading_only: "Trading (no factory)",
  multiple: "Multiple factories",
};
export const factoryTypeLabel = (v: string): string => FACTORY_TYPE_LABELS[v] ?? v;

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
  /** 1:1 supplier_factory_profile row (raw), if present */
  factory?: Record<string, unknown> | null;
  /* ── Communication intelligence (Contacts + QR tranche) ── */
  /** contact persons that carry at least one messaging channel
   *  (wechat / wecom / whatsapp / telegram / mobile). */
  contactsWithChannel?: number;
  /** contact persons with preferred channel and/or language filled. */
  contactsWithPreferences?: number;
  /** governed QR codes registered for this supplier (any visibility). */
  qrCodes?: number;
  /* ── Evidence assets (Media + Documents tranche) ── */
  /** verified, active, non-expired certification documents. */
  certsActive?: number;
  /** certification documents past their expiry date (downgrades trust). */
  certsExpired?: number;
  /** factory-evidence media (photos/videos of plant, lines, QC, warehouse). */
  factoryMediaCount?: number;
  /** verified procurement evidence (audit / inspection / sample reports). */
  docsVerified?: number;
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
  const f = ctx.factory ?? {};
  const fg = (...keys: string[]) => keys.some((k) => filled(f[k]));

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
      total: 6,
      met:
        Number(g("employee_count_range") || fg("employee_count")) +
        Number(g("annual_revenue_range") || fg("annual_output")) +
        Number(g("factory_visit_date")) +
        Number(fg("factory_type")) +
        Number(fg("production_lines") || fg("monthly_capacity")) +
        Number(fg("factory_size_sqm") || fg("main_export_markets") || fg("production_categories")),
    },
    {
      key: "certifications",
      label: "Certifications",
      weight: 13,
      total: 3,
      met:
        Number(g("certifications") || (ctx.certsActive ?? 0) > 0) +
        Number(g("sample_status")) +
        // verified, non-expired certification evidence (not just a claim)
        Number((ctx.certsActive ?? 0) > 0),
    },
    {
      key: "contacts",
      label: "Contacts",
      weight: 10,
      total: 5,
      met:
        Number(g("supplier_email", "email")) +
        Number(g("supplier_tel", "supplier_mobile", "phone")) +
        Number(g("contact_persons") || ctx.contactPersons > 0) +
        Number((ctx.contactsWithChannel ?? 0) > 0) +
        Number(
          (ctx.qrCodes ?? 0) > 0 ||
          (ctx.contactsWithPreferences ?? 0) > 0,
        ),
    },
    {
      key: "media",
      label: "Media",
      weight: 10,
      total: 3,
      met:
        Number(g("photo_url")) +
        Number(ctx.media > 0) +
        Number((ctx.factoryMediaCount ?? 0) > 0),
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
      total: 4,
      met:
        Number(ctx.purchaseOrders > 0) +
        Number(ctx.receipts > 0) +
        Number(ctx.bills > 0) +
        // verified operational evidence (audit / inspection / sample report)
        Number((ctx.docsVerified ?? 0) > 0),
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
