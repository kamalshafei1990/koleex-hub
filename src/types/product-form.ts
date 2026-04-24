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
  watt: string;
  colors: string[];
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
  weight: string;
  cbm: string;
  packing_type: string;
  box_include: string;
  extra_accessories: string;
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

export const EMPTY_PRODUCT: ProductFormState = {
  division_slug: "",
  category_slug: "",
  subcategory_slug: "",
  product_name: "",
  slug: "",
  brand: "",
  level: "",
  family: "",
  tags: [],
  excerpt: "",
  highlights: [],
  description: "",
  specs: {},
  supports_head_only: false,
  supports_complete_set: true,
  warranty: "",
  hs_code: "",
  voltage: [],
  plug_types: [],
  watt: "",
  colors: [],
  visible: true,
  featured: false,
  status: "draft",
  country_of_origin: "",
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
    cbm: "",
    packing_type: "",
    box_include: "",
    extra_accessories: "",
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
