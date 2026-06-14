import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

/* /api/products/facets — P0-B.
   GET → { brands: string[], tags: string[] } distinct facet values for the
   ProductList filters + ProductForm pickers. Catalog-safe → any authed user. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await supabaseServer.from("products").select("brand, tags");
  if (error) {
    console.error("[api/products/facets]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }
  const brands = new Set<string>();
  const tags = new Set<string>();
  for (const row of (data ?? []) as { brand: string | null; tags: string[] | null }[]) {
    if (row.brand) brands.add(row.brand);
    for (const t of row.tags ?? []) tags.add(t);
  }
  return NextResponse.json(
    { brands: Array.from(brands).sort(), tags: Array.from(tags).sort() },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}
