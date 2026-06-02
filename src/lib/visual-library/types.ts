/* ---------------------------------------------------------------------------
   KOLEEX Visual Library — shared types (client + server safe).

   The Visual Library is the single source of truth for every visual asset
   across the Hub (icons, illustrations, photos, diagrams, badges, logos...).
   This module holds the controlled vocabularies + the row shape so the API,
   the governance layer, and the UI all agree on one contract.
   --------------------------------------------------------------------------- */

export const ASSET_TYPES = [
  "icon", "illustration", "photo", "diagram", "badge",
  "logo", "pattern", "ui_element", "feature_graphic", "technical_visual",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STYLES = [
  "outline", "filled", "duotone", "line", "flat",
  "monochrome", "technical", "minimal", "industrial",
  "apple-style", "3d", "isometric", "photographic",
] as const;
export type AssetStyle = (typeof ASSET_STYLES)[number];

export const APPROVAL_STATUSES = ["draft", "pending", "approved", "deprecated", "archived"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** The state shown in the registry UI. "missing" is DERIVED (no file yet). */
export const DISPLAY_STATES = ["missing", "draft", "pending", "approved", "deprecated", "archived"] as const;
export type DisplayState = (typeof DISPLAY_STATES)[number];

export const ASSET_STATUSES = ["active", "inactive", "archived"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/** KOLEEX taxonomy categories the library is organized by (Section 6). */
export const ASSET_CATEGORIES = [
  "Navigation", "Products", "ERP", "Status", "Logistics", "AI & Analytics",
  "Brand", "General",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/* ── Usage Context & Governance (Phase: Visual Operating System) ── */

export const CONTEXT_TYPES = ["ui", "product", "erp", "marketing", "other"] as const;
export type ContextType = (typeof CONTEXT_TYPES)[number];

export const CONTEXT_TYPE_LABEL: Record<ContextType, string> = {
  ui: "UI", product: "Product", erp: "ERP", marketing: "Marketing", other: "Other",
};

export const RULE_KINDS = ["allowed", "forbidden", "preferred"] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export interface UsageContext {
  id: string;
  code: string | null;
  slug: string;
  name: string;
  description: string | null;
  parent_context_id: string | null;
  context_type: ContextType;
  icon: string | null;
  color: string | null;
  status: string;
  sort_order: number;
}

export interface ContextRule {
  id: string;
  entity_type: "asset" | "collection";
  entity_id: string;
  context_id: string;
  rule: RuleKind;
  notes: string | null;
  created_at: string;
  context?: UsageContext | null;
}

export interface GovernanceViolation {
  kind: "forbidden_context" | "deprecated" | "style_mismatch" | "missing_file";
  severity: "warning" | "error";
  message: string;
}

/* ── Collections / Icon Packs (Phase: Collections Intelligence) ── */

export const COLLECTION_TYPES = [
  "ui_system", "business_system", "product_system", "icon_pack", "illustration_pack",
  "brand_assets", "navigation", "dashboard", "semantic_group", "style_system", "experimental",
] as const;
export type CollectionType = (typeof COLLECTION_TYPES)[number];

export const COLLECTION_TYPE_LABEL: Record<CollectionType, string> = {
  ui_system: "UI System", business_system: "Business System", product_system: "Product System",
  icon_pack: "Icon Pack", illustration_pack: "Illustration Pack", brand_assets: "Brand Assets",
  navigation: "Navigation", dashboard: "Dashboard", semantic_group: "Semantic Group",
  style_system: "Style System", experimental: "Experimental",
};

export const COLLECTION_ROLES = [
  "primary", "secondary", "accent", "deprecated", "recommended", "fallback", "featured",
] as const;
export type CollectionRole = (typeof COLLECTION_ROLES)[number];

export const COLLECTION_STATES = ["draft", "approved", "archived", "deprecated", "internal_only"] as const;
export type CollectionState = (typeof COLLECTION_STATES)[number];

export const COLLECTION_STYLES = [
  "minimal_outline", "apple_style", "rounded_geometry", "industrial_controls",
  "technical_icons", "monochrome", "filled",
] as const;

/** Free grouping buckets shown in the browser sidebar. */
export const COLLECTION_CATEGORIES = ["Core System", "Business", "Design", "Product", "Other"] as const;

export interface VisualCollection {
  id: string;
  tenant_id: string;
  code: string | null;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  collection_type: CollectionType;
  style_type: string | null;
  icon_asset_id: string | null;
  cover_asset_id: string | null;
  approval_status: CollectionState;
  visibility: string;
  usage_context: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // ── Governance (Phase: Visual OS) ──
  preferred_style: string | null;
  preferred_stroke: string | null;
  preferred_corner_radius: string | null;
  preferred_monochrome: boolean | null;
  preferred_fill: string | null;
  design_system_level: string | null;
  target_modules: string[];
  target_platforms: string[];
  // Enriched at read-time
  asset_count?: number;
  icon_url?: string | null;
  cover_url?: string | null;
}

export interface CollectionAsset {
  id: string;
  collection_id: string;
  asset_id: string;
  role: CollectionRole;
  sort_order: number;
  notes: string | null;
  created_at: string;
  asset?: VisualAsset | null;
}

/* ── Semantic Relationships (Phase: Semantic Intelligence) ── */

export const RELATIONSHIP_TYPES = [
  "similar_to", "alternative_of", "parent_of", "child_of", "used_with", "opposite_of",
  "represents", "recommended_for", "not_recommended_for", "variation_of",
  "belongs_to_collection", "semantic_match", "visual_match", "style_match",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_STATUSES = ["suggested", "approved", "rejected", "archived"] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

/** Human label for each relationship type. */
export const RELATIONSHIP_LABEL: Record<RelationshipType, string> = {
  similar_to: "Similar to",
  alternative_of: "Alternative of",
  parent_of: "Parent of",
  child_of: "Child of",
  used_with: "Used with",
  opposite_of: "Opposite of",
  represents: "Represents",
  recommended_for: "Recommended for",
  not_recommended_for: "Not recommended for",
  variation_of: "Variation of",
  belongs_to_collection: "In collection",
  semantic_match: "Semantic match",
  visual_match: "Visual match",
  style_match: "Style match",
};

/** Reverse type to auto-create on the target (null = one-way, no reverse). */
export const REVERSE_TYPE: Record<RelationshipType, RelationshipType | null> = {
  similar_to: "similar_to",
  alternative_of: "alternative_of",
  parent_of: "child_of",
  child_of: "parent_of",
  used_with: "used_with",
  opposite_of: "opposite_of",
  represents: null,
  recommended_for: null,
  not_recommended_for: null,
  variation_of: null,
  belongs_to_collection: null,
  semantic_match: "semantic_match",
  visual_match: "visual_match",
  style_match: "style_match",
};

export interface VisualAssetRelationship {
  id: string;
  tenant_id: string;
  source_asset_id: string;
  target_asset_id: string;
  relationship_type: RelationshipType;
  confidence_score: number;
  status: RelationshipStatus;
  notes: string | null;
  origin: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** The asset at the other end (enriched at read-time). */
  related_asset?: {
    id: string; title: string; visual_asset_code: string; slug: string | null;
    category: string | null; svg_path: string | null; storage_bucket: string | null;
    public_url: string | null; approval_status: string;
  } | null;
}

/** A row from public.visual_assets. */
export interface VisualAsset {
  id: string;
  tenant_id: string;
  visual_asset_code: string;
  source_name: string | null;
  title: string;
  title_cn: string | null;
  title_ar: string | null;
  description: string | null;
  asset_type: AssetType;
  category: string | null;
  subcategory: string | null;
  flaticon_folder: string | null;
  tags: string[];
  usage: string[];
  style: AssetStyle | null;
  file_type: string | null;
  storage_bucket: string | null;
  svg_path: string | null;
  preview_path: string | null;
  original_file: string | null;
  viewbox: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  is_multipath: boolean;
  is_variant: boolean;
  variant_of: string | null;
  status: AssetStatus;
  approval_status: ApprovalStatus;
  is_active: boolean;
  source: string | null;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // ── Vocabulary registry (Phase 2A) ──
  slug: string | null;
  keywords: string[];
  synonyms: string[];
  search_aliases: string[];
  linked_modules: string[];
  linked_apps: string[];
  usage_count: number;
  version: number;
  theme: string | null;
  // ── Semantic Intelligence (Phase: AI-prep) ──
  semantic_meaning: string | null;
  visual_style_description: string | null;
  ai_prompt_description: string | null;
  collections: string[];
  // ── AI-prep governance (Phase: Visual OS; schema only) ──
  ai_usage_priority: number;
  ai_confidence: number | null;
  ai_recommended_contexts: string[];
  ai_rejected_contexts: string[];
  ai_style_vector: Record<string, unknown>;
  // ── Visual family / dependency / usage (Phase: Asset Workspace) ──
  visual_family: string | null;
  shape_language: string | null;
  stroke_family: string | null;
  corner_radius_family: string | null;
  parent_asset_id: string | null;
  derived_from_id: string | null;
  used_in_modules: string[];
  used_in_pages: string[];
  used_in_products: string[];
  used_in_templates: string[];
  used_in_dashboards: string[];
  last_used_at: string | null;
  /** Derived at read-time from storage_bucket + svg_path (not a column). */
  public_url?: string | null;
}

/* ── KOLEEX Design DNA (Phase: Brand Visual Intelligence) ── */

export const DNA_PERSONALITIES = [
  "minimal", "futuristic", "industrial", "luxury", "corporate", "technical",
  "playful", "dense", "soft", "sharp", "geometric", "neutral",
] as const;
export type DnaPersonality = (typeof DNA_PERSONALITIES)[number];

export const DNA_MATCH_STATUSES = ["excellent", "strong", "partial", "weak", "off_brand"] as const;
export type DnaMatchStatus = (typeof DNA_MATCH_STATUSES)[number];

export interface DnaProfile {
  id: string; code: string | null; name: string; slug: string;
  description: string | null; profile_type: string; status: string;
}
export interface DnaRule {
  id: string; profile_id: string; rule_group: string; rule_name: string;
  rule_type: "required" | "preferred" | "forbidden"; target_value: string | null;
  tolerance: number | null; weight: number; notes: string | null;
}
export interface DnaPattern {
  id: string; profile_id: string; pattern_name: string; description: string | null;
  category: string | null; example_asset_ids: string[]; pattern_vector: Record<string, unknown>; approved: boolean;
}
export interface DnaPatternMatch { pattern_name: string; score: number }

export interface DnaAnalysis {
  asset_id: string; profile_id: string;
  overall_score: number; geometry_score: number; spacing_score: number; corner_score: number;
  stroke_score: number; minimalism_score: number; futuristic_score: number; industrial_score: number;
  luxury_score: number; symmetry_score: number; balance_score: number; readability_score: number; consistency_score: number;
  shape_language: string | null; visual_density: number | null; stroke_family: string | null;
  corner_family: string | null; geometry_family: string | null; negative_space_ratio: number | null;
  complexity_level: string | null; visual_weight: string | null; icon_personality: string | null; visual_temperature: string | null;
  violates_brand_language: boolean; too_complex: boolean; inconsistent_stroke: boolean;
  weak_balance: boolean; over_detailed: boolean; poor_scalability: boolean;
  pattern_matches: DnaPatternMatch[];
  computed_at?: string; reviewed_by?: string | null; review_notes?: string | null;
}

/* ── Visual Quality Control (Phase: Visual QA) ── */

export const QUALITY_STATUSES = ["excellent", "good", "acceptable", "poor", "rejected"] as const;
export type QualityStatus = (typeof QUALITY_STATUSES)[number];

export interface QualityWarning {
  kind: string;
  severity: "warning" | "error";
  message: string;
}

export interface QualityProfile {
  id?: string;
  asset_id: string;
  quality_score: number;
  style_consistency_score: number;
  stroke_consistency_score: number;
  spacing_score: number;
  dark_mode_score: number;
  simplicity_score: number;
  uniqueness_score: number;
  readability_score: number;
  scalability_score: number;
  duplicate_risk_score: number;
  visual_noise_score: number;
  outdated_risk_score: number;
  collection_match_score: number;
  overall_status: QualityStatus;
  stroke_width: string | null;
  stroke_style: string | null;
  corner_style: string | null;
  shape_language: string | null;
  complexity_level: string | null;
  visual_density: number | null;
  padding_ratio: number | null;
  symmetry_score: number | null;
  optical_balance_score: number | null;
  monochrome_compatibility: number | null;
  dark_background_compatibility: number | null;
  small_size_readability: number | null;
  duplicate_group_id: string | null;
  visually_similar_to: string[];
  ai_notes: string | null;
  manual_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  computed_at?: string;
}

export interface VisualAssetEvent {
  id: string;
  asset_id: string;
  event_type: string;
  summary: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Derive the registry display-state. "missing" when no file is attached. */
export function displayState(a: Pick<VisualAsset, "svg_path" | "status" | "approval_status">): DisplayState {
  if (a.status === "archived") return "archived";
  if (!a.svg_path) return "missing";
  return a.approval_status;
}

export interface VisualAssetListResponse {
  assets: VisualAsset[];
  total: number;
  page: number;
  pageSize: number;
}
