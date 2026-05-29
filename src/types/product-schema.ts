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

export interface SpecFieldOption {
  value: string;
  label: string;
  icon?: string;
  image?: string;
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
}

export interface SpecGroup {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  order: number;
  visibility?: Partial<VisibilityFlags>;
  requiredCompletionMode?: 'all' | 'any';
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
