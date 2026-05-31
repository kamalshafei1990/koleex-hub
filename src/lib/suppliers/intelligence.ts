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

/* ── Timeline / Activity Intelligence ──
   Unified operational history. event_category mirrors the
   supplier_timeline_events CHECK; event_type is open but labelled here. */
export const TIMELINE_CATEGORY_LABELS: Record<string, string> = {
  relationship: "Relationship",
  communication: "Communication",
  factory: "Factory",
  documents: "Documents",
  procurement: "Procurement",
  system: "System",
};
export const TIMELINE_CATEGORY_ORDER = [
  "relationship", "communication", "factory", "documents", "procurement", "system",
];
export const timelineCategoryLabel = (v: string): string => TIMELINE_CATEGORY_LABELS[v] ?? v;

export const EVENT_TYPE_LABELS: Record<string, string> = {
  // relationship
  supplier_created: "Supplier created",
  status_changed: "Strategic status changed",
  classification_added: "Classification added",
  classification_removed: "Classification removed",
  supplier_archived: "Supplier archived",
  // communication
  contact_added: "Contact added",
  qr_added: "QR code added",
  meeting: "Meeting logged",
  call: "Call logged",
  message: "Message logged",
  supplier_visit: "Supplier visit",
  // factory
  factory_updated: "Factory profile updated",
  factory_visit: "Factory visit",
  audit_performed: "Audit performed",
  // documents
  media_uploaded: "Document uploaded",
  certification_uploaded: "Certification uploaded",
  media_verified: "Document verified",
  certification_verified: "Certification verified",
  document_expired: "Document expired",
  // procurement
  negotiation_note: "Negotiation note",
  sample_requested: "Sample requested",
  sample_approved: "Sample approved",
  issue: "Issue logged",
  quality_issue: "Quality issue",
  // system
  visibility_changed: "Visibility changed",
  readiness_milestone: "Readiness milestone",
  risk_changed: "Risk level changed",
  milestone: "Milestone",
};
export const eventTypeLabel = (v: string): string => EVENT_TYPE_LABELS[v] ?? v;

/* Manual operational event types the composer offers (category is derived). */
export const MANUAL_EVENT_TYPES: { type: string; category: string; label: string }[] = [
  { type: "meeting", category: "communication", label: "Meeting" },
  { type: "call", category: "communication", label: "Call" },
  { type: "message", category: "communication", label: "Message" },
  { type: "supplier_visit", category: "communication", label: "Supplier visit" },
  { type: "factory_visit", category: "factory", label: "Factory visit" },
  { type: "audit_performed", category: "factory", label: "Audit performed" },
  { type: "negotiation_note", category: "procurement", label: "Negotiation note" },
  { type: "sample_requested", category: "procurement", label: "Sample requested" },
  { type: "issue", category: "procurement", label: "Issue" },
  { type: "milestone", category: "relationship", label: "Milestone" },
];

export const IMPORTANCE_LABELS: Record<string, string> = {
  low: "Low", normal: "Normal", high: "High", critical: "Critical",
};
export const IMPORTANCE_ORDER = ["low", "normal", "high", "critical"];

/* ── Risk / Negotiation Intelligence ──
   Built on the Phase-1 Foundation scorecards: supplier_risk_profile (level-
   based qualitative scoring + internal_evaluation_score) and
   supplier_negotiation_intel (flexibility levels + negotiation_score + AI
   summary). Risk *items* (supplier_risk_items) are an additive active-risk
   register keyed by dimension. */

/* risk_level / dependency_level CHECK on supplier_risk_profile */
export const RISK_LEVEL_LABELS: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", critical: "Critical",
};
export const RISK_LEVEL_ORDER = ["low", "medium", "high", "critical"];
export function riskLevelTone(v: string | null | undefined): "low" | "moderate" | "elevated" | "high" | "none" {
  switch (v) { case "low": return "low"; case "medium": return "moderate"; case "high": return "elevated"; case "critical": return "high"; default: return "none"; }
}

/* Qualitative level for stability / quality / flexibility fields (higher = better). */
export const QUALITY_LEVELS = ["low", "medium", "high"] as const;
export const QUALITY_LEVEL_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };

/* supplier_risk_profile level-scored fields (higher = healthier). */
export const RISK_PROFILE_FIELDS: { col: string; label: string }[] = [
  { col: "financial_stability", label: "Financial stability" },
  { col: "delivery_stability", label: "Delivery stability" },
  { col: "quality_stability", label: "Quality stability" },
  { col: "communication_quality", label: "Communication quality" },
  { col: "response_speed", label: "Response speed" },
  { col: "negotiation_flexibility", label: "Negotiation flexibility" },
];

/* supplier_negotiation_intel level-scored fields. */
export const NEGOTIATION_INTEL_FIELDS: { col: string; label: string }[] = [
  { col: "price_flexibility", label: "Price flexibility" },
  { col: "moq_flexibility", label: "MOQ flexibility" },
  { col: "payment_flexibility", label: "Payment flexibility" },
  { col: "communication_flexibility", label: "Communication" },
  { col: "customization_openness", label: "Customization" },
  { col: "exclusivity_openness", label: "Exclusivity openness" },
  { col: "negotiation_difficulty", label: "Negotiation difficulty" },
  { col: "sample_turnaround_speed", label: "Sample turnaround" },
];

