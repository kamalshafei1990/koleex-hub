import "server-only";

/* ---------------------------------------------------------------------------
   /api/products

   GET   — list products. Any authenticated user gets the catalog. Rows
           are returned in full for callers who have "Product Data"
           access (or is_super_admin); anyone else gets a PUBLIC
           projection with secret fields stripped — even though the
           `products` table itself has no classic "secret" columns
           today, the projection lists the catalog-safe column set so
           any future admin-only column can be added without leaking.

   POST  — create a product. Requires "Product Data" access (or SA).

   Mutations (PATCH, DELETE) live on /api/products/[id].

   Design rule: the browser must never see cost/supplier fields when
   the caller is a customer. We used to leak them via the old
   anon-client fetch; this route replaces those reads.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, PUBLIC_PRODUCT_COLUMNS } from "@/lib/server/product-access";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const canSeeSecrets = await hasProductDataAccess(auth);
  const cols = canSeeSecrets ? "*" : PUBLIC_PRODUCT_COLUMNS;

  const { data, error } = await supabaseServer
    .from("products")
    .select(cols)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/products GET]", error.message);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
  return NextResponse.json(
    { products: data ?? [] },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Creating products is an internal operation — requires full
     Product Data access. Customers posting to this endpoint get
     403 regardless of what they put in the body. */
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can create products." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = await supabaseServer
    .from("products")
    .insert(body)
    .select()
    .single();
  if (error) {
    console.error("[api/products POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ product: data });
}
