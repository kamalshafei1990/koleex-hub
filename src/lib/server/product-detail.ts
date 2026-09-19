import "server-only";

/* ---------------------------------------------------------------------------
   product-detail — shared server loader for the schema-driven public product
   experience. Used by BOTH /products/[id] and /products/preview/[slug] so the
   fetch + surface-filtering + prop-mapping logic lives in exactly one place
   (no duplicate rendering / no duplicate data plumbing).

   loadPublicSchemaProduct(idOrSlug) returns ready-to-spread <ProductPreview>
   props when the product is (a) found, (b) public, and (c) has a RESOLVED
   schema. Returns null otherwise — callers decide the fallback:
     • /products/preview/[slug] → notFound()
     • /products/[id]           → render the legacy renderer

   Security: getSupabaseServer() is service-role, so the leak surface is
   controlled here — only public-safe columns are selected, and only
   website-surface specs/knowledge/field-definitions cross the boundary.
   --------------------------------------------------------------------------- */

import { getSupabaseServer } from "@/lib/server/supabase-server";
import {
  resolveSchema,
  filterFieldsForSurface,
  filterKnowledgeForSurface,
} from "@/lib/product-schema";
import type {
  ProductKnowledgeBlock,
  ProductSchemaDefinition,
} from "@/types/product-schema";
import type { FeatureCard } from "@/types/supabase";
import { loadPlan, sumPackages, type ProductLogistics } from "@/lib/logistics";
import { globalFobForProducts, type FobFigure } from "@/lib/server/products-fob";

/* Who is reading. Decides what the page, the AI and the print may show:
     internal — Hub staff: everything customer-visible plus the Price section
     customer — a Hub account: everything customer-visible incl. Global FOB
     print    — the brochure: customer content, NO price (a sheet outlives
                the day's rate)
     public   — the website, later: customer content, no price, active only
   The loader records it; each section reads it. One value, one place. */
export type ProductAudience = "internal" | "customer" | "print" | "public";
export const PRICE_AUDIENCES: ReadonlySet<ProductAudience> = new Set(["internal", "customer"]);

const PRODUCT_PUBLIC_COLUMNS =
  "id, product_name, slug, brand, division_slug, category_slug, subcategory_slug, " +
  "schema_id, schema_version, schema_specs, schema_knowledge, schema_visibility, " +
  "warranty, country_of_origin, status, visible, hero_poster_url, " +
  "excerpt, meta_title, meta_description, og_image_url, " +
  /* Product-page rebuild (19/09/2026): the sections the page will carry —
     all customer-visible columns already on the row, so ONE read serves
     the page, the AI and the print. Nothing internal is here: cost,
     supplier, MOQ and lead time never enter this loader. */
  "description, highlights, feature_cards, logistics, ce_certified, rohs_compliant, ip_rating, warranty_months, hs_code, tenant_id";

interface PublicProductRow {
  id: string;
  product_name: string;
  slug: string;
  brand: string | null;
  division_slug: string | null;
  category_slug: string | null;
  subcategory_slug: string | null;
  schema_id: string | null;
  schema_specs: Record<string, unknown> | null;
  schema_knowledge: unknown[] | null;
  warranty: string | null;
  country_of_origin: string | null;
  status: string | null;
  visible: boolean | null;
  hero_poster_url: string | null;
  excerpt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  description: string | null;
  highlights: string[] | null;
  feature_cards: FeatureCard[] | null;
  logistics: ProductLogistics | null;
  ce_certified: boolean | null;
  rohs_compliant: boolean | null;
  ip_rating: string | null;
  warranty_months: number | null;
  hs_code: string | null;
  tenant_id: string | null;
}

/* Buyer options (product_options + product_option_values). The stored
   price delta is a supplier COST delta in CNY and never leaves the server:
   a price audience gets the USD the Global FOB moves by, priced through the
   same engine as the product; everyone else gets the option without a
   number. */
