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
