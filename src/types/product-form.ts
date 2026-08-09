/* ---------------------------------------------------------------------------
   Product Admin — Form state types.
   These mirror the DB row types but are optimized for form editing.
   --------------------------------------------------------------------------- */

import type {
  FeatureCard, ProductMediaType } from "./supabase";

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
  /* Identity tab expansion (all optional). */
  legacy_code: string;
  brand_mark_url: string;
  hero_poster_url: string;
  status_reason: string;
  model_year: string;
  available_from: string;
  last_order_date: string;
  meta_title: string;
  meta_description: string;
  og_image_url: string;
  revision_history: { version: string; date: string; note: string }[];
  tags: string[];
  /* Short 1-2 sentence description. Shown on product cards, SEO
     meta descriptions, and quote emails. Separate from the long
     rich-text description on the Description step. */
  excerpt: string;
  /* 3-5 bullet strings rendered on the public product hero
     ("Max 5000 SPM", "Auto thread trimmer", "2-year warranty"). */
  highlights: string[];
  feature_cards: FeatureCard[];
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
  /* Per-model TECHNICAL differences vs the product's schema_specs
     (owner-approved models system, 2026-08-03). UI keeps every value
     as a string (multi-selects comma-joined); typed conversion happens
     once at save using the resolved schema. Empty object = model is
     identical to the product spec sheet. */
  specs_overrides: Record<string, string>;
  id?: string;
  model_name: string;
  slug: string;
  tagline: string;
  supplier: string;
  reference_model: string;
  cost_price: string;
  /* How this model is priced. 'fixed' keeps today's behaviour for every
     existing row; 'from' means the figures above are a base that options add
     to; 'on_request' means there is no list price and a blank cost is the
     answer rather than a gap. */
  pricing_mode: "fixed" | "from" | "on_request";
  price_note: string;
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
  container_40hq_qty: string;
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
  /* Localized member name/tagline ({zh, ar, …}) — family-level locales
     stay in product_translations; these cover non-primary members. */
  name_i18n?: Record<string, string>;
  tagline_i18n?: Record<string, string>;
  /* Member's SUPPLIER-PAGE overrides: partial ProductSupplier link
     fields this member changed; unset keys inherit the primary link
     live (owner rule: sub-product supplier page = the primary's values
     until edited manually). */
  supplier_overrides?: Record<string, unknown>;
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
  /* Binds media to a model that has no DB id yet (new model in this form
     session). Resolved to the real id at save via tempIdToRealId. */
  _modelTempId?: string;
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
  /* What unit_cost_cny already includes (display + warning only for now). */
  cost_basis: "factory_only" | "packing" | "delivered";
  cost_includes_tax: boolean;
  payment_terms: string;
  notes: string;
  /* Locale-keyed translations of the price note. Base note above is the
     source text in whatever language it was written. */
  notes_i18n: Record<string, string>;
  /* Extra prices (beyond the main cost), each with its own note. */
  price_options: { price: string; note: string; note_i18n: Record<string, string> }[];
  /* product-as-supplied facts (migration pd_supplier_product_facts). */
  supplier_product_name: string;
  /* Locale-keyed translations of the supplier's product name (owner
     request 2026-08-03). Base field above stays the source text — the
     factory usually names it in its own language. */
  supplier_product_name_i18n: Record<string, string>;
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
  legacy_code: "",
  brand_mark_url: "",
  hero_poster_url: "",
  status_reason: "",
  model_year: "",
  available_from: "",
  last_order_date: "",
  meta_title: "",
  meta_description: "",
  og_image_url: "",
  revision_history: [],
  tags: [],
  excerpt: "",
  highlights: [],
  feature_cards: [],
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
    specs_overrides: {},
    name_i18n: {},
    tagline_i18n: {},
    supplier_overrides: {},
    _tempId: crypto.randomUUID(),
    model_name: "",
    slug: "",
    tagline: "",
    supplier: "",
    reference_model: "",
    cost_price: "",
    pricing_mode: "fixed",
    price_note: "",
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
    container_40hq_qty: "",
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
  { code: "EG", name: "Egypt", currency: "EGP" , dial: "+20" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" , dial: "+966" },
  { code: "AE", name: "UAE", currency: "AED" , dial: "+971" },
  { code: "KW", name: "Kuwait", currency: "KWD" , dial: "+965" },
  { code: "QA", name: "Qatar", currency: "QAR" , dial: "+974" },
  { code: "BH", name: "Bahrain", currency: "BHD" , dial: "+973" },
  { code: "OM", name: "Oman", currency: "OMR" , dial: "+968" },
  { code: "JO", name: "Jordan", currency: "JOD" , dial: "+962" },
  { code: "IQ", name: "Iraq", currency: "IQD" , dial: "+964" },
  { code: "CN", name: "China", currency: "CNY" , dial: "+86" },
  { code: "IN", name: "India", currency: "INR" , dial: "+91" },
  { code: "PK", name: "Pakistan", currency: "PKR" , dial: "+92" },
  { code: "TH", name: "Thailand", currency: "THB" , dial: "+66" },
  { code: "ID", name: "Indonesia", currency: "IDR" , dial: "+62" },
  { code: "VN", name: "Vietnam", currency: "VND" , dial: "+84" },
  { code: "MY", name: "Malaysia", currency: "MYR" , dial: "+60" },
  { code: "TR", name: "Turkey", currency: "TRY" , dial: "+90" },
  { code: "DE", name: "Germany", currency: "EUR" , dial: "+49" },
  { code: "FR", name: "France", currency: "EUR" , dial: "+33" },
  { code: "GB", name: "United Kingdom", currency: "GBP" , dial: "+44" },
  { code: "NL", name: "Netherlands", currency: "EUR" , dial: "+31" },
  { code: "PL", name: "Poland", currency: "PLN" , dial: "+48" },
  { code: "RU", name: "Russia", currency: "RUB" , dial: "+7" },
  { code: "US", name: "United States", currency: "USD" , dial: "+1" },
  { code: "BR", name: "Brazil", currency: "BRL" , dial: "+55" },
  { code: "MX", name: "Mexico", currency: "MXN" , dial: "+52" },
  { code: "NG", name: "Nigeria", currency: "NGN" , dial: "+234" },
  { code: "ZA", name: "South Africa", currency: "ZAR" , dial: "+27" },
  { code: "KE", name: "Kenya", currency: "KES" , dial: "+254" },
];