interface OptionRow {
  id: string; title: string; title_i18n: Record<string, string> | null; kind: string;
  required: boolean | null; depends_on_value_id: string | null; sort_order: number | null;
}
interface OptionValueRow {
  id: string; option_id: string; label: string; label_i18n: Record<string, string> | null;
  image_url: string | null; price_delta_cny: number | string | null; weight_delta_kg: number | string | null;
  is_default: boolean | null; sort_order: number | null;
}
export interface ProductOptionView {
  id: string; title: string; title_i18n: Record<string, string> | null; kind: string; required: boolean;
  dependsOnValueId: string | null;
  values: Array<{
    id: string; label: string; label_i18n: Record<string, string> | null; image: string | null;
    isDefault: boolean; weightDeltaKg: number | null;
    /** USD the Global FOB moves by; null when not a price audience or unpriced. */
    priceDeltaUsd: number | null;
  }>;
}
/** Packing & Logistics, DERIVED HERE. The page used to import lib/logistics
 *  (sums, container loading) into the browser bundle to draw six numbers;
 *  the numbers are now computed once on the server with the same functions
 *  the Logistics tab and the packing list use, and the component only
 *  prints them. Null when the product has nothing to say. */
export interface ProductPackingView {
  facts: Array<{ key: "packing_type" | "wood_treatment" | "net_weight" | "gross_weight" | "cbm" | "stackable" | "port_of_loading"; value: string; unit?: string }>;
  containers: { c20: number | null; c40: number | null; c40hq: number | null } | null;
  packages: Array<{ label: string | null; qty: number; l: number | null; w: number | null; h: number | null; grossKg: number | null; photo: string | null }>;
  dangerousGoods: { kinds: string[]; unNumbers: string | null; notes: string | null } | null;
}

/** Internal price sheet per model — INTERNAL audience only. Never cost. */
export interface ProductModelPriceView {
  id: string; code: string; pricingMode: string | null; priceNote: string | null;
  globalPrice: number | null; headOnlyPrice: number | null; completeSetPrice: number | null;
  supportsHeadOnly: boolean; supportsCompleteSet: boolean;
}

interface MediaRow {
  url: string;
  alt_text: string | null;
  order: number | null;
  type: string;
}

interface ModelRow {
  model_name: string | null;
  primary_model: string | null;
  tagline: string | null;
  order: number | null;
  visible: boolean | null;
  specs_overrides: Record<string, unknown> | null;
}

/** Localized overlay for the public hero — English stays the base; a row
 *  exists only for locales an admin has filled in. */
export interface ProductLocaleText {
  locale: string;
  product_name: string | null;
  tagline: string | null;
  excerpt: string | null;
  description: string | null;
}

export interface SchemaProductPreviewProps {
  productName: string;
  primaryModel: string | null;
  tagline: string | null;
  posterUrl: string | null;
  translations: ProductLocaleText[];
  brand: string | null;
  schema: ProductSchemaDefinition | null;
  values: Record<string, unknown>;
  knowledge: ProductKnowledgeBlock[];
  mainImageUrl: string | null;
  galleryUrls: string[];
  videoUrls: string[];
  manuals: { url: string; label: string | null }[];
  ar3dUrl: string | null;
  mediaCounts: { photos: number; videos: number; manuals: number };
  countryOfOrigin: string | null;
  warranty: string | null;
  surface: "website";
  /** The product's model lineup with per-model TECHNICAL overrides
   *  (website-surface keys only) — powers "Choose your model". */
  variants: Array<{
    code: string;
    tagline: string | null;
    overrides: Record<string, unknown>;
  }>;
  /** Same-subcategory public products powering the compare band. */
  siblings: {
    name: string;
    slug: string;
    imageUrl: string | null;
    values: Record<string, unknown>;
  }[];
}

/** The product page's sections beyond the hero — read straight from the
 *  same row, so Product Data and the page cannot disagree. Options and
 *  prices join here in their own phases (they live in other tables). */
