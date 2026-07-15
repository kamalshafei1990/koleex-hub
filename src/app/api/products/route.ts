import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

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
import { stageTimer } from "@/lib/server/perf";
import { hasProductDataAccess, LIST_PRODUCT_COLUMNS, PUBLIC_PRODUCT_COLUMNS, requireProductDataAction } from "@/lib/server/product-access";

export async function GET(req: Request) {
  const _t = stageTimer("products.list");
  const auth = await requireAuth();
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }

  /* ?view=list → slim projection with only the columns the catalogue
     grids render/search. LIST_PRODUCT_COLUMNS is a subset of the public
     set, so no access check is needed for it; the full shape keeps the
     public/admin split. */
  const listView = new URL(req.url).searchParams.get("view") === "list";
  let cols: string;
  if (listView) {
    cols = LIST_PRODUCT_COLUMNS;
  } else {
    const canSeeSecrets = await hasProductDataAccess(auth);
    cols = canSeeSecrets ? "*" : PUBLIC_PRODUCT_COLUMNS;
  }
  _t.mark("auth");

  const { data, error } = await supabaseServer
    .from("products")
    .select(cols)
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });
  _t.mark("db");

  if (error) {
    console.error("[api/products GET]", error.message);
    _t.done({ status: 500 });
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
  const { header } = _t.done({ status: 200, view: listView ? "list" : "full", rows: (data ?? []).length });
  return NextResponse.json(
    { products: data ?? [] },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300", "Server-Timing": header } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  /* Creating products is an internal operation — requires full
     Product Data access. Customers posting to this endpoint get
     403 regardless of what they put in the body. */
  const denied = await requireProductDataAction(auth, "create");
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  delete body.id;
  /* products.tenant_id is NOT NULL; the legacy client always sent it
     explicitly. Default to the caller's tenant so API consumers don't
     have to know about tenancy. */
  if (!body.tenant_id) body.tenant_id = auth.tenant_id;
  const { data, error } = await supabaseServer
    .from("products")
    .insert(body)
    .select()
    .single();
  if (error) {
    console.error("[api/products POST]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }
  return NextResponse.json({ product: data });
}