/* ── Active risk register (supplier_risk_items) vocab ── */
export const RISK_DIMENSIONS = ["financial", "operational", "strategic", "geographic", "relationship"] as const;
export const RISK_DIMENSION_LABELS: Record<string, string> = {
  financial: "Financial", operational: "Operational", strategic: "Strategic",
  geographic: "Geographic", relationship: "Relationship",
};
export const riskDimensionLabel = (v: string): string => RISK_DIMENSION_LABELS[v] ?? v;
export const SEVERITY_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
export const SEVERITY_ORDER = ["low", "medium", "high", "critical"];
export const RISK_STATUS_LABELS: Record<string, string> = { open: "Open", mitigating: "Mitigating", resolved: "Resolved" };
export const TRUST_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };
export const DEPENDENCY_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };

/* Extra timeline event types emitted by the risk/negotiation layer. */
export const RISK_EVENT_TYPE_LABELS: Record<string, string> = {
  risk_raised: "Risk raised",
  risk_resolved: "Risk resolved",
  risk_downgraded: "Risk downgraded",
  dispute_opened: "Dispute opened",
  negotiation_round: "Negotiation round",
  agreement_reached: "Agreement reached",
  escalation: "Escalation",
  payment_issue: "Payment issue",
};

/* ── Sourcing / Comparison Intelligence (Phase 3) ── */
export const SOURCING_ROLE_LABELS: Record<string, string> = {
  preferred: "Preferred", approved: "Approved", backup: "Backup",
  experimental: "Experimental", blocked: "Blocked",
};
export const SOURCING_ROLE_ORDER = ["preferred", "approved", "backup", "experimental", "blocked"];
export const sourcingRoleLabel = (v: string): string => SOURCING_ROLE_LABELS[v] ?? v;
/** Rank used for ordering (preferred first); blocked sinks to the bottom. */
export const SOURCING_ROLE_RANK: Record<string, number> = {
  preferred: 0, approved: 1, backup: 2, experimental: 3, blocked: 9,
};

/* Sourcing-layer timeline event types. */
export const SOURCING_EVENT_TYPE_LABELS: Record<string, string> = {
  supplier_approved: "Supplier approved (sourcing)",
  supplier_blocked: "Supplier blocked (sourcing)",
  sourcing_role_changed: "Sourcing role changed",
  backup_assigned: "Backup supplier assigned",
  dependency_risk: "Dependency risk raised",
  sourcing_ranking_changed: "Sourcing ranking changed",
};

/** Map a qualitative risk_level to a 0–100 "health" component (higher = safer). */
function riskHealthFromLevel(level: string | null | undefined): number | null {
  switch (level) { case "low": return 85; case "medium": return 60; case "high": return 30; case "critical": return 10; default: return null; }
}
const LEVEL_TO_SCORE: Record<string, number> = { low: 30, medium: 60, high: 90 };

/** Compute a 0–100 sourcing-suitability score (higher = better to source from)
 *  from existing signals. Manual override wins. Weighted mean of whatever
 *  components are present (weights renormalised), so partial data still scores.
 *  Separate from readiness (completeness) and risk (exposure). AI-ready. */
export function computeSourcingScore(ctx: {
  override?: number | null;
  readiness?: number | null;            // 0–100 completeness
  riskLevel?: string | null;            // low|medium|high|critical
  negotiationScore?: number | null;     // 0–100
  certsActive?: number | null;          // verified, non-expired certs
  trustLevel?: string | null;           // low|medium|high
}): number | null {
  if (typeof ctx.override === "number" && Number.isFinite(ctx.override)) return Math.round(ctx.override);
  const comps: { v: number; w: number }[] = [];
  if (typeof ctx.readiness === "number") comps.push({ v: ctx.readiness, w: 0.30 });
  const rh = riskHealthFromLevel(ctx.riskLevel);
  if (rh != null) comps.push({ v: rh, w: 0.30 });
  if (typeof ctx.negotiationScore === "number") comps.push({ v: ctx.negotiationScore, w: 0.20 });
  if (ctx.certsActive != null) comps.push({ v: ctx.certsActive > 0 ? 100 : 0, w: 0.10 });
  if (ctx.trustLevel && LEVEL_TO_SCORE[ctx.trustLevel] != null) comps.push({ v: LEVEL_TO_SCORE[ctx.trustLevel], w: 0.10 });
  if (!comps.length) return null;
  const wsum = comps.reduce((a, c) => a + c.w, 0);
  return Math.round(comps.reduce((a, c) => a + c.v * c.w, 0) / wsum);
}

export function sourcingBand(score: number | null): { label: string; tone: "strong" | "viable" | "weak" | "none" } {
  if (score == null) return { label: "Unscored", tone: "none" };
  if (score >= 70) return { label: "Strong fit", tone: "strong" };
  if (score >= 45) return { label: "Viable", tone: "viable" };
  return { label: "Weak fit", tone: "weak" };
}

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
  | "prospect"
  | "trial"
  | "approved"
  | "preferred"
  | "strategic"
  | "under_review"
  | "suspended"
  | "inactive"
  | "phasing_out"
  | "blocked"
  | "blacklisted";

/* Ordered as a supplier lifecycle: onboarding → active tiers → caution → exit. */
export const STRATEGIC_STATUS_LABELS: Record<StrategicStatus, string> = {
  prospect: "Prospect",
  trial: "Trial",
  approved: "Approved",
  preferred: "Preferred",
  strategic: "Strategic",
  under_review: "Under Review",
  suspended: "Suspended",
  inactive: "Inactive",
  phasing_out: "Phasing Out",
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