/** A taxonomy node with its three names; the client picks by language. */
export interface TaxonomyName { slug: string; name: string; name_zh: string | null; name_ar: string | null }

export interface ProductDetailSections {
  /** Division › Category › Subcategory, each null when the slug resolves
   *  to nothing (a product mid-move). */
  classification: { division: TaxonomyName | null; category: TaxonomyName | null; subcategory: TaxonomyName | null };
  /** The short pitch under the tagline (products.excerpt). */
  excerpt: string | null;
  /** Global FOB in USD — present ONLY for a price audience (PRICE_AUDIENCES);
   *  null otherwise, and null when Commercial Setup is not configured. */
  fob: { product: FobFigure | null; models: Record<string, FobFigure>; fx: { cnyPerUsd: number } | null } | null;
  description: string | null;
  highlights: string[];
  featureCards: FeatureCard[];
  logistics: ProductLogistics | null;
  compliance: { ce: boolean | null; rohs: boolean | null; ipRating: string | null; hsCode: string | null; countryOfOrigin: string | null; warranty: string | null };
  warrantyMonths: number | null;
  /** Buyer options, active ones, in editor order. Empty = no section. */
  options: ProductOptionView[];
  packing: ProductPackingView | null;
  /** Internal price sheet — only when audience === "internal"; null otherwise. */
  modelPrices: ProductModelPriceView[] | null;
  /** The family roster — every visible model with its identity. name/tagline
   *  carry their zh/ar overlays so the page and the print localise them. */
  models: Array<{ id: string; code: string; name: string | null; tagline: string | null; nameI18n: Record<string, string> | null; taglineI18n: Record<string, string> | null; primary: boolean; photo: string | null }>;
}

