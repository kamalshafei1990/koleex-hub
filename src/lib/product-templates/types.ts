/* ---------------------------------------------------------------------------
   product-templates/types.ts — Phase 1 Foundation
   Shared shapes for the dynamic Product Template Engine.

   This is the FOUNDATION layer. It runs alongside the existing
   products / product_models / product_sewing_specs system without
   touching it. Future phases will gradually migrate hard-coded forms
   to render from these structures.
   --------------------------------------------------------------------------- */

/* ── Supported field types ───────────────────────────────────────────────
   Adding a new type is a 3-step change:
     1. Add it here.
     2. Extend the chk_field_type SQL CHECK constraint.
     3. Add a case in FieldRenderer.tsx.
   For Phase 1 we cap the list at the 14 below. */
export const FIELD_TYPES = [
  "text",
  "rich_text",
  "number",
  "boolean",
  "select",
  "multi_select",
  "measurement",
  "icon_select",
  "image_select",
  "color_select",
  "media",
  "file",
  "repeater",
  "feature_cards",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/* ── DB row shapes ───────────────────────────────────────────────────── */

export interface ProductTemplate {
  id: string;
  name: string;
  slug: string;
  division_slug: string | null;
  category_slug: string | null;
  subcategory_slug: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductTemplateSection {
  id: string;
  template_id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_public: boolean;
  created_at: string;
}

/* options_json shape varies by field_type. Common patterns:
   - select / multi_select / icon_select / image_select / color_select:
       { options: [{ value, label, icon?, image?, color? }] }
   - repeater:
       { item_schema: [{ key, label, type, required? }] }
   - feature_cards:
       { card_schema: [{ key, label, type }] }
   The renderer tolerates an empty/missing options_json — it just won't
   show choices. */
export interface ProductTemplateField {
  id: string;
  section_id: string;
  /* Denormalized from product_template_sections.template_id by a DB
     trigger. Powers the UNIQUE (template_id, field_key) lock — see
     migration lock_field_key_unique_per_template.sql. Never written
     by API callers; always derived from the parent section. */
  template_id: string;
  field_key: string;
  field_label: string;
  field_type: FieldType;
  unit: string | null;
  placeholder: string | null;
  help_text: string | null;
  icon: string | null;
  sort_order: number;
  is_required: boolean;
  is_public: boolean;
  is_searchable: boolean;
  ai_readable: boolean;
  show_in_brochure: boolean;
  show_in_quotation: boolean;
  show_in_catalog: boolean;
  options_json: Record<string, unknown> | null;
  created_at: string;
}

export interface ProductFieldValue {
  id: string;
  product_id: string;
  model_id: string | null;
  field_id: string;
  value_json: unknown;
  created_at: string;
  updated_at: string;
}

/* ── Nested DTO returned by GET /api/product-templates/[slug] ──────────
   The API joins the three structure tables into a single tree so the
   client can render in one render pass without N+1 fetches. */
export interface TemplateTree extends ProductTemplate {
  sections: Array<
    ProductTemplateSection & {
      fields: ProductTemplateField[];
    }
  >;
}

/* ── Field-value map keyed by field_key (renderer-friendly) ──────────── */
export type FieldValueMap = Record<string, unknown>;

/* ── Option shape used by select-family field types ───────────────────── */
export interface FieldOption {
  value: string;
  label: string;
  icon?: string;
  image?: string;
  color?: string;
}

export function getFieldOptions(field: ProductTemplateField): FieldOption[] {
  const raw = field.options_json;
  if (!raw || typeof raw !== "object") return [];
  const arr = (raw as { options?: unknown }).options;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((o): o is FieldOption => !!o && typeof (o as FieldOption).value === "string")
    .map((o) => ({
      value: o.value,
      label: o.label ?? o.value,
      icon: o.icon,
      image: o.image,
      color: o.color,
    }));
}

/* ── Repeater item-schema descriptor ──────────────────────────────────── */
export interface RepeaterItemSchema {
  key: string;
  label: string;
  type: "text" | "number" | "boolean";
  required?: boolean;
}

export function getRepeaterSchema(field: ProductTemplateField): RepeaterItemSchema[] {
  const raw = field.options_json;
  if (!raw || typeof raw !== "object") return [];
  const arr = (raw as { item_schema?: unknown }).item_schema;
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (s): s is RepeaterItemSchema =>
      !!s &&
      typeof (s as RepeaterItemSchema).key === "string" &&
      typeof (s as RepeaterItemSchema).label === "string",
  );
}
