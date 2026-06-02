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
  /** Derived at read-time from storage_bucket + svg_path (not a column). */
  public_url?: string | null;
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