export interface LoadedSchemaProduct {
  id: string;
  slug: string;
  productName: string;
  tagline: string | null;
  audience: ProductAudience;
  sections: ProductDetailSections;
  /* What generateMetadata / the og:image route actually emit — the same
     derivation the admin "Search & Social" preview shows, so the preview
     stays a truthful mirror of the live page. */
  seo: {
    brand: string | null;
    excerpt: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImageUrl: string | null;
  };
  preview: SchemaProductPreviewProps;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isPublic = (row: PublicProductRow): boolean =>
  row.visible === true && row.status === "active";

async function fetchProduct(idOrSlug: string): Promise<PublicProductRow | null> {
  const supabase = getSupabaseServer();
  // Slug is the common catalog link; fall back to UUID id.
  const bySlug = await supabase
    .from("products")
    .select(PRODUCT_PUBLIC_COLUMNS)
    .eq("slug", idOrSlug)
    .maybeSingle();
  if (bySlug.data) return bySlug.data as unknown as PublicProductRow;
  if (UUID_RE.test(idOrSlug)) {
    const byId = await supabase
      .from("products")
      .select(PRODUCT_PUBLIC_COLUMNS)
      .eq("id", idOrSlug)
      .maybeSingle();
    if (byId.data) return byId.data as unknown as PublicProductRow;
  }
  return null;
}

/**
 * Load ready-to-render <ProductPreview> props for a public, schema-backed
 * product. Returns null when not found, not public, or no schema resolves.
 *
 * `opts.allowUnpublished` bypasses the public (visible + active) gate so an
 * authenticated internal viewer can preview a draft/hidden product's schema
 * view before publishing. Callers MUST only pass this after verifying the
 * requester is a logged-in hub user — never on a truly public surface.
 */
const posNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function packingView(l: ProductLogistics | null): ProductPackingView | null {
  if (!l) return null;
  const rows = (l.packages ?? []).filter((r) => posNum(r.l_cm) || posNum(r.w_cm) || posNum(r.h_cm) || posNum(r.gross_kg) || r.label);
  const sums = sumPackages(rows);
  const net = posNum(l.net_weight_kg);
  const gross = posNum(l.gross_weight_kg) ?? (sums.grossKg > 0 ? sums.grossKg : null);
  const cbm = posNum(l.cbm) ?? (sums.cbm > 0 ? sums.cbm : null);
  const plan = rows.length > 0 ? loadPlan(rows, { unitsPerPackage: posNum(l.units_per_package) ?? 1 }) : null;
  const c20 = posNum(l.qty_20ft) ?? (plan && plan.c20.qty > 0 ? plan.c20.qty : null);
  const c40 = posNum(l.qty_40ft) ?? (plan && plan.c40.qty > 0 ? plan.c40.qty : null);
  const c40hq = posNum(l.qty_40hq) ?? (plan && plan.c40hq.qty > 0 ? plan.c40hq.qty : null);

  const facts: ProductPackingView["facts"] = [];
  if (l.packing_type) facts.push({ key: "packing_type", value: l.packing_type.replace(/_/g, " ") });
  if (l.wood_treatment && l.wood_treatment !== "not_wood") facts.push({ key: "wood_treatment", value: l.wood_treatment.replace(/_/g, " ") });
  if (net != null) facts.push({ key: "net_weight", value: net.toLocaleString("en-US", { maximumFractionDigits: 1 }), unit: "kg" });
  if (gross != null) facts.push({ key: "gross_weight", value: gross.toLocaleString("en-US", { maximumFractionDigits: 1 }), unit: "kg" });
  if (cbm != null) facts.push({ key: "cbm", value: cbm.toLocaleString("en-US", { maximumFractionDigits: 3 }), unit: "m³" });
  if (l.stackable != null) facts.push({ key: "stackable", value: l.stackable ? `yes${posNum(l.stack_max) ? ` · ×${posNum(l.stack_max)}` : ""}` : "no" });
  if (l.port_of_loading) facts.push({ key: "port_of_loading", value: l.port_of_loading });

  const dg = l.dangerous_goods?.has
    ? { kinds: (l.dangerous_goods.kinds ?? []).map((k) => k.replace(/_/g, " ")), unNumbers: l.dangerous_goods.un_numbers ?? null, notes: l.dangerous_goods.notes ?? null }
    : null;
  const containers = c20 != null || c40 != null || c40hq != null ? { c20, c40, c40hq } : null;
  if (facts.length === 0 && rows.length === 0 && !containers && !dg) return null;
  return {
    facts,
    containers,
    packages: rows.map((r) => ({
      label: r.label ?? null, qty: posNum(r.qty) ?? 1,
      l: posNum(r.l_cm), w: posNum(r.w_cm), h: posNum(r.h_cm), grossKg: posNum(r.gross_kg), photo: r.photo_url ?? null,
    })),
    dangerousGoods: dg,
  };
}

export async function loadPublicSchemaProduct(
  idOrSlug: string,
  opts?: { allowUnpublished?: boolean; audience?: ProductAudience },
): Promise<LoadedSchemaProduct | null> {
  const audience: ProductAudience = opts?.audience ?? "public";
  const product = await fetchProduct(idOrSlug);
  if (!product) return null;
  if (!opts?.allowUnpublished && !isPublic(product)) return null;

  const supabase = getSupabaseServer();

  const NAMES = "slug, name, name_zh, name_ar";
  const [{ data: subcat }, { data: mediaData }, { data: modelData }, { data: translationData }, { data: siblingData }, { data: divRow }, { data: catRow }, { data: optionData }] =
    await Promise.all([
      supabase.from("subcategories").select(`code, ${NAMES}`).eq("slug", product.subcategory_slug ?? "").maybeSingle(),
      supabase
        .from("product_media")
        .select('url, alt_text, "order", type, model_id')
        .eq("product_id", product.id)
        .order("order", { ascending: true }),
      supabase
        .from("product_models")
        .select('id, model_name, primary_model, tagline, name_i18n, tagline_i18n, "order", visible, status, specs_overrides, pricing_mode, price_note, global_price, head_only_price, complete_set_price, supports_head_only, supports_complete_set')
        .eq("product_id", product.id)
        .order("order", { ascending: true }),
      supabase
        .from("product_translations")
        .select("locale, product_name, tagline, excerpt, description")
        .eq("product_id", product.id),
      // Compare band: machines of the same family that carry schema specs.
      // Public surface compares against published rows only; the internal
      // preview (allowUnpublished) may also compare against drafts, matching
      // the viewer's own privilege.
      product.subcategory_slug
        ? (() => {
            let q = supabase
              .from("products")
              .select("id, product_name, slug, schema_specs")
              .eq("subcategory_slug", product.subcategory_slug)
              .neq("id", product.id)
              .not("schema_specs", "is", null)
              // '{}' rows are "connected but never filled" — useless in a
              // side-by-side and they crowd out the filled ones (limit 6).
              .neq("schema_specs", "{}")
              .limit(6);
            if (!opts?.allowUnpublished) q = q.eq("visible", true).eq("status", "active");
            return q;
          })()
        : Promise.resolve({ data: null }),
      supabase.from("divisions").select(NAMES).eq("slug", product.division_slug ?? "").maybeSingle(),
      supabase.from("categories").select(NAMES).eq("slug", product.category_slug ?? "").maybeSingle(),
      supabase.from("product_options")
        .select("id, title, title_i18n, kind, required, depends_on_value_id, sort_order")
        .eq("product_id", product.id).eq("active", true).order("sort_order", { ascending: true }),
    ]);
  const optionRows = (optionData as OptionRow[] | null) ?? [];
  const { data: optionValueData } = optionRows.length > 0
    ? await supabase.from("product_option_values")
        .select("id, option_id, label, label_i18n, image_url, price_delta_cny, weight_delta_kg, is_default, sort_order")
        .in("option_id", optionRows.map((o) => o.id)).eq("active", true).order("sort_order", { ascending: true })
    : { data: [] as OptionValueRow[] };
  const optionValues = (optionValueData as OptionValueRow[] | null) ?? [];

  const subcategoryCode = (subcat?.code as string | null) ?? "";
  const asName = (r: unknown): TaxonomyName | null => {
    const x = r as TaxonomyName | null;
    return x && x.slug ? { slug: x.slug, name: x.name, name_zh: x.name_zh ?? null, name_ar: x.name_ar ?? null } : null;
  };
  const media = (mediaData as MediaRow[] | null) ?? [];
  const models = (modelData as ModelRow[] | null) ?? [];
  const model = models.find((r) => !!r.primary_model) ?? models[0] ?? null;

  const { schema } = resolveSchema({
    divisionCode: product.division_slug || "",
    categoryCode: product.category_slug || "",
    subcategoryCode,
  });
  // No schema → not a schema-backed product; caller falls back.
  if (!schema) return null;

  // ── Server-side surface filtering (data boundary) ──
  const rawSpecs = (product.schema_specs ?? {}) as Record<string, unknown>;
  const rawKnowledge = (product.schema_knowledge ?? []) as ProductKnowledgeBlock[];
  const websiteFieldKeys = new Set(
    filterFieldsForSurface(schema.groups.flatMap((g) => g.fields), "website").map((f) => f.key),
  );
  const publicSpecs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawSpecs)) {
    if (websiteFieldKeys.has(k)) publicSpecs[k] = v;
  }
  const publicKnowledge = filterKnowledgeForSurface(rawKnowledge, "website");
  const publicSchema: ProductSchemaDefinition = {
    ...schema,
    groups: schema.groups
      .map((g) => ({ ...g, fields: filterFieldsForSurface(g.fields, "website") }))
      .filter((g) => g.fields.length > 0),
  };

  // ── Media derivation (real ProductMediaType union values) ──
  const byType = (t: string) => media.filter((m) => m.type === t);
  const gallery = byType("gallery");
  const videos = byType("video");
  const manualsMedia = byType("manual");
  const galleryUrls = gallery.map((m) => m.url).filter(Boolean);
  const mainImageUrl = byType("main_image")[0]?.url ?? galleryUrls[0] ?? null;

  // ── Siblings for the compare band (same website-surface key filter) ──
  type SiblingRow = { id: string; product_name: string; slug: string; schema_specs: Record<string, unknown> | null };
  const siblingRows = ((siblingData as SiblingRow[] | null) ?? []).filter(
    (s) => s.schema_specs && Object.keys(s.schema_specs).length > 0,
  );
  const siblingImages = new Map<string, string>();
  if (siblingRows.length > 0) {
    const { data: sibMedia } = await supabase
      .from("product_media")
      .select('product_id, url, type, "order"')
      .in("product_id", siblingRows.map((s) => s.id))
      .in("type", ["main_image", "gallery"])
      .order("order", { ascending: true });
    for (const m of (sibMedia as { product_id: string; url: string; type: string }[] | null) ?? []) {
      if (!m.url) continue;
      // main_image wins; first gallery shot is the fallback.
      if (m.type === "main_image" || !siblingImages.has(m.product_id)) siblingImages.set(m.product_id, m.url);
    }
  }
  // ── Model lineup for the "Choose your model" table ──
  const primaryModelId = (models[0] as { id?: string } | undefined)?.id ?? null;
  const photoByModel = new Map<string, string>();
  for (const m of media) {
    const mid = (m as { model_id?: string | null }).model_id;
    if (m.type === "model_image" && mid && m.url && !photoByModel.has(mid)) photoByModel.set(mid, m.url);
  }
  const variants = models
    /* Member exposure = the PRODUCT's status is the family gate (the page
       itself only renders for active products); a member follows it
       automatically UNLESS someone manually discontinued or hid that
       member — the owner's inheritance rule for status. */
    .filter((m) => m.visible !== false && (m as { status?: string | null }).status !== "discontinued" && (m.primary_model || m.model_name))
    .map((m) => {
      const overrides: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(m.specs_overrides ?? {})) {
        if (websiteFieldKeys.has(k)) overrides[k] = v;
      }
      return {
        code: (m.primary_model || m.model_name) as string,
        tagline: m.tagline,
        photo: photoByModel.get((m as { id?: string }).id ?? "") ?? null,
        primary: primaryModelId != null && (m as { id?: string }).id === primaryModelId,
        overrides,
      };
    });

  const siblings = siblingRows.map((s) => {
    const vals: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.schema_specs ?? {})) {
      if (websiteFieldKeys.has(k)) vals[k] = v;
    }
    return { name: s.product_name, slug: s.slug, imageUrl: siblingImages.get(s.id) ?? null, values: vals };
  });

  /* Price only for a price audience, and computed HERE so the hero paints
     with its figure instead of a placeholder that fills in later. One call,
     one product, model figures included. The cost never leaves the lib. */
  let fob: ProductDetailSections["fob"] = null;
  let deltasUsd: Record<string, number> = {};
  if (PRICE_AUDIENCES.has(audience) && product.tenant_id) {
    const deltas = optionValues
      .map((v) => ({ key: v.id, productId: product.id, cny: v.price_delta_cny == null ? 0 : Number(v.price_delta_cny) }))
      .filter((d) => Number.isFinite(d.cny) && d.cny !== 0);
    const r = await globalFobForProducts(product.tenant_id, [product.id], deltas);
    if (!r.reason) { fob = { product: r.prices[product.id] ?? null, models: r.models, fx: r.fx }; deltasUsd = r.deltasUsd; }
  }
  const numOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v); return Number.isFinite(n) ? n : null;
  };
  const options: ProductOptionView[] = optionRows.map((o) => ({
    id: o.id, title: o.title, title_i18n: o.title_i18n, kind: o.kind, required: !!o.required,
    dependsOnValueId: o.depends_on_value_id,
    values: optionValues.filter((v) => v.option_id === o.id).map((v) => ({
      id: v.id, label: v.label, label_i18n: v.label_i18n, image: v.image_url,
      isDefault: !!v.is_default, weightDeltaKg: numOrNull(v.weight_delta_kg),
      priceDeltaUsd: v.id in deltasUsd ? deltasUsd[v.id] : null,
    })),
  })).filter((o) => o.values.length > 0 || o.kind === "info");

  type ModelPriceRow = ModelRow & {
    id?: string; pricing_mode?: string | null; price_note?: string | null;
    global_price?: number | string | null; head_only_price?: number | string | null; complete_set_price?: number | string | null;
    supports_head_only?: boolean | null; supports_complete_set?: boolean | null;
  };
  const packing = packingView(product.logistics);

  const modelPrices: ProductModelPriceView[] | null = audience === "internal"
    ? (models as ModelPriceRow[])
        .filter((m) => m.visible !== false && (m.primary_model || m.model_name))
        .map((m) => ({
          id: m.id ?? "", code: (m.primary_model || m.model_name) as string,
          pricingMode: m.pricing_mode ?? null, priceNote: m.price_note ?? null,
          globalPrice: numOrNull(m.global_price), headOnlyPrice: numOrNull(m.head_only_price), completeSetPrice: numOrNull(m.complete_set_price),
          supportsHeadOnly: !!m.supports_head_only, supportsCompleteSet: !!m.supports_complete_set,
        }))
    : null;

  const sections: ProductDetailSections = {
    classification: { division: asName(divRow), category: asName(catRow), subcategory: asName(subcat) },
    excerpt: product.excerpt,
    fob,
    description: product.description,
    highlights: (product.highlights ?? []).filter((h) => typeof h === "string" && h.trim().length > 0),
    featureCards: (product.feature_cards ?? []).filter((c) => c && (c.image_url || c.title)),
    logistics: product.logistics ?? null,
    compliance: {
      ce: product.ce_certified, rohs: product.rohs_compliant, ipRating: product.ip_rating,
      hsCode: product.hs_code, countryOfOrigin: product.country_of_origin, warranty: product.warranty,
    },
    warrantyMonths: product.warranty_months,
    options,
    packing,
    modelPrices,
    models: models
      .filter((m) => m.visible !== false && (m as { status?: string | null }).status !== "discontinued" && (m.primary_model || m.model_name))
      .map((m) => {
        const id = (m as { id?: string }).id ?? "";
        const mi = m as { name_i18n?: Record<string, string> | null; tagline_i18n?: Record<string, string> | null };
        return {
          id,
          code: (m.primary_model || m.model_name) as string,
          name: m.model_name,
          tagline: m.tagline,
          nameI18n: mi.name_i18n ?? null,
          taglineI18n: mi.tagline_i18n ?? null,
          primary: primaryModelId != null && id === primaryModelId,
          photo: photoByModel.get(id) ?? null,
        };
      }),
  };

  return {
    id: product.id,
    slug: product.slug,
    productName: product.product_name,
    tagline: model?.tagline ?? null,
    audience,
    sections,
    seo: {
      brand: product.brand,
      excerpt: product.excerpt,
      metaTitle: product.meta_title,
      metaDescription: product.meta_description,
      ogImageUrl: product.og_image_url,
    },
    preview: {
      productName: product.product_name,
      primaryModel: model?.primary_model ?? null,
      tagline: model?.tagline ?? null,
      posterUrl: product.hero_poster_url ?? null,
      translations: (translationData as ProductLocaleText[] | null) ?? [],
      brand: product.brand,
      schema: publicSchema,
      values: publicSpecs,
      knowledge: publicKnowledge,
      mainImageUrl,
      galleryUrls,
      videoUrls: videos.map((m) => m.url).filter(Boolean),
      manuals: manualsMedia.map((m) => ({ url: m.url, label: m.alt_text })).filter((m) => !!m.url),
      ar3dUrl: byType("ar_3d")[0]?.url ?? null,
      mediaCounts: { photos: gallery.length, videos: videos.length, manuals: manualsMedia.length },
      countryOfOrigin: product.country_of_origin,
      warranty: product.warranty,
      surface: "website",
      variants,
      siblings,
    },
  };
}
