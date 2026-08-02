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

const PRODUCT_PUBLIC_COLUMNS =
  "id, product_name, slug, brand, division_slug, category_slug, subcategory_slug, " +
  "schema_id, schema_version, schema_specs, schema_knowledge, schema_visibility, " +
  "warranty, country_of_origin, status, visible, featured, hero_poster_url";

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
}

interface MediaRow {
  url: string;
  alt_text: string | null;
  order: number | null;
  type: string;
}

interface ModelRow {
  primary_model: string | null;
  tagline: string | null;
  order: number | null;
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
  /** Same-subcategory public products powering the compare band. */
  siblings: {
    name: string;
    slug: string;
    imageUrl: string | null;
    values: Record<string, unknown>;
  }[];
}

export interface LoadedSchemaProduct {
  productName: string;
  tagline: string | null;
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
export async function loadPublicSchemaProduct(
  idOrSlug: string,
  opts?: { allowUnpublished?: boolean },
): Promise<LoadedSchemaProduct | null> {
  const product = await fetchProduct(idOrSlug);
  if (!product) return null;
  if (!opts?.allowUnpublished && !isPublic(product)) return null;

  const supabase = getSupabaseServer();

  const [{ data: subcat }, { data: mediaData }, { data: modelData }, { data: translationData }, { data: siblingData }] =
    await Promise.all([
      supabase.from("subcategories").select("code").eq("slug", product.subcategory_slug ?? "").maybeSingle(),
      supabase
        .from("product_media")
        .select('url, alt_text, "order", type')
        .eq("product_id", product.id)
        .order("order", { ascending: true }),
      supabase
        .from("product_models")
        .select('primary_model, tagline, "order"')
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
    ]);

  const subcategoryCode = (subcat?.code as string | null) ?? "";
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
  const siblings = siblingRows.map((s) => {
    const vals: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.schema_specs ?? {})) {
      if (websiteFieldKeys.has(k)) vals[k] = v;
    }
    return { name: s.product_name, slug: s.slug, imageUrl: siblingImages.get(s.id) ?? null, values: vals };
  });

  return {
    productName: product.product_name,
    tagline: model?.tagline ?? null,
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
      siblings,
    },
  };
}
