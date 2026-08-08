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
import { resolveProductSearchReach } from "@/lib/server/product-search-reach";

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
    /* Give the server search the browser search's reach — model codes, SKUs,
       supplier names, the models' Chinese names, and taxonomy names in all
       three languages. Without this, moving the list to the server would have
       silently broken searching by model code or supplier. */
    const reach = listReq.q
      ? await resolveProductSearchReach(listReq.q, auth.tenant_id)
      : { terms: [] as string[], capped: false };
    let pq = supabaseServer
      .from("products")
      /* exact count drives the pager; at catalogue scale (thousands, not
         millions) a counted page is still one indexed scan. */
      .select(cols, { count: "exact" })
      .eq("tenant_id", auth.tenant_id);
    if (!canSeeSecrets) pq = pq.eq("status", "active");
    pq = applyServerList(pq, listReq, PRODUCTS_LIST_CONFIG, reach.terms);

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

    /* MODEL CODES TRAVEL WITH THE PAGE. They used to arrive later, in the
       signals payload, and the card is built around them — the heading is the
       model code, the family chips are the member codes, and the count says
       "N models". So every card first painted with the descriptive name, an
       amber "Needs name" and "0 models", then rebuilt ~1 s later at a
       different height: measured on production, the card body went 208px ->
       311px after it was already on screen. The owner called it a glitch, and
       the worse half was that the first version was WRONG.

       One extra query, scoped to the ids ON THIS PAGE (150 max), so it costs
       the same whether the catalogue holds 121 products or 3000. */
    const ids = rows.map((r) => r.id).filter(Boolean) as string[];
    let models: {
      counts: Record<string, number>;
      primaryModelNames: Record<string, string>;
      modelNames: Record<string, string[]>;
    } | undefined;
    if (ids.length) {
      const { data: mRows, error: mErr } = await supabaseServer
        .from("product_models")
        .select('product_id, primary_model, model_name, visible, status, "order"')
        .in("product_id", ids)
        .order("order", { ascending: true });
      if (mErr) console.error("[api/products paged models]", mErr.message);
      const counts: Record<string, number> = {};
      const names: Record<string, string[]> = {};
      const primary: Record<string, string> = {};
      /* THESE RULES MUST MATCH /api/products/signals EXACTLY. Both feed the
         same card, so any difference shows up as the card visibly correcting
         itself a second after it painted — the first version of this used
         model_name alone and the heading flipped XPRS-Y -> XPRS-160S. */
      for (const raw of (mRows ?? []) as {
        product_id: string | null; primary_model: string | null; model_name: string | null;
        visible: boolean | null; status: string | null;
      }[]) {
        if (!raw.product_id) continue;
        counts[raw.product_id] = (counts[raw.product_id] ?? 0) + 1;
        const label = raw.primary_model?.trim() || raw.model_name;
        if (!label) continue;
        primary[raw.product_id] ??= label;
        /* The roster advertises SELLABLE members only — a member leaves it
           when someone hid or discontinued it. */
        if (raw.visible !== false && raw.status !== "discontinued") {
          const list = (names[raw.product_id] ??= []);
          if (!list.includes(label)) list.push(label);
        }
      }
      models = { counts, primaryModelNames: primary, modelNames: names };
    }
    _t.mark("models");

    const body = { ...buildListResponse(rows, listReq, count ?? null), models };
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
