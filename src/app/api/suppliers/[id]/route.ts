import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/suppliers/[id] — Supplier 360.

   Returns the supplier (contacts row) plus everything linked to it:
   purchase orders, vendor bills, payments, and products supplied. Each
   linked dataset is fetched INDEPENDENTLY and fault-tolerantly — if a table
   or column doesn't exist in this deployment, that slice degrades to an
   empty array instead of failing the whole page. All queries are tenant
   scoped; access requires the Suppliers module.

   Response:
     200 { supplier, purchaseOrders[], bills[], payments[], products[] }
     401 { error } · 403 { error } · 404 { error } · 500 { error }
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

type Row = Record<string, unknown>;

/* Best-effort fetch: never throws. A missing table/column (or any query
   error) resolves to [] so one broken slice can't break the 360 page. */
async function safe(build: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  try {
    const r = await build();
    if (!r || r.error || !Array.isArray(r.data)) return [];
    return r.data as Row[];
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  const { data: supplier, error: supErr } = await supabaseServer
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tid)
    .maybeSingle();

  if (supErr) {
    console.error("[api/suppliers/:id]", supErr.message);
    return NextResponse.json({ error: "Failed to load supplier" }, { status: 500 });
  }
  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const [purchaseOrders, bills, payments, products] = await Promise.all([
    safe(() =>
      supabaseServer
        .from("purchase_orders")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("vendor_bills")
        .select("*")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("finance_payments")
        .select("*")
        .eq("tenant_id", tid)
        .eq("party_type", "supplier")
        .eq("party_id", id)
        .limit(200),
    ),
    safe(() =>
      supabaseServer
        .from("products")
        .select("id, name, primary_model, photo_url, slug, supplier_id")
        .eq("tenant_id", tid)
        .eq("supplier_id", id)
        .limit(200),
    ),
  ]);

  return NextResponse.json(
    { supplier, purchaseOrders, bills, payments, products },
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } },
  );
}
