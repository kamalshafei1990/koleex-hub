/**
 * Public product page — /products/preview/[slug]
 * ---------------------------------------------------------------------------
 * Server Component (RSC). Architecture-validation layer for the schema-driven
 * product system: it fetches public-safe product data on the server and hands
 * it to the SHARED <ProductPreview> with surface="website". ProductPreview owns
 * ALL spec/knowledge rendering — this page does zero presentation of specs.
 *
 * Security model:
 *   • getSupabaseServer() is service-role and bypasses RLS, so the leak surface
 *     is controlled entirely by (a) selecting only public-safe product columns
 *     and (b) passing surface="website" so filterFieldsForSurface /
 *     filterKnowledgeForSurface strip internal fields (cost, supplier, HS code,
 *     MOQ). Cost/supplier live on product_models and are NEVER read into the
 *     props passed to ProductPreview.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getSupabaseServer } from "@/lib/server/supabase-server";
import { resolveSchema } from "@/lib/product-schema";
import type { ProductKnowledgeBlock } from "@/types/product-schema";
import { ProductPreview } from "@/components/product-preview/ProductPreview";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";

/* Public-safe product columns only. No cost_price / supplier / margin. */
const PRODUCT_PUBLIC_COLUMNS =
  "id, product_name, slug, brand, division_slug, category_slug, subcategory_slug, " +
  "schema_id, schema_version, schema_specs, schema_knowledge, schema_visibility, " +
  "warranty, country_of_origin, status, visible, featured";

interface PublicProductRow {
  id: string;
  product_name: string;
  slug: string;
  brand: string | null;
  division_slug: string | null;
  category_slug: string | null;
  subcategory_slug: string | null;
  schema_id: string | null;
  schema_version: string | null;
  schema_specs: Record<string, unknown> | null;
  schema_knowledge: unknown[] | null;
  schema_visibility: Record<string, unknown> | null;
  warranty: string | null;
  country_of_origin: string | null;
  status: string | null;
  visible: boolean | null;
  featured: boolean | null;
}

interface MediaRow {
  url: string;
  alt_text: string | null;
  order: number | null;
  type: string;
  role: string | null;
}

interface ModelRow {
  primary_model: string | null;
  tagline: string | null;
  order: number | null;
}

/* A product is publicly viewable only when published + visible. */
const isPublic = (row: PublicProductRow): boolean =>
  row.visible === true && row.status === "active";

async function fetchProduct(slug: string): Promise<PublicProductRow | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_PUBLIC_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as PublicProductRow;
}

async function fetchSubcategoryCode(slug: string | null): Promise<string> {
  if (!slug) return "";
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("subcategories")
    .select("code")
    .eq("slug", slug)
    .maybeSingle();
  return (data?.code as string | null) ?? "";
}

async function fetchMedia(productId: string): Promise<MediaRow[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("product_media")
    .select('url, alt_text, "order", type, role')
    .eq("product_id", productId)
    .order("order", { ascending: true });
  return (data as MediaRow[] | null) ?? [];
}

async function fetchPrimaryModel(productId: string): Promise<ModelRow | null> {
  const supabase = getSupabaseServer();
  // Only public-safe columns. Never read cost_price / global_price / supplier.
  const { data } = await supabase
    .from("product_models")
    .select('primary_model, tagline, "order"')
    .eq("product_id", productId)
    .order("order", { ascending: true });
  const rows = (data as ModelRow[] | null) ?? [];
  if (rows.length === 0) return null;
  // Derive the primary model: first row carrying a primary_model, else first row.
  return rows.find((r) => !!r.primary_model) ?? rows[0];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product || !isPublic(product)) {
    return { title: "Product not found — KOLEEX" };
  }
  const model = await fetchPrimaryModel(product.id);
  const description = model?.tagline ?? undefined;
  return {
    title: `${product.product_name} — KOLEEX`,
    description,
  };
}

export default async function PublicProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await fetchProduct(slug);
  if (!product || !isPublic(product)) {
    notFound();
  }

  // Parallel: subcategory code (for schema resolution), media, primary model.
  const [subcategoryCode, media, model] = await Promise.all([
    fetchSubcategoryCode(product.subcategory_slug),
    fetchMedia(product.id),
    fetchPrimaryModel(product.id),
  ]);

  // ── Schema resolution (real exported resolver) ──
  const { schema } = resolveSchema({
    divisionCode: product.division_slug || "",
    categoryCode: product.category_slug || "",
    subcategoryCode: subcategoryCode || "",
  });

  // ── Media derivation using the real ProductMediaType union values ──
  const byType = (t: string) => media.filter((m) => m.type === t);
  const gallery = byType("gallery");
  const videos = byType("video");
  const manualsMedia = byType("manual");
  const mainImageRow = byType("main_image")[0];

  const galleryUrls = gallery.map((m) => m.url).filter(Boolean);
  const mainImageUrl = mainImageRow?.url ?? galleryUrls[0] ?? null;
  const videoUrls = videos.map((m) => m.url).filter(Boolean);
  const manuals = manualsMedia
    .map((m) => ({ url: m.url, label: m.alt_text }))
    .filter((m) => !!m.url);
  const ar3dUrl = byType("ar_3d")[0]?.url ?? null;

  const mediaCounts = {
    photos: gallery.length,
    videos: videos.length,
    manuals: manualsMedia.length,
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Minimal chrome — architecture validation layer, not the final site. */}
      <header className="border-b border-[var(--border-subtle)]">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-4">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>All products</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 md:px-8 py-6 md:py-10">
        <ProductPreview
          productName={product.product_name}
          primaryModel={model?.primary_model ?? null}
          tagline={model?.tagline ?? null}
          brand={product.brand}
          schema={schema}
          values={product.schema_specs ?? {}}
          knowledge={(product.schema_knowledge ?? []) as ProductKnowledgeBlock[]}
          mainImageUrl={mainImageUrl}
          galleryUrls={galleryUrls}
          videoUrls={videoUrls}
          manuals={manuals}
          ar3dUrl={ar3dUrl}
          mediaCounts={mediaCounts}
          countryOfOrigin={product.country_of_origin}
          warranty={product.warranty}
          surface="website"
        />
      </main>
    </div>
  );
}
