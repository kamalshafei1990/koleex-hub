/* ---------------------------------------------------------------------------
   Supabase Database Types — Maps to the CMS tables.

   Tables:
   - pages: website pages (home, about, products, etc.)
   - sections: content sections within pages
   - media: uploaded files and images

   Layout types for sections:
   hero | image-left | image-right | cards | grid | video | numbers | cta |
   quote | timeline | full-image | split | brands
   --------------------------------------------------------------------------- */

export type SectionLayout =
  | "hero"
  | "image-left"
  | "image-right"
  | "cards"
  | "grid"
  | "video"
  | "numbers"
  | "cta"
  | "quote"
  | "timeline"
  | "full-image"
  | "split"
  | "brands"
  | "bg-hero";

export type ButtonStyle = "solid" | "outline" | "ghost";
export type ButtonShape = "pill" | "rounded" | "square";
export type ButtonSize = "small" | "medium" | "large";
export type LinkType = "none" | "page" | "product" | "anchor" | "url" | "file" | "email" | "phone";

export interface ButtonConfig {
  text: string;
  linkType: LinkType;
  link: string;
  newTab: boolean;
  style: ButtonStyle;
  shape: ButtonShape;
  size: ButtonSize;
}

export interface SectionSettings {
  btn1?: ButtonConfig;
  btn2?: ButtonConfig;
  overlayOpacity?: number;
  textAlign?: "left" | "center" | "right";
  textMode?: "dark" | "light";
  contentWidth?: "narrow" | "medium" | "wide" | "full";
  verticalAlign?: "top" | "center" | "bottom";
  columns?: number;
  rows?: number;
  paddingTop?: string;
  paddingBottom?: string;
  gap?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  // Layout zones
  zoneLayout?: ZoneLayout;
}

/* ── Layout Zones ── */
export type ZoneLayout =
  | "1-col"
  | "2-col"
  | "3-col"
  | "4-col"
  | "70-30"
  | "30-70"
  | "60-40"
  | "40-60";

/* ── Icon Config ── */
export interface IconConfig {
  type: "emoji" | "lucide" | "svg" | "image";
  value: string; // emoji char, lucide name, svg string, or image URL
  size: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  customSize?: number;
  color?: string;
  bgShape?: "none" | "circle" | "rounded" | "pill";
  bgColor?: string;
  position?: "left" | "right" | "top" | "bottom" | "center";
  align?: "left" | "center" | "right";
}

/* ── Element Types ── */

export type ElementType =
  | "heading"
  | "paragraph"
  | "image"
  | "button"
  | "icon"
  | "card"
  | "list"
  | "form"
  | "video"
  | "divider"
  | "container"
  | "spacer"
  | "badge"
  | "avatar"
  | "stat"
  | "testimonial"
  | "feature"
  | "pricing"
  | "faq"
  | "social"
  | "logo"
  | "countdown"
  | "progress"
  | "tag-list"
  | "cta-banner"
  | "icon-box"
  | "gallery"
  | "map"
  | "code"
  | "table"
  | "accordion"
  | "tabs"
  | "alert"
  | "breadcrumb";

export interface ElementRow {
  id: string;
  section_id: string;
  type: ElementType;
  content: Record<string, unknown> | null;
  style: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  order: number;
  visible: boolean;
  zone?: string; // Virtual field — derived from settings.zone, not a DB column
  created_at: string;
  updated_at: string;
}

/* ── Row types (what comes back from Supabase) ── */

