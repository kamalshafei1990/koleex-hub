import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/products/model-by-number?model=<string>

   P2 (read-only) — Quotation cost auto-load. Given a model number typed in a
   quotation row, find the matching product model in THIS tenant and return its
   saved Head Cost (RMB), description, and primary photo so the editor can
   pre-fill the row.

   Lookup order (first hit wins), case-INSENSITIVE but EXACT match only
   (no fuzzy / partial / wildcard):
       1. product_models.model_name
       2. product_models.primary_model
       3. product_models.reference_model

   Multi-tenant safety: product_models has no tenant_id of its own, so every
   query inner-joins products and filters products.tenant_id = caller's tenant.
   A model belonging to another tenant can never match.

   Access: requires Product Data access (cost is a secret field) — customers
   and roles without it get 403, never a cost number.

   This route performs NO writes and changes NO existing behaviour.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess } from "@/lib/server/product-access";

/* Escape LIKE/ILIKE metacharacters so the lookup is a true exact match —
   a model number containing % or _ must match literally, not as a wildcard. */
function escapeLike(s: string): string {
  return s.replace(/([\\%_])/g, "\\$1");
}

const MODEL_SELECT =
  "id, product_id, model_name, primary_model, reference_model, sku, " +
  "cost_price, supports_head_only, supports_complete_set, " +
  "cost_source, cost_updated_at, cost_updated_by, cost_updated_by_name, status, " +
  "product:products!inner(id, product_name, description, tenant_id, status)";

type ModelRow = {
  id: string;
  product_id: string;
  model_name: string | null;
  primary_model: string | null;
  reference_model: string | null;
  sku: string | null;
  cost_price: number | null;
  supports_head_only: boolean | null;
  supports_complete_set: boolean | null;
  cost_source: string | null;
  cost_updated_at: string | null;
  cost_updated_by: string | null;
  cost_updated_by_name: string | null;
  status: string | null;
  product: {
    id: string;
    product_name: string | null;
    description: string | null;
    tenant_id: string;
    status: string | null;
  } | null;
};

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (!(await hasProductDataAccess(auth))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = (new URL(req.url).searchParams.get("model") || "").trim();
  if (!raw) {
    return NextResponse.json({ error: "Missing ?model" }, { status: 400 });
  }

  const pattern = escapeLike(raw);
  const tiers: Array<{ column: "model_name" | "primary_model" | "reference_model" }> = [
    { column: "model_name" },
    { column: "primary_model" },
    { column: "reference_model" },
  ];

  let hit: ModelRow | null = null;
  let matchedBy: string | null = null;

  for (const tier of tiers) {
    const { data, error } = await supabaseServer
      .from("product_models")
      .select(MODEL_SELECT)
      .eq("products.tenant_id", auth.tenant_id) // tenant scope via parent product
      .ilike(tier.column, pattern) // case-insensitive EXACT (metachars escaped)
      .limit(1);

    if (error) {
      console.error("[model-by-number]", tier.column, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const row = (data?.[0] as unknown as ModelRow | undefined) ?? null;
    if (row) {
      hit = row;
      matchedBy = tier.column;
      break;
    }
  }

  if (!hit) {
    return NextResponse.json({ found: false, model: null });
  }

  // Primary photo: first image for this model (or its product), oldest first.
  let photo: string | null = null;
  const { data: media } = await supabaseServer
    .from("product_media")
    .select("url, model_id, type, role, order")
    .eq("product_id", hit.product_id)
    .order("order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(20);
  if (media && media.length) {
    const imgs = media.filter(
      (m) => (m.type ?? "image") === "image" && typeof m.url === "string" && m.url,
    );
    // Prefer media tied to this exact model, else any product image.
    photo =
      (imgs.find((m) => m.model_id === hit!.id)?.url as string | undefined) ??
      (imgs[0]?.url as string | undefined) ??
      null;
  }

  return NextResponse.json({
    found: true,
    matchedBy,
    model: {
      id: hit.id,
      productId: hit.product_id,
      modelName: hit.model_name,
      primaryModel: hit.primary_model,
      referenceModel: hit.reference_model,
      sku: hit.sku,
      headCostRmb: hit.cost_price, // canonical Head Cost (RMB)
      supportsHeadOnly: hit.supports_head_only,
      supportsCompleteSet: hit.supports_complete_set,
      costSource: hit.cost_source,
      costUpdatedAt: hit.cost_updated_at,
      costUpdatedBy: hit.cost_updated_by,
      costUpdatedByName: hit.cost_updated_by_name,
      status: hit.status,
      description: hit.product?.description ?? null,
      productName: hit.product?.product_name ?? null,
      photo,
    },
  });
}
