import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

/* ---------------------------------------------------------------------------
   /api/products/[id]/related — P0-A.
   GET — related products for one product (id, related_id, order, name).
         Catalog-safe: any authenticated user (names/slugs are public data).
   PUT — replace the related set: body { relatedIds: string[] } in display
         order. Product Data / SA only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }
  const { data, error } = await supabaseServer
    .from("related_products")
    .select("*, products!related_products_related_id_fkey(product_name)")
    .eq("product_id", id)
    .order("order");
  if (error) {
    console.error("[api/products related GET]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }
  const related = (data ?? []).map((r: Record<string, unknown>) => ({
    product_id: r.product_id as string,
    related_id: r.related_id as string,
    order: r.order as number,
    relation_type: (r.relation_type as string) || "related",
    product_name: (r.products as Record<string, unknown> | null)?.product_name as
      | string
      | undefined,
  }));
  return NextResponse.json({ related });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can edit related products." },
      { status: 403 },
    );
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }
  const REL_TYPES = new Set([
    "related", "accessory", "spare_part", "compatible_with", "replaces",
    "replaced_by", "bundle", "consumable", "required_addon", "upgrade", "optional_attachment",
  ]);
  const body = (await req.json().catch(() => ({}))) as {
    relatedIds?: unknown;
    relations?: Array<{ related_id?: unknown; relation_type?: unknown }>;
  };

  /* Phase 6 — prefer the typed `relations` payload; fall back to the legacy
     `relatedIds: string[]` (everything → 'related') for back-compat. */
  let rows: { product_id: string; related_id: string; relation_type: string; order: number }[] = [];
  if (Array.isArray(body.relations)) {
    rows = body.relations
      .filter((r) => typeof r.related_id === "string" && UUID_RE.test(r.related_id as string))
      .map((r, i) => ({
        product_id: id,
        related_id: r.related_id as string,
        relation_type: REL_TYPES.has(r.relation_type as string) ? (r.relation_type as string) : "related",
        order: i,
      }));
  } else if (Array.isArray(body.relatedIds)) {
    rows = (body.relatedIds as string[])
      .filter((r) => UUID_RE.test(r))
      .map((rid, i) => ({ product_id: id, related_id: rid, relation_type: "related", order: i }));
  }

  // Replace-set semantics, matching the legacy lib behaviour.
  const del = await supabaseServer.from("related_products").delete().eq("product_id", id);
  if (del.error) {
    console.error("[api/products related PUT del]", del.error.message);
    return NextResponse.json({ error: del.error.message }, { status: 500 });
  }
  if (rows.length) {
    const ins = await supabaseServer.from("related_products").insert(rows);
    if (ins.error) {
      console.error("[api/products related PUT ins]", ins.error.message);
      return NextResponse.json({ error: ins.error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
