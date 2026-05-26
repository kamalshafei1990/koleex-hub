import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   GET /api/products/by-slug/[slug]

   Resolve a product (with its bound template) from a URL-friendly slug.
   Returned shape is { product, templateSlug } — small and self-contained
   so a single roundtrip is enough to render a preview page.
   --------------------------------------------------------------------------- */

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Product Data");
  if (deny) return deny;

  const { slug } = await ctx.params;
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("products")
    .select(
      `id, product_name, slug, brand, excerpt, description, highlights,
       country_of_origin, warranty, status, template_id,
       template:product_templates(slug, is_active)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  const row = data as {
    id: string;
    product_name: string;
    slug: string;
    brand: string | null;
    excerpt: string | null;
    description: string | null;
    highlights: string[] | null;
    country_of_origin: string | null;
    warranty: string | null;
    status: string | null;
    template_id: string | null;
    template:
      | { slug?: string; is_active?: boolean }
      | Array<{ slug?: string; is_active?: boolean }>
      | null;
  };

  const tpl = Array.isArray(row.template) ? row.template[0] : row.template;
  const templateSlug = tpl && tpl.is_active !== false ? tpl.slug ?? null : null;

  return NextResponse.json({
    product: {
      id: row.id,
      product_name: row.product_name,
      slug: row.slug,
      brand: row.brand,
      excerpt: row.excerpt,
      description: row.description,
      highlights: row.highlights,
      country_of_origin: row.country_of_origin,
      warranty: row.warranty,
      status: row.status,
    },
    templateSlug,
  });
}
