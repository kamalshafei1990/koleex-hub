import "server-only";
import { humanizeError } from "@/lib/ui/humanize-error";

/* ---------------------------------------------------------------------------
   GET /api/products/cost-history?model_id=<uuid>   (or ?product_id=<uuid>)

   P2 (read-only) — return the permanent, append-only Head Cost change ledger
   for a model (or all models of a product), newest first.

   Multi-tenant safety: before returning anything we confirm the requested
   model/product belongs to the caller's tenant (product_models → products).
   The ledger rows are also tenant-stamped and filtered by tenant_id, so a
   caller can never read another tenant's cost history.

   Access: requires Product Data access (cost is a secret field).

   No writes; no effect on existing behaviour.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const modelId = (params.get("model_id") || "").trim();
  const productId = (params.get("product_id") || "").trim();
  if (!modelId && !productId) {
    return NextResponse.json({ error: "Missing ?model_id or ?product_id" }, { status: 400 });
  }

  // Ownership check: the target model/product must live in the caller's tenant.
  if (modelId) {
    const { data: owner } = await supabaseServer
      .from("product_models")
      .select("id, product:products!inner(tenant_id)")
      .eq("id", modelId)
      .eq("products.tenant_id", auth.tenant_id)
      .maybeSingle();
    if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else {
    const { data: owner } = await supabaseServer
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let q = supabaseServer
    .from("product_cost_history")
    .select(
      "id, product_id, model_id, model_number, previous_head_cost, new_head_cost, " +
        "change_type, source, quotation_id, user_id, user_name, note, created_at",
    )
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false })
    .limit(200);
  q = modelId ? q.eq("model_id", modelId) : q.eq("product_id", productId);

  const { data, error } = await q;
  if (error) {
    console.error("[cost-history]", error.message);
    return NextResponse.json({ error: humanizeError(error) }, { status: 500 });
  }

  return NextResponse.json({ history: data ?? [] });
}
