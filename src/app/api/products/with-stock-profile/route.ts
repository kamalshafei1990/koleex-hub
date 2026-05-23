import "server-only";

/* ===========================================================================
   GET /api/products/with-stock-profile

   INV-H1 Scope 4 — Source data for the movement form's product picker.
   Returns products joined to their tenant-scoped stock profile so the
   UI can show product identity (name, SKU/model, image) but post
   movements against inventory_item_id behind the scenes.

   Query params:
     q             optional search (matches product_name or model.sku)
     limit         default 200, max 1000
     tracked_only  when "true", only products with an active stock
                   profile in this tenant are returned.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

const MODULE = "Inventory";

interface ProductRow {
  id: string;
  product_name: string;
  slug: string;
  brand: string | null;
  status: string | null;
}
interface ModelRow { product_id: string; sku: string | null; model_name: string | null }
interface MediaRow { product_id: string; url: string | null; type: string | null }
interface ItemRow {
  id: string;
  linked_product_id: string;
  item_code: string;
  unit_of_measure: string;
  default_warehouse_id: string | null;
  status: string;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const trackedOnly = url.searchParams.get("tracked_only") === "true";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 1000);

  let prodQ = supabaseServer
    .from("products")
    .select("id, product_name, slug, brand, status")
    .order("product_name", { ascending: true })
    .limit(limit);
  if (q) {
    const s = q.replace(/[%_]/g, "\\$&");
    prodQ = prodQ.or(`product_name.ilike.%${s}%,slug.ilike.%${s}%,brand.ilike.%${s}%`);
  }
  const { data: products, error: pErr } = await prodQ;
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  const prodRows = (products ?? []) as ProductRow[];
  if (prodRows.length === 0) return NextResponse.json({ products: [] });

  const ids = prodRows.map((p) => p.id);

  /* In parallel, pull the tenant's stock profiles + first model SKU + first media. */
  const [itemsRes, modelsRes, mediaRes] = await Promise.all([
    supabaseServer
      .from("inventory_items")
      .select("id, linked_product_id, item_code, unit_of_measure, default_warehouse_id, status")
      .eq("tenant_id", auth.tenant_id)
      .in("linked_product_id", ids)
      .is("deleted_at", null),
    supabaseServer
      .from("product_models")
      .select("product_id, sku, model_name")
      .in("product_id", ids)
      .order("order", { ascending: true }),
    supabaseServer
      .from("product_media")
      .select("product_id, url, type")
      .in("product_id", ids)
      .order("order", { ascending: true }),
  ]);

  const itemMap = new Map<string, ItemRow>();
  for (const it of (itemsRes.data ?? []) as ItemRow[]) {
    if (!itemMap.has(it.linked_product_id)) itemMap.set(it.linked_product_id, it);
  }
  const modelMap = new Map<string, ModelRow>();
  for (const m of (modelsRes.data ?? []) as ModelRow[]) {
    if (!modelMap.has(m.product_id)) modelMap.set(m.product_id, m);
  }
  const mediaMap = new Map<string, string>();
  for (const m of (mediaRes.data ?? []) as MediaRow[]) {
    if (!mediaMap.has(m.product_id) && m.url) mediaMap.set(m.product_id, m.url);
  }

  const enriched = prodRows.map((p) => {
    const item = itemMap.get(p.id) ?? null;
    const model = modelMap.get(p.id) ?? null;
    return {
      product_id: p.id,
      product_name: p.product_name,
      slug: p.slug,
      brand: p.brand,
      status: p.status,
      sku: model?.sku ?? null,
      model_name: model?.model_name ?? null,
      image_url: mediaMap.get(p.id) ?? null,
      stock_profile:
        item && item.status !== "archived"
          ? {
              inventory_item_id: item.id,
              item_code: item.item_code,
              unit_of_measure: item.unit_of_measure,
              default_warehouse_id: item.default_warehouse_id,
            }
          : null,
    };
  });

  const filtered = trackedOnly
    ? enriched.filter((p) => p.stock_profile !== null)
    : enriched;

  return NextResponse.json({ products: filtered });
}
