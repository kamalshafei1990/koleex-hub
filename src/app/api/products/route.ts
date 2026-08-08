import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";
import { coerceProductArrayColumns } from "@/lib/product-array-columns";

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
import { parseListParams, buildListResponse } from "@/lib/server-list/types";
import { applyServerList } from "@/lib/server-list/apply";
import { PRODUCTS_LIST_CONFIG } from "@/lib/server-list/products-config";

export async function GET(req: Request) {
  const _t = stageTimer("products.list");
  const auth = await requireAuth();
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }

  /* ?view=list → slim projection with only the columns the catalogue
     grids render/search. LIST_PRODUCT_COLUMNS is a subset of the public
     set, so no access check is needed for it; the full shape keeps the
     public/admin split. */
  const url = new URL(req.url);
  const listView = url.searchParams.get("view") === "list";
  const canSeeSecrets = await hasProductDataAccess(auth);
  const cols = listView ? LIST_PRODUCT_COLUMNS : canSeeSecrets ? "*" : PUBLIC_PRODUCT_COLUMNS;
  _t.mark("auth");

  /* ── ?paged=1 — server-driven list (search / filter / sort / page in SQL) ──
     OPT-IN and additive: a caller that does not pass `paged` falls through to
     the unchanged full-list path below and gets byte-identical output, so
     nothing that exists today changes behaviour.

     This is the path the catalogue has to move onto before the owner's real
     data lands. At 3000 products the full list is ~1.8 MB on a response path
     measured at 2100 ms per 128 KB; one page of 48 is ~29 KB.

     Column policy and the active-only catalogue rule are applied HERE, above
     applyServerList, exactly as on the unpaged path — the helper only adds
     search, ordering and the offset window, and only over allowlisted
     columns. */
  if (url.searchParams.get("paged") === "1") {
    const listReq = parseListParams(url.searchParams, PRODUCTS_LIST_CONFIG);
    let pq = supabaseServer
      .from("products")
      /* exact count drives the pager; at catalogue scale (thousands, not
         millions) a counted page is still one indexed scan. */
      .select(cols, { count: "exact" })
      .eq("tenant_id", auth.tenant_id);
    if (!canSeeSecrets) pq = pq.eq("status", "active");
    pq = applyServerList(pq, listReq, PRODUCTS_LIST_CONFIG);

    const { data, error: pagedError, count } = await pq;
    _t.mark("db");
    if (pagedError) {
      console.error("[api/products GET paged]", pagedError.message);
      _t.done({ status: 500, paged: 1 });
      return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
    }
    /* Rows are handed over in exactly the shape the unpaged path returns
       them — no extra coercion here, so a page and a full list are the same
       objects and the grid needs no second code path. The cast is only
       because `select()` takes a runtime string, which erases the row type. */
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const body = buildListResponse(rows, listReq, count ?? null);
    const { header } = _t.done({ status: 200, paged: 1, rows: rows.length });
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300", "Server-Timing": header },
    });
  }

  /* Catalog rule (owner, 2026-08-05): only ACTIVE products exist outside
     Product Data. Enforced HERE, not in the client — anyone without the
     Product Data grant (staff on /products today, the public website when
     it goes live) never receives a draft or archived row at all. Privileged
     staff still get everything; /product-data is the working tool. */
  let query = supabaseServer
    .from("products")
    .select(cols)
    .eq("tenant_id", auth.tenant_id);
  if (!canSeeSecrets) query = query.eq("status", "active");
  const { data, error } = await query.order("created_at", { ascending: false });
  _t.mark("db");

  if (error) {
    console.error("[api/products GET]", error.message);
    _t.done({ status: 500 });
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
  const { header } = _t.done({ status: 200, view: listView ? "list" : "full", rows: (data ?? []).length });
  return NextResponse.json(
    { products: data ?? [] },
    { headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=900", "Server-Timing": header } },
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
  /* Last line of defence for the text[] columns — the form coerces too, but
     any other caller sending a scalar would otherwise get a 500. */
  coerceProductArrayColumns(body);
  const { data, error } = await supabaseServer
    .from("products")
    .insert(body)
    .select()
    .single();
  if (error) {
    console.error("[api/products POST]", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }
  return NextResponse.json({ product: data });
}
