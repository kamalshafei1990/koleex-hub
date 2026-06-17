import "server-only";

/* ---------------------------------------------------------------------------
   /api/product-suppliers

   The product↔supplier LINK. Supplier MASTER data lives in the Suppliers
   app; this endpoint only manages the per-product facts on
   `product_suppliers` (supplier_product_code, moq, lead_time_days,
   unit_cost_cny, currency, payment_terms, is_primary, show_in_catalog,
   notes). Product Data never duplicates supplier master fields.

   GET  ?product_id=<uuid>  → { suppliers: ProductSupplierRow[] }
   PUT  { product_id, suppliers: [...] }  → replaces the full set for that
        product (delete-missing + insert-provided). Product Data / SA only.

   Auth: any authenticated user may READ; writes require Product Data access.
   Tenant: scoped through the owning product row (product_suppliers has no
   tenant_id of its own).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";
import { humanizeError } from "@/lib/ui/humanize-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LINK_COLS =
  "id, product_id, supplier_id, is_primary, show_in_catalog, supplier_product_code, moq, lead_time_days, unit_cost_cny, currency, payment_terms, notes";

/* Confirm the product exists AND belongs to the caller's tenant before
   reading/writing its supplier links. Returns the product id or null. */
async function tenantOwnsProduct(productId: string, tenantId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();
  return !!data;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const productId = new URL(req.url).searchParams.get("product_id") || "";
  if (!UUID_RE.test(productId)) {
    return NextResponse.json({ suppliers: [] });
  }
  if (!(await tenantOwnsProduct(productId, auth.tenant_id))) {
    return NextResponse.json({ suppliers: [] });
  }

  const { data, error } = await supabaseServer
    .from("product_suppliers")
    .select(LINK_COLS)
    .eq("product_id", productId)
    .order("is_primary", { ascending: false });
  if (error) {
    console.error("[api/product-suppliers GET]", error.message);
    return NextResponse.json({ error: "Failed to load supplier links" }, { status: 500 });
  }
  return NextResponse.json(
    { suppliers: data ?? [] },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } },
  );
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json(
      { error: "Only Product Data admins can edit supplier links." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    product_id?: string;
    suppliers?: Array<Record<string, unknown>>;
  };
  const productId = body.product_id || "";
  if (!UUID_RE.test(productId)) {
    return NextResponse.json({ error: "A valid product_id is required." }, { status: 400 });
  }
  if (!(await tenantOwnsProduct(productId, auth.tenant_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const incoming = Array.isArray(body.suppliers) ? body.suppliers : [];

  /* Normalise the link rows. Only supplier_id is required; everything
     else is the optional per-product commercial detail. A blank
     numeric reads as null (not 0) so "unknown cost" stays unknown. */
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const rows = incoming
    .filter((r) => typeof r.supplier_id === "string" && UUID_RE.test(r.supplier_id as string))
    .map((r) => ({
      product_id: productId,
      supplier_id: r.supplier_id as string,
      is_primary: !!r.is_primary,
      show_in_catalog: r.show_in_catalog === undefined ? false : !!r.show_in_catalog,
      supplier_product_code: (r.supplier_product_code as string) || null,
      moq: num(r.moq),
      lead_time_days: num(r.lead_time_days),
      unit_cost_cny: num(r.unit_cost_cny),
      currency: (r.currency as string) || null,
      payment_terms: (r.payment_terms as string) || null,
      notes: (r.notes as string) || null,
    }));

  /* At most one primary. If callers mark several, keep the first. */
  let sawPrimary = false;
  for (const row of rows) {
    if (row.is_primary && !sawPrimary) sawPrimary = true;
    else row.is_primary = false;
  }

  /* Replace-the-set: clear existing links for this product, then insert
     the new set. product_suppliers carries no transactional history, so a
     wholesale replace is safe and keeps the diff logic trivial. */
  const del = await supabaseServer.from("product_suppliers").delete().eq("product_id", productId);
  if (del.error) {
    console.error("[api/product-suppliers PUT delete]", del.error.message);
    return NextResponse.json({ error: humanizeError(del.error) }, { status: 500 });
  }
  if (rows.length) {
    const ins = await supabaseServer.from("product_suppliers").insert(rows);
    if (ins.error) {
      console.error("[api/product-suppliers PUT insert]", ins.error.message);
      return NextResponse.json({ error: humanizeError(ins.error) }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
