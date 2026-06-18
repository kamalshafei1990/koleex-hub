/* ---------------------------------------------------------------------------
   Product Admin — Form state types.
   These mirror the DB row types but are optimized for form editing.
   --------------------------------------------------------------------------- */

import type { ProductMediaType } from "./supabase";

export type ProductStatus = "draft" | "active" | "archived";
export type ModelStatus = "active" | "discontinued";

export interface ProductFormState {
  division_slug: string;
  category_slug: string;
  subcategory_slug: string;
  product_name: string;
  slug: string;
  brand: string;
  level: string;
  family: string;
  /* Phase 5 — Identity identifiers + lifecycle (all optional). */
  mpn: string;
  gtin: string;
  manufacturer: string;
  generation: string;
  internal_sku: string;
  launch_date: string;
  eol_date: string;
  alternate_names: string[];
  tags: string[];
  /* Short 1-2 sentence description. Shown on product cards, SEO
     meta descriptions, and quote emails. Separate from the long
     rich-text description on the Description step. */
  excerpt: string;
  /* 3-5 bullet strings rendered on the public product hero
     ("Max 5000 SPM", "Auto thread trimmer", "2-year warranty"). */
  highlights: string[];
  description: string;
  specs: Record<string, string>;
  supports_head_only: boolean;
  supports_complete_set: boolean;
  warranty: string;
  /* Phase 4 — structured warranty / after-sales. Complement the legacy
     free-text `warranty` above; all optional. Numbers kept as strings
     for empty-field support; coerced on save. */
  warranty_months: string;
  warranty_type: string;
  warranty_start_from: string;
  warranty_coverage: string;
  warranty_exclusions: string;
  spare_parts_availability: string;
  spare_parts_stock: string;
  service_life: string;
  maintenance_interval: string;
  technical_support: string;
  support_channels: string[];
  training_available: boolean;
  installation_service: boolean;
  returns_policy: string;
  hs_code: string;
  voltage: string[];
  plug_types: string[];
  /* Free-text watt kept for legacy reads only. New writes use the
     structured `motor_power_w` (number) below. */
  watt: string;
  colors: string[];
  /* Electrical (Technical step). All numbers — typed so we can
     filter / sort / compare across products. */
  motor_power_w: string;          // numeric, kept as string in the form for empty support
  power_consumption_w: string;
  /* Physical machine (Technical step). Distinct from the per-variant
     packed/shipment dimensions which live on product_models. */
  machine_weight_kg: string;
  machine_dimensions: string;     // free text "L × W × H mm"
  /* Compliance (Technical step). All default false so admins flip
     them on per-product. */
  ce_certified: boolean;
  rohs_compliant: boolean;
  /* Air-purify / oil-mist filter — relevant for cleanrooms and
     light-fabric production. Pneumatic supply requirement —
     relevant for automatic stations + pneumatic presser-foot
     lifters. */
  oil_mist_filter: boolean;
  pneumatic_supply: boolean;
  /* Technical step v2 — gap-fill audit additions.
     frequency_hz: array since some machines support both 50 and 60.
     phase: "single" | "three" stored as plain string.
     ip_rating: free text (IP44, IP54…).
     operating_temp: free text range. */
  frequency_hz: string[];
  phase: string;
  ip_rating: string;
  operating_temp: string;
  visible: boolean;
  featured: boolean;
  status: ProductStatus;
  country_of_origin: string;
  moq: string;
  lead_time: string;
  /* Product Schema Engine v1 — additive, optional fields. Populated
     by the schema resolver (registry → division/category/subcategory)
     and persisted into 5 new columns on the products table. None of
     the legacy fields above changed shape — these are pure extras. */
  schema_id: string;
  schema_version: string;
  schema_specs: Record<string, unknown>;
  schema_knowledge: unknown[];
  schema_visibility: Record<string, unknown>;
}