export interface PageRow {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SectionRow {
  id: string;
  page_id: string;
  section_key: string;
  layout: SectionLayout;
  title: string | null;
  subtitle: string | null;
  content: string | null;
  image_url: string | null;
  image_alt: string | null;
  video_url: string | null;
  button_text: string | null;
  button_link: string | null;
  button2_text: string | null;
  button2_link: string | null;
  background: "white" | "light" | "dark" | "black" | "image" | null;
  items: SectionItem[] | null;
  order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectionItem {
  title: string;
  description?: string;
  icon?: string;
  image?: string;
  href?: string;
  value?: string;
  label?: string;
}

export interface MediaRow {
  id: string;
  name: string;
  file_path: string;
  url: string;
  type: string;
  size: number;
  created_at: string;
}

/* ── Insert types (what you send to Supabase) ── */

export type PageInsert = Omit<PageRow, "id" | "created_at" | "updated_at">;
export type SectionInsert = Omit<SectionRow, "id" | "created_at" | "updated_at">;
export type MediaInsert = Omit<MediaRow, "id" | "created_at">;

/* ── Update types ── */

export type PageUpdate = Partial<PageInsert>;
export type SectionUpdate = Partial<SectionInsert>;

/* ---------------------------------------------------------------------------
   Product Catalog Types — Maps to the product tables.
   --------------------------------------------------------------------------- */

export type ProductMediaType =
  | "main_image"
  | "gallery"
  | "packing_photo"
  | "label"
  | "logo_detail"
  | "manual"
  | "ar_3d"
  | "video";

export interface DivisionRow {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  order: number;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  division_id: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  created_at: string;
}

export interface SubcategoryRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  created_at: string;
}

export interface ProductRow {
  id: string;
  product_name: string;
  slug: string;
  division_slug: string;
  category_slug: string;
  subcategory_slug: string;
  brand: string | null;
  tags: string[];
  level: string | null;
  description: string | null;
  specs: Record<string, unknown>;
  hs_code: string | null;
  voltage: string[];
  plug_types: string[];
  watt: string | null;
  colors: string[];
  supports_head_only: boolean;
  supports_complete_set: boolean;
  warranty: string | null;
  visible: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductModelRow {
  id: string;
  product_id: string;
  model_name: string;
  slug: string;
  sku: string;
  tagline: string | null;
  supplier: string | null;
  reference_model: string | null;
  cost_price: number | null;
  global_price: number | null;
  supports_head_only: boolean | null;
  supports_complete_set: boolean | null;
  head_only_price: number | null;
  complete_set_price: number | null;
  weight: number | null;
  cbm: number | null;
  packing_type: string | null;
  box_include: string | null;
  extra_accessories: string | null;
  order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductMediaRow {
  id: string;
  product_id: string;
  model_id: string | null;
  type: ProductMediaType;
  url: string;
  file_path: string | null;
  alt_text: string | null;
  order: number;
  created_at: string;
}

export interface ProductTranslationRow {
  id: string;
  product_id: string;
  locale: string;
  product_name: string;
  description: string | null;
  created_at: string;
}

export interface ModelTranslationRow {
  id: string;
  model_id: string;
  locale: string;
  model_name: string;
  tagline: string | null;
  created_at: string;
}

export interface ProductMarketPriceRow {
  id: string;
  model_id: string;
  country_code: string;
  currency: string;
  market_price: number;
  head_only_price: number | null;
  complete_set_price: number | null;
  created_at: string;
}

export interface RelatedProductRow {
  product_id: string;
  related_id: string;
  order: number;
}

export interface SewingMachineSpecsRow {
  id: string;
  product_id: string;
  template_slug: string;
  common_specs: Record<string, unknown>;
  template_specs: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type SewingMachineSpecsInsert = Omit<SewingMachineSpecsRow, "id" | "created_at" | "updated_at">;

/* ── Insert types ── */

export type ProductInsert = Omit<ProductRow, "id" | "created_at" | "updated_at">;
export type ProductModelInsert = Omit<ProductModelRow, "id" | "sku" | "created_at" | "updated_at">;
export type ProductMediaInsert = Omit<ProductMediaRow, "id" | "created_at">;
export type ProductTranslationInsert = Omit<ProductTranslationRow, "id" | "created_at">;
export type ModelTranslationInsert = Omit<ModelTranslationRow, "id" | "created_at">;
export type ProductMarketPriceInsert = Omit<ProductMarketPriceRow, "id" | "created_at">;

/* ── Database schema type for createClient<Database> ── */

export interface Database {
  public: {
    Tables: {
      pages: {
        Row: PageRow;
        Insert: PageInsert;
        Update: PageUpdate;
      };
      sections: {
        Row: SectionRow;
        Insert: SectionInsert;
        Update: SectionUpdate;
      };
      media: {
        Row: MediaRow;
        Insert: MediaInsert;
        Update: Partial<MediaInsert>;
      };
      divisions: {
        Row: DivisionRow;
        Insert: Omit<DivisionRow, "id" | "created_at">;
        Update: Partial<Omit<DivisionRow, "id" | "created_at">>;
      };
      categories: {
        Row: CategoryRow;
        Insert: Omit<CategoryRow, "id" | "created_at">;
        Update: Partial<Omit<CategoryRow, "id" | "created_at">>;
      };
      subcategories: {
        Row: SubcategoryRow;
        Insert: Omit<SubcategoryRow, "id" | "created_at">;
        Update: Partial<Omit<SubcategoryRow, "id" | "created_at">>;
      };
      products: {
        Row: ProductRow;
        Insert: ProductInsert;
        Update: Partial<ProductInsert>;
      };
      product_models: {
        Row: ProductModelRow;
        Insert: ProductModelInsert;
        Update: Partial<ProductModelInsert>;
      };
      product_media: {
        Row: ProductMediaRow;
        Insert: ProductMediaInsert;
        Update: Partial<ProductMediaInsert>;
      };
      product_translations: {
        Row: ProductTranslationRow;
        Insert: ProductTranslationInsert;
        Update: Partial<ProductTranslationInsert>;
      };
      model_translations: {
        Row: ModelTranslationRow;
        Insert: ModelTranslationInsert;
        Update: Partial<ModelTranslationInsert>;
      };
      product_market_prices: {
        Row: ProductMarketPriceRow;
        Insert: ProductMarketPriceInsert;
        Update: Partial<ProductMarketPriceInsert>;
      };
      related_products: {
        Row: RelatedProductRow;
        Insert: RelatedProductRow;
        Update: Partial<RelatedProductRow>;
      };
      product_sewing_specs: {
        Row: SewingMachineSpecsRow;
        Insert: SewingMachineSpecsInsert;
        Update: Partial<SewingMachineSpecsInsert>;
      };
    };
  };
}
