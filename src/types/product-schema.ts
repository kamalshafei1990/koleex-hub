/**
 * Product Schema Engine — type definitions.
 *
 * This file defines the SHAPE that values stored in the `products.schema_specs`
 * JSONB column must conform to at runtime. Schemas are resolved by walking from
 * the most specific scope (machineKindId) to the most general (divisionCode),
 * falling back through subcategoryCode → categoryCode → divisionCode → default.
 * Visibility flags on groups and fields control which surfaces (public site,
 * quote, invoice, brochure, AI, comparison, filters, etc.) see each field.
 */

export interface VisibilityFlags {
  internalOnly: boolean;
  publicVisible: boolean;
  websiteVisible: boolean;
  quoteVisible: boolean;
  invoiceVisible: boolean;
  brochureVisible: boolean;
  aiReadable: boolean;
  comparable: boolean;
  filterVisible: boolean;
  searchable: boolean;
  translatable: boolean;
}

export type SpecFieldType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'chips'
  | 'icon_chips'
  | 'image_chips'
  | 'unit_number'
  | 'dimension'
  | 'range'
  | 'file'
  | 'image'
  | 'video'
  | 'url'
  | 'rich_text'
  | 'table'
  | 'object'
  | 'array'
  | 'relation';

export type VisualRenderType =
  | 'plain_text'
  | 'spec_card'
  | 'icon_chip'
  | 'image_chip'
  | 'material_card'
  | 'application_card'
  | 'comparison_row'
  | 'technical_badge'
  | 'boolean_feature'
  | 'metric_block'
  | 'gallery_block'
  | 'packing_block'
  | 'download_block'
  | 'ai_fact'
  | 'brochure_block';

/* Visual classification for an option — drives which renderer the
   ProductPreview / future surfaces use. Optional; falls back to a plain
   chip when absent. */
export type OptionVisualType =
  | 'material'
  | 'application'
  | 'garment'
  | 'motor'
  | 'feed'
  | 'hook'
  | 'plug'
  | 'automation'
  | 'weight'
  | 'generic';

export interface SpecFieldOption {
  value: string;
  label: string;
  /* ── Visual option metadata (all optional, future-safe) ──
     A central registry (src/lib/product-schema/visual-options.ts) supplies
     these for known option values so individual schemas don't re-declare
     them; a schema MAY override any of them inline here. */
  icon?: string;          // glyph token resolved by VisualGlyph (e.g. "motor-servo")
  image?: string;         // optional raster/texture URL
  swatch?: string;        // muted material tone (CSS color) for material cards
  description?: string;   // one-line explanation, shown on cards / tooltips / AI
  visualType?: OptionVisualType;
  badge?: string;         // short region / class label (e.g. "EU", "UK")
  illustration?: string;  // optional inline-SVG token for richer diagrams
  animationKey?: string;  // reserved for future motion (no-op today)
}

export interface SpecFieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
}

export interface SpecField extends VisibilityFlags {
  id: string;
  key: string;
  label: string;
  description?: string;
  helpText?: string;
  order: number;
  fieldType: SpecFieldType;
  dataType: 'string' | 'number' | 'boolean' | 'json';
  unit?: string;
  required: boolean;
  options?: SpecFieldOption[];
  validation?: SpecFieldValidation;
  defaultValue?: unknown;
  visualRenderType: VisualRenderType;
  /* Optional visual domain for this field's options. When set, the visual
     registry resolves swatches/glyphs/descriptions for each option value
     from this domain. Falls back to a field-key map in the registry. */
  optionSet?: OptionVisualType;
  /* ── Product Intelligence Anchors ──
     Lets a field declare it deserves hero-level visual priority — even
     when it isn't numeric (e.g. "Direct Drive", "Semi-Dry Head", "Auto
     Thread Trimmer"). Generic + schema-driven: ProductPreview (and future
     surfaces) collect anchored fields into the top anchor strip.
       importance     — semantic weight; drives default ordering.
       anchor         — force into / out of the anchor strip explicitly.
       anchorGroup    — optional cluster label (e.g. "Drive", "Automation").
       anchorPriority — explicit sort key (lower = earlier); overrides importance. */
  importance?: "critical" | "high" | "normal" | "quiet";
  anchor?: boolean;
  anchorGroup?: string;
  anchorPriority?: number;
  /* Smart-intelligence interpretation — a human, benefit-oriented sentence
     that explains what this spec MEANS for production (e.g. "550" + "W" →
     "Energy-efficient servo tuned for long production shifts"). Surfaced in
     the Layer-2 Product Intelligence band. Schema-driven + generic: any
     field can carry one; absent → the field simply isn't summarized. */
  insight?: string;
  /* Auto-derive this field's value from another field. When the source field
     changes, this field is recomputed and filled in — but it stays editable so
     an operator can override. Currently supported formula:
       'cbm_m3_from_mm_dimensions' — parses the source (an "L×W×H" string in mm,
        any separator) and returns cubic metres = L·W·H / 1e9. */
  computed?: { from: string; formula: 'cbm_m3_from_mm_dimensions' };
  /** Suggested values offered as a dropdown (datalist) on a free-entry
   *  number/text field. The operator can pick one OR type any other value —
   *  it never restricts input. Use for common-but-not-fixed specs (e.g. cloth
   *  widths, travel speeds) where a select would be too rigid. */
  suggestions?: (string | number)[];
}

export interface SpecGroup {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  order: number;
  visibility?: Partial<VisibilityFlags>;
  requiredCompletionMode?: 'all' | 'any';
  /**
   * Which tab of the product-data form edits this group. Defaults to "specs".
   * "logistics" routes the group to the Logistics & Customs step instead — used
   * for shipping-unit data (packing dimensions, CBM, net/gross weight) that
   * belongs with freight/customs rather than machine specs. Storage is
   * unchanged either way: values still live in products.schema_specs.
   */
  formTab?: 'specs' | 'logistics';
  fields: SpecField[];
}

export interface ProductSchemaDefinition {
  id: string;
  divisionCode: string;
  categoryCode: string;
  subcategoryCode: string;
  machineKindId?: string;
  name: string;
  version: string;
  appliesTo?: {
    description?: string;
  };
  groups: SpecGroup[];
}

export type ProductKnowledgeBlockType =
  | 'overview'
  | 'key_features'
  | 'applications'
  | 'suitable_materials'
  | 'selling_points'
  | 'technical_advantages'
  | 'operation_notes'
  | 'maintenance_notes'
  | 'buyer_questions'
  | 'comparison_notes'
  | 'recommended_use_cases'
  | 'limitations'
  | 'warnings'
  | 'troubleshooting'
  | 'ai_summary'
  | 'package_contents'
  | 'warranty_notes';

export interface ProductKnowledgeBlock {
  id: string;
  type: ProductKnowledgeBlockType;
  title: string;
  content: string | string[] | Record<string, unknown>;
  visibility: VisibilityFlags;
  aiWeight: number;
  relatedFields?: string[];
}

export interface ProductSchemaResolution {
  schema: ProductSchemaDefinition | null;
  source: 'exact' | 'subcategory' | 'category' | 'fallback';
  appliedRules: string[];
}

export type ProductSchemaSurface =
  | 'internal'
  | 'public'
  | 'website'
  | 'quote'
  | 'invoice'
  | 'brochure'
  | 'ai'
  | 'comparison'
  | 'filters';