export interface ModelFormState {
  _tempId: string;
  id?: string;
  model_name: string;
  slug: string;
  tagline: string;
  supplier: string;
  reference_model: string;
  cost_price: string;
  global_price: string;
  supports_head_only: boolean | null;
  supports_complete_set: boolean | null;
  head_only_price: string;
  complete_set_price: string;
  /* Gross / packed weight (kg) — the existing "weight" column has
     always been the packed/shipment weight. Net (bare-machine)
     weight is a separate field below so admins can record both
     NW and GW like a real commercial invoice. */
  weight: string;
  net_weight: string;
  cbm: string;
  carton_dimensions: string;
  packing_type: string;
  box_include: string;
  extra_accessories: string;
  /* Logistics / availability — added in the Technical+Models v2 audit.
     container_20ft_qty / container_40ft_qty: ints kept as strings to
     allow empty input. stock_status: "in_stock" | "made_to_order" |
     "pre_order" | "sold_out". */
  container_20ft_qty: string;
  container_40ft_qty: string;
  stock_status: string;
  order: number;
  visible: boolean;
  status: ModelStatus;
  moq: string;
  lead_time: string;
  barcode: string;
  /* v30 — KOLEEX 3-layer identity. supplier_model / reference_model is
     the factory identity (already above). primary_model is the
     commercial KOLEEX code (XCS-7800), code_prefix is the classification
     prefix it was generated from (XCS), and coding_status tracks the
     workflow (auto_suggested → edited → approved → locked). */
  primary_model: string;
  code_prefix: string;
  coding_status: string;
}

export interface MediaFormState {
  _tempId: string;
  id?: string;
  type: ProductMediaType;
  url: string;
  file_path: string | null;
  alt_text: string;
  order: number;
  model_id: string | null;
  _file?: File;
}

export interface TranslationFormState {
  _tempId: string;
  id?: string;
  locale: string;
  product_name: string;
  tagline: string;
  excerpt: string;
  description: string;
}

export interface ModelTranslationFormState {
  _tempId: string;
  id?: string;
  model_id?: string;
  _modelTempId: string;
  locale: string;
  model_name: string;
  tagline: string;
}

export interface MarketPriceFormState {
  _tempId: string;
  id?: string;
  _modelTempId: string;
  model_id?: string;
  country_code: string;
  currency: string;
  market_price: string;
  head_only_price: string;
  complete_set_price: string;
}

export interface RelatedProductFormState {
  related_id: string;
  related_name: string;
  order: number;
  /* Phase 6 — relationship type (accessory / spare_part / compatible_with /
     replaces / replaced_by / bundle / consumable / required_addon / upgrade /
     optional_attachment / related). */
  relation_type: string;
}

/* Per-product LINK to a supplier from the Suppliers app. Supplier master
   data (name, logo, country, contacts…) is NOT duplicated here — only the
   facts specific to this product↔supplier relationship. Mirrors the
   product_suppliers table. */
export interface ProductSupplierFormState {
  _tempId: string;
  supplier_id: string;
  is_primary: boolean;
  supplier_product_code: string;
  moq: string;            // kept as string for the input; coerced on save
  lead_time_days: string;
  unit_cost_cny: string;
  currency: string;
  payment_terms: string;
  notes: string;
  /* product-as-supplied facts (migration pd_supplier_product_facts). */
  supplier_product_name: string;
  supplier_product_photo: string;   // image URL (uploaded to storage)
  supply_type: string;              // OEM / ODM / Own brand
  sample_available: boolean;
  sample_cost: string;
  incoterms: string;                // EXW / FOB / CIF / DDP
  supplier_warranty_months: string;
  /* Tier 1 sourcing intelligence (migration pd_supplier_quote_tiers). */
  price_tiers: { min_qty: string; price: string }[];   // volume pricing
  price_quoted_on: string;          // date the cost was quoted
  price_valid_until: string;        // quote expiry
  quotation_file_url: string;       // supplier's quotation/spec PDF
  quotation_file_name: string;
  /* Tier 2 sourcing intelligence (migration pd_supplier_sourcing_tier2). */
  sourcing_status: string;          // preferred / backup / trial / phasing_out
  preferred_reason: string;         // why this supplier (price / quality / lead time…)
  min_order_value: string;          // minimum order VALUE (in supplier currency)
  tooling_owner: string;            // koleex / supplier / shared
  tooling_cost: string;             // mold / tooling cost
}

/* Phase 4 — one row per real certificate (product_certifications). */
export interface ProductCertificationFormState {
  _tempId: string;
  cert_type: string;
  certified_standard: string;
  cert_number: string;
  issuer: string;
  issued_date: string;
  expiry_date: string;
  reminder_days: string;
  country_scope: string;
  model_ids: string[];
  file_url: string;
  verification_url: string;
  status: string;
  notes: string;
}

/* Phase 4 — structured industrial document (product_documents). */
export interface ProductDocumentFormState {
  _tempId: string;
  doc_type: string;
  title: string;
  file_url: string;
  file_name: string;
  language: string;
  version: string;
  model_ids: string[];
}

