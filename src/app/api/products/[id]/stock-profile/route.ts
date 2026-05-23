import "server-only";

/* ===========================================================================
   /api/products/[id]/stock-profile

   INV-H1 Scope 2 — Product owns the stock profile lifecycle.

   GET    Return the linked inventory_item (the "Stock Profile") for this
          product, plus any per-warehouse stock totals. 404 if no
          profile exists.
   PUT    Upsert the stock profile. Body:
            { track_stock: boolean,
              unit_of_measure?, default_warehouse_id?,
              cost_price?, currency?,
              reorder_point?, min_stock?, max_stock? }
          If track_stock=true and no profile exists, the server creates
          one via fn_inventory_ensure_item_for_product, then patches the
          stock fields. If track_stock=false and a profile exists with
          NO posted movements, the profile is archived. If movements
          exist the profile stays active (history is preserved).
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import {
  ensureInventoryItemForProduct,
  updateInventoryItem,
  archiveInventoryItem,
} from "@/lib/inventory/items";
import { getItemStockSummary } from "@/lib/inventory/queries";

const MODULE = "Inventory";

interface StockProfileBody {
  track_stock?: boolean;
  /** INV-H4B — toggle per-unit serial tracking. */
  track_serials?: boolean;
  unit_of_measure?: string;
  default_warehouse_id?: string | null;
  cost_price?: number | null;
  currency?: string | null;
  reorder_point?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
}

async function loadProfile(tenantId: string, productId: string) {
  const { data } = await supabaseServer
    .from("inventory_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("linked_product_id", productId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const profile = await loadProfile(auth.tenant_id, id);
  if (!profile) {
    return NextResponse.json({ profile: null, stock: null });
  }
  const stock = await getItemStockSummary(auth.tenant_id, profile.id as string);
  return NextResponse.json({ profile, stock });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as StockProfileBody;

  /* Verify the product exists (global catalog, no tenant_id). */
  const { data: product } = await supabaseServer
    .from("products")
    .select("id, product_name")
    .eq("id", id)
    .maybeSingle();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const existing = await loadProfile(auth.tenant_id, id);

  if (body.track_stock === false) {
    /* Turning OFF: if a profile exists and has no posted movements,
       archive it. Otherwise leave history intact and just clear the
       flag on the row. */
    if (!existing) return NextResponse.json({ profile: null });
    const itemId = existing.id as string;
    const { count } = await supabaseServer
      .from("inventory_stock_movements")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", auth.tenant_id)
      .eq("inventory_item_id", itemId)
      .neq("status", "voided");
    if ((count ?? 0) === 0) {
      const r = await archiveInventoryItem(auth.tenant_id, itemId);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
      return NextResponse.json({ profile: null, archived: true });
    }
    /* History exists — mark inactive but don't archive. */
    const r = await updateInventoryItem(auth.tenant_id, itemId, { status: "inactive", track_stock: false });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    return NextResponse.json({ profile: r.item, history_preserved: true });
  }

  /* Turning ON (or update). Ensure profile exists, then patch fields. */
  let itemId: string;
  if (existing) {
    itemId = existing.id as string;
  } else {
    itemId = await ensureInventoryItemForProduct(auth.tenant_id, id);
  }

  const patch: Record<string, unknown> = { track_stock: true, status: "active" };
  if (body.unit_of_measure) patch.unit_of_measure = body.unit_of_measure;
  if (body.default_warehouse_id !== undefined) patch.default_warehouse_id = body.default_warehouse_id;
  if (body.cost_price !== undefined) patch.cost_price = body.cost_price;
  if (body.currency) patch.currency = body.currency;
  if (body.reorder_point !== undefined) patch.reorder_point = body.reorder_point;
  if (body.min_stock !== undefined) patch.min_stock = body.min_stock;
  if (body.max_stock !== undefined) patch.max_stock = body.max_stock;
  if (body.track_serials !== undefined) patch.track_serials = body.track_serials;

  const r = await updateInventoryItem(auth.tenant_id, itemId, patch);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ profile: r.item });
}
