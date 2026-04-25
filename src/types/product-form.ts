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
  tags: [],
  excerpt: "",
  highlights: [],
  description: "",
  specs: {},
  supports_head_only: false,
  supports_complete_set: true,
  warranty: "3 years",
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