/* Koleex defaults for a brand-new product.
   · brand              → "Koleex" — own-brand is the common case,
                          rebranding happens after.
   · country_of_origin  → "CN" — Koleex machinery is manufactured
                          in China.
   · warranty           → "3 years" — standard Koleex warranty
                          across the catalogue.
   These are pre-filled so admins don't retype them on every new
   product, but are fully editable if a specific product differs
   (OEM third-party brand, a non-China supplier, a non-standard
   warranty window, etc.). */
export const EMPTY_PRODUCT: ProductFormState = {
  division_slug: "",
  category_slug: "",
  subcategory_slug: "",
  product_name: "",
  slug: "",
  brand: "Koleex",
  level: "",
  family: "",
  mpn: "",
  gtin: "",
  manufacturer: "",
  generation: "",
  internal_sku: "",
  launch_date: "",
  eol_date: "",
  alternate_names: [],
  tags: [],
  excerpt: "",
  highlights: [],
  description: "",
  specs: {},
  supports_head_only: false,
  supports_complete_set: true,
  warranty: "3 years",
  warranty_months: "",
  warranty_type: "",
  warranty_start_from: "",
  warranty_coverage: "",
  warranty_exclusions: "",
  spare_parts_availability: "",
  spare_parts_stock: "",
  service_life: "",
  maintenance_interval: "",
  technical_support: "",
  support_channels: [],
  training_available: false,
  installation_service: false,
  returns_policy: "",
  hs_code: "",
  voltage: [],
  plug_types: [],
  watt: "",
  colors: [],
  motor_power_w: "",
  power_consumption_w: "",
  machine_weight_kg: "",
  machine_dimensions: "",
  ce_certified: false,
  rohs_compliant: false,
  oil_mist_filter: false,
  pneumatic_supply: false,
  frequency_hz: [],
  phase: "",
  ip_rating: "",
  operating_temp: "",
  visible: true,
  featured: false,
  status: "draft",
  country_of_origin: "CN",
  moq: "",
  lead_time: "",
  schema_id: "",
  schema_version: "",
  schema_specs: {},
  schema_knowledge: [],
  schema_visibility: {},
};

export function createEmptyModel(): ModelFormState {
  return {
    _tempId: crypto.randomUUID(),
    model_name: "",
    slug: "",
    tagline: "",
    supplier: "",
    reference_model: "",
    cost_price: "",
    global_price: "",
    supports_head_only: null,
    supports_complete_set: null,
    head_only_price: "",
    complete_set_price: "",
    weight: "",
    net_weight: "",
    cbm: "",
    carton_dimensions: "",
    packing_type: "",
    box_include: "",
    extra_accessories: "",
    container_20ft_qty: "",
    container_40ft_qty: "",
    stock_status: "",
    order: 0,
    visible: true,
    status: "active",
    moq: "",
    lead_time: "",
    barcode: "",
    primary_model: "",
    code_prefix: "",
    coding_status: "",
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const LOCALES = [
  { code: "ar", name: "Arabic" },
  { code: "zh", name: "Chinese" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "tr", name: "Turkish" },
  { code: "ru", name: "Russian" },
  { code: "pt", name: "Portuguese" },
  { code: "hi", name: "Hindi" },
  { code: "ur", name: "Urdu" },
  { code: "id", name: "Indonesian" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "pl", name: "Polish" },
  { code: "nl", name: "Dutch" },
];

export const COUNTRIES = [
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "AE", name: "UAE", currency: "AED" },
  { code: "KW", name: "Kuwait", currency: "KWD" },
  { code: "QA", name: "Qatar", currency: "QAR" },
  { code: "BH", name: "Bahrain", currency: "BHD" },
  { code: "OM", name: "Oman", currency: "OMR" },
  { code: "JO", name: "Jordan", currency: "JOD" },
  { code: "IQ", name: "Iraq", currency: "IQD" },
  { code: "CN", name: "China", currency: "CNY" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "PK", name: "Pakistan", currency: "PKR" },
  { code: "TH", name: "Thailand", currency: "THB" },
  { code: "ID", name: "Indonesia", currency: "IDR" },
  { code: "VN", name: "Vietnam", currency: "VND" },
  { code: "MY", name: "Malaysia", currency: "MYR" },
  { code: "TR", name: "Turkey", currency: "TRY" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "PL", name: "Poland", currency: "PLN" },
  { code: "RU", name: "Russia", currency: "RUB" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "MX", name: "Mexico", currency: "MXN" },
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "KE", name: "Kenya", currency: "KES" },
];
