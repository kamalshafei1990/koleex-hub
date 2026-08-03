import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/products/list-view — P0-A consolidated read for ProductList.

   One round-trip replacing the page's current fan-out:
     products        — full rows for Product Data callers, PUBLIC projection
                       for everyone else (product-access.ts is the single
                       source of column truth)
     counts          — product_id → model count
     primaryModelNames — product_id → first model_name (by "order")
     suppliers       — product_id → supplier names  (PD/SA ONLY; {} otherwise)
     allSuppliers    — distinct supplier list        (PD/SA ONLY; [] otherwise)
     mainImages      — product_id → main_image url
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductCostAccess, hasProductDataAccess, PUBLIC_PRODUCT_COLUMNS } from "@/lib/server/product-access";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const canSeeSecrets = await hasProductDataAccess(auth);
  /* Supplier names on models are COST-side data — stricter gate. */
  const canSeeCosts = canSeeSecrets && (await hasProductCostAccess(auth));

  const modelCols = canSeeCosts
    ? `product_id, supplier, model_name, primary_model, "order"`
    : `product_id, model_name, primary_model, "order"`;

  const [prodRes, modelRes, imgRes] = await Promise.all([
    supabaseServer
      .from("products")
      .select(canSeeSecrets ? "*" : PUBLIC_PRODUCT_COLUMNS)
      .order("created_at", { ascending: false }),
    supabaseServer.from("product_models").select(modelCols).order("order", { ascending: true }),
    supabaseServer
      .from("product_media")
      .select("product_id, url")
      .eq("type", "main_image")
      .order("order", { ascending: true }),
  ]);

  if (prodRes.error) {
    console.error("[api/products list-view]", prodRes.error.message);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  const primaryModelNames: Record<string, string> = {};
  const suppliers: Record<string, string[]> = {};
  const supplierSet = new Set<string>();
  for (const row of (modelRes.data ?? []) as unknown as Array<{
    product_id: string;
    model_name: string | null;
    primary_model?: string | null;
    supplier?: string | null;
  }>) {
    counts[row.product_id] = (counts[row.product_id] || 0) + 1;
    /* The card shows the CANONICAL KOLEEX code (primary_model) —
       model_name is a legacy/auto-derived label and drifts from what
       the operator approved (bug 2026-08-03: card read "XPRI-Y" while
       the saved code was "XPRI-01"). Fall back to model_name only when
       no KOLEEX code exists yet. */
    const label = row.primary_model?.trim() || row.model_name;
    if (label && !primaryModelNames[row.product_id]) {
      primaryModelNames[row.product_id] = label;
    }
    if (canSeeCosts && row.supplier) {
      if (!suppliers[row.product_id]) suppliers[row.product_id] = [];
      if (!suppliers[row.product_id].includes(row.supplier)) {
        supplierSet.add(row.supplier);
        suppliers[row.product_id].push(row.supplier);
      }
    }
  }

  const mainImages: Record<string, string> = {};
  for (const m of (imgRes.data ?? []) as Array<{ product_id: string; url: string }>) {
    if (!mainImages[m.product_id]) mainImages[m.product_id] = m.url;
  }

  return NextResponse.json(
    {
      products: prodRes.data ?? [],
      counts,
      primaryModelNames,
      suppliers,
      allSuppliers: Array.from(supplierSet).sort(),
      mainImages,
    },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}
