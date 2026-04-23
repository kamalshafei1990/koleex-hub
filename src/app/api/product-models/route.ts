import "server-only";

/* ---------------------------------------------------------------------------
   /api/product-models

   GET  — list models. Two modes:
     · ?product_id=<uuid>        → the models for one product (detail view)
     · ?summary=1                → compact per-product summary used by
                                   ProductList: { counts, suppliers,
                                   allSuppliers }. When the caller doesn't
                                   have Product Data access, `suppliers`
                                   and `allSuppliers` are returned EMPTY
                                   and `counts` is still accurate.

   POST / PATCH / DELETE live on /api/product-models/[id] (future).
   For now the browser admin UI still writes via the anon client on the
   /product-data admin route, gated behind PermissionGate.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, PUBLIC_MODEL_COLUMNS } from "@/lib/server/product-access";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const productId = url.searchParams.get("product_id");
  const wantSummary = url.searchParams.get("summary") === "1";
  const canSeeSecrets = await hasProductDataAccess(auth);

  if (wantSummary) {
    /* Counts are safe for everyone; supplier names are admin-only.
       Fetch only the minimal columns we need — don't return a row
       shape that could later leak cost. */
    const selectCols = canSeeSecrets ? "product_id, supplier" : "product_id";
    const { data, error } = await supabaseServer
      .from("product_models")
      .select(selectCols);
    if (error) {
      console.error("[api/product-models GET summary]", error.message);
      return NextResponse.json({ error: "Failed to load models" }, { status: 500 });
    }
    const counts: Record<string, number> = {};
    const suppliers: Record<string, string[]> = {};
    const supplierSet = new Set<string>();
    const rows = (data ?? []) as unknown as Array<{ product_id: string; supplier?: string | null }>;
    for (const row of rows) {
      counts[row.product_id] = (counts[row.product_id] || 0) + 1;
      if (canSeeSecrets && row.supplier) {
        if (!suppliers[row.product_id]) suppliers[row.product_id] = [];
        if (!suppliers[row.product_id].includes(row.supplier)) {
          suppliers[row.product_id].push(row.supplier);
        }
        supplierSet.add(row.supplier);
      }
    }
    return NextResponse.json(
      {
        counts,
        suppliers,
        allSuppliers: Array.from(supplierSet).sort(),
      },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
    );
  }

  /* Detail mode: models for one product. */
  if (!productId) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }
  const cols = canSeeSecrets ? "*" : PUBLIC_MODEL_COLUMNS;
  const { data, error } = await supabaseServer
    .from("product_models")
    .select(cols)
    .eq("product_id", productId)
    .order("order");
  if (error) {
    console.error("[api/product-models GET]", error.message);
    return NextResponse.json({ error: "Failed to load models" }, { status: 500 });
  }
  return NextResponse.json(
    { models: data ?? [] },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}
