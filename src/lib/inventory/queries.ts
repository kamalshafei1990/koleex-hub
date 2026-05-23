import "server-only";

/* ===========================================================================
   Phase O.2.1 — Inventory read queries.

   All reads pivot on inventory_item_id. Products are not referenced.
   The balances snapshot joins to inventory_items (and through to
   inventory_item_types for the type badge in the UI) so the row
   carries everything the list view needs.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  BalanceWithRefs,
  ColorToken,
  IconName,
  StockBalance,
  StockMovement,
  Warehouse,
  InventoryItem,
  InventoryItemType,
  InventoryItemWithRefs,
} from "./types";

/* ─── Balances ────────────────────────────────────────────────── */

export async function buildBalancesSnapshot(opts: {
  tenantId: string;
  warehouseId?: string;
  inventoryItemId?: string;
  onlyPositive?: boolean;
}): Promise<BalanceWithRefs[]> {
  let q = supabaseServer
    .from("inventory_stock_balances")
    .select("*")
    .eq("tenant_id", opts.tenantId);
  if (opts.warehouseId) q = q.eq("warehouse_id", opts.warehouseId);
  if (opts.inventoryItemId) q = q.eq("inventory_item_id", opts.inventoryItemId);
  const { data: balances, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (balances ?? []) as StockBalance[];
  if (rows.length === 0) return [];

  const itemIds = Array.from(new Set(rows.map((r) => r.inventory_item_id)));
  const warehouseIds = Array.from(new Set(rows.map((r) => r.warehouse_id)));

  const [itemsRes, whRes] = await Promise.all([
    /* INV-H1 — pull linked_product_id so we can overlay product identity. */
    supabaseServer
      .from("inventory_items")
      .select("id, item_code, item_name, item_type_id, linked_product_id")
      .in("id", itemIds),
    supabaseServer
      .from("inventory_warehouses")
      .select("id, code, name")
      .in("id", warehouseIds),
  ]);
  const items = (itemsRes.data ?? []) as Array<{
    id: string; item_code: string; item_name: string; item_type_id: string; linked_product_id: string | null;
  }>;
  /* Look up product identity for any item that has a linked product. */
  const productIds = Array.from(new Set(items.map((i) => i.linked_product_id).filter(Boolean) as string[]));
  const [productsRes, mediaRes] = await Promise.all([
    productIds.length
      ? supabaseServer.from("products").select("id, product_name, slug").in("id", productIds)
      : Promise.resolve({ data: [] as Array<{ id: string; product_name: string; slug: string }> }),
    productIds.length
      ? supabaseServer.from("product_media").select("product_id, url, order").in("product_id", productIds).order("order", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ product_id: string; url: string | null }> }),
  ]);
  const productMap = new Map<string, { product_name: string; slug: string }>();
  for (const p of (productsRes.data ?? []) as Array<{ id: string; product_name: string; slug: string }>) {
    productMap.set(p.id, { product_name: p.product_name, slug: p.slug });
  }
  const productImageMap = new Map<string, string>();
  for (const m of (mediaRes.data ?? []) as Array<{ product_id: string; url: string | null }>) {
    if (!productImageMap.has(m.product_id) && m.url) productImageMap.set(m.product_id, m.url);
  }
  const typeIds = Array.from(new Set(items.map((i) => i.item_type_id)));
  const typesRes = typeIds.length
    ? await supabaseServer
        .from("inventory_item_types")
        .select("id, type_name, icon, color")
        .in("id", typeIds)
    : { data: [] as Array<{ id: string; type_name: string; icon: IconName; color: ColorToken }> };

  const typeMap = new Map<string, { type_name: string; icon: IconName; color: ColorToken }>();
  for (const t of (typesRes.data ?? []) as Array<{ id: string; type_name: string; icon: IconName; color: ColorToken }>) {
    typeMap.set(t.id, { type_name: t.type_name, icon: t.icon, color: t.color });
  }
  const itemMap = new Map<string, { item_code: string; item_name: string; item_type_id: string; linked_product_id: string | null }>();
  for (const i of items) itemMap.set(i.id, { item_code: i.item_code, item_name: i.item_name, item_type_id: i.item_type_id, linked_product_id: i.linked_product_id });
  const whMap = new Map<string, { code: string; name: string }>();
  for (const w of (whRes.data ?? []) as Array<{ id: string; code: string; name: string }>) {
    whMap.set(w.id, { code: w.code, name: w.name });
  }

  const enriched: BalanceWithRefs[] = rows.map((b) => {
    const item = itemMap.get(b.inventory_item_id);
    const type = item ? typeMap.get(item.item_type_id) : undefined;
    const wh = whMap.get(b.warehouse_id) ?? { code: "?", name: "Unknown" };
    const onHand = Number(b.qty_on_hand) || 0;
    const reserved = Number(b.qty_reserved) || 0;
    /* INV-H1 — Product identity takes precedence over raw item naming. */
    const linkedProduct = item?.linked_product_id ? productMap.get(item.linked_product_id) : undefined;
    return {
      ...b,
      qty_on_hand: onHand,
      qty_reserved: reserved,
      item_code: item?.item_code ?? "—",
      item_name: linkedProduct?.product_name ?? item?.item_name ?? null,
      item_type_name: type?.type_name ?? null,
      item_icon: (type?.icon ?? "box") as IconName,
      item_color: (type?.color ?? "slate") as ColorToken,
      warehouse_code: wh.code,
      warehouse_name: wh.name,
      qty_available: onHand - reserved,
      product_id: item?.linked_product_id ?? null,
      product_name: linkedProduct?.product_name ?? null,
      product_slug: linkedProduct?.slug ?? null,
      product_image_url: item?.linked_product_id ? productImageMap.get(item.linked_product_id) ?? null : null,
    };
  });

  return opts.onlyPositive
    ? enriched.filter((r) => r.qty_on_hand > 0)
    : enriched;
}

export interface SingleBalance {
  tenant_id: string;
  inventory_item_id: string;
  warehouse_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  last_movement_id: string | null;
  last_movement_at: string | null;
  exists: boolean;
}

export async function getStockBalance(
  tenantId: string,
  inventoryItemId: string,
  warehouseId: string,
): Promise<SingleBalance> {
  const { data, error } = await supabaseServer
    .from("inventory_stock_balances")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", inventoryItemId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return {
      tenant_id: tenantId,
      inventory_item_id: inventoryItemId,
      warehouse_id: warehouseId,
      qty_on_hand: 0,
      qty_reserved: 0,
      qty_available: 0,
      last_movement_id: null,
      last_movement_at: null,
      exists: false,
    };
  }
  const row = data as StockBalance;
  const onHand = Number(row.qty_on_hand) || 0;
  const reserved = Number(row.qty_reserved) || 0;
  return {
    tenant_id: row.tenant_id,
    inventory_item_id: row.inventory_item_id,
    warehouse_id: row.warehouse_id,
    qty_on_hand: onHand,
    qty_reserved: reserved,
    qty_available: onHand - reserved,
    last_movement_id: row.last_movement_id,
    last_movement_at: row.last_movement_at,
    exists: true,
  };
}

/* ─── Movement history ────────────────────────────────────── */

export async function buildMovementHistory(opts: {
  tenantId: string;
  inventoryItemId?: string;
  warehouseId?: string;
  status?: "draft" | "posted" | "voided";
  movementType?: string;
  limit?: number;
}): Promise<StockMovement[]> {
  const limit = Math.min(opts.limit ?? 200, 1000);
  let q = supabaseServer
    .from("inventory_stock_movements")
    .select("*")
    .eq("tenant_id", opts.tenantId)
    .is("deleted_at", null)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.inventoryItemId) q = q.eq("inventory_item_id", opts.inventoryItemId);
  if (opts.warehouseId) q = q.eq("warehouse_id", opts.warehouseId);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.movementType) q = q.eq("movement_type", opts.movementType);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as StockMovement[];
}

/* ─── Items list (with enrichment) ───────────────────────── */

export async function listInventoryItems(opts: {
  tenantId: string;
  search?: string;
  typeId?: string;
  status?: "active" | "inactive" | "archived";
  limit?: number;
}): Promise<InventoryItemWithRefs[]> {
  const limit = Math.min(opts.limit ?? 200, 1000);
  let q = supabaseServer
    .from("inventory_items")
    .select("*")
    .eq("tenant_id", opts.tenantId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (opts.typeId) q = q.eq("item_type_id", opts.typeId);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.search) {
    const s = opts.search.replace(/[%_]/g, "\\$&");
    q = q.or(`item_name.ilike.%${s}%,item_code.ilike.%${s}%,brand.ilike.%${s}%,sku.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const items = (data ?? []) as InventoryItem[];
  if (items.length === 0) return [];

  const typeIds = Array.from(new Set(items.map((i) => i.item_type_id)));
  const catIds = Array.from(new Set(items.map((i) => i.category_id).filter(Boolean) as string[]));
  /* INV-H1 — Pull product identity for linked items. */
  const productIds = Array.from(new Set(items.map((i) => i.linked_product_id).filter(Boolean) as string[]));
  const [typesRes, catsRes, balancesRes, valuationRes, productsRes, productMediaRes, productModelsRes] = await Promise.all([
    supabaseServer.from("inventory_item_types").select("id, type_key, type_name, icon, color").in("id", typeIds),
    catIds.length
      ? supabaseServer.from("inventory_item_categories").select("id, name").in("id", catIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    supabaseServer
      .from("inventory_stock_balances")
      .select("inventory_item_id, qty_on_hand")
      .eq("tenant_id", opts.tenantId)
      .in("inventory_item_id", items.map((i) => i.id)),
    /* Phase O.5 — fold valuation totals into the list query so the
       Items table can show Avg Cost + Stock Value without a second
       round-trip. */
    supabaseServer
      .from("inventory_valuation")
      .select("inventory_item_id, qty_on_hand, inventory_value")
      .eq("tenant_id", opts.tenantId)
      .in("inventory_item_id", items.map((i) => i.id)),
    productIds.length
      ? supabaseServer.from("products").select("id, product_name, slug").in("id", productIds)
      : Promise.resolve({ data: [] as Array<{ id: string; product_name: string; slug: string }> }),
    productIds.length
      ? supabaseServer.from("product_media").select("product_id, url, order").in("product_id", productIds).order("order", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ product_id: string; url: string | null }> }),
    productIds.length
      ? supabaseServer.from("product_models").select("product_id, sku, order").in("product_id", productIds).order("order", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ product_id: string; sku: string | null }> }),
  ]);
  const typeMap = new Map<string, { type_key: string; type_name: string; icon: IconName; color: ColorToken }>();
  for (const t of (typesRes.data ?? []) as Array<{ id: string; type_key: string; type_name: string; icon: IconName; color: ColorToken }>) {
    typeMap.set(t.id, { type_key: t.type_key, type_name: t.type_name, icon: t.icon, color: t.color });
  }
  const catMap = new Map<string, string>();
  for (const c of (catsRes.data ?? []) as Array<{ id: string; name: string }>) catMap.set(c.id, c.name);
  const balMap = new Map<string, number>();
  for (const b of (balancesRes.data ?? []) as Array<{ inventory_item_id: string; qty_on_hand: number }>) {
    balMap.set(b.inventory_item_id, (balMap.get(b.inventory_item_id) ?? 0) + Number(b.qty_on_hand || 0));
  }
  const valMap = new Map<string, { qty: number; value: number }>();
  for (const v of (valuationRes.data ?? []) as Array<{ inventory_item_id: string; qty_on_hand: number; inventory_value: number }>) {
    const cur = valMap.get(v.inventory_item_id) ?? { qty: 0, value: 0 };
    cur.qty   += Number(v.qty_on_hand)     || 0;
    cur.value += Number(v.inventory_value) || 0;
    valMap.set(v.inventory_item_id, cur);
  }

  /* Build product-identity overlays once. */
  const productMap = new Map<string, { product_name: string; slug: string }>();
  for (const p of (productsRes.data ?? []) as Array<{ id: string; product_name: string; slug: string }>) {
    productMap.set(p.id, { product_name: p.product_name, slug: p.slug });
  }
  const productImageMap = new Map<string, string>();
  for (const m of (productMediaRes.data ?? []) as Array<{ product_id: string; url: string | null }>) {
    if (!productImageMap.has(m.product_id) && m.url) productImageMap.set(m.product_id, m.url);
  }
  const productSkuMap = new Map<string, string>();
  for (const m of (productModelsRes.data ?? []) as Array<{ product_id: string; sku: string | null }>) {
    if (!productSkuMap.has(m.product_id) && m.sku) productSkuMap.set(m.product_id, m.sku);
  }

  return items.map((it) => {
    const t = typeMap.get(it.item_type_id);
    const v = valMap.get(it.id) ?? { qty: 0, value: 0 };
    const avg = v.qty > 0 ? v.value / v.qty : 0;
    const linkedProduct = it.linked_product_id ? productMap.get(it.linked_product_id) : undefined;
    return {
      ...it,
      type_key: t?.type_key ?? "other",
      type_name: t?.type_name ?? "Other",
      icon: (t?.icon ?? "box") as IconName,
      color: (t?.color ?? "slate") as ColorToken,
      category_name: it.category_id ? catMap.get(it.category_id) ?? null : null,
      qty_on_hand: balMap.get(it.id) ?? 0,
      avg_cost: avg,
      inventory_value: v.value,
      product_name: linkedProduct?.product_name ?? null,
      product_slug: linkedProduct?.slug ?? null,
      product_image_url: it.linked_product_id ? productImageMap.get(it.linked_product_id) ?? null : null,
      product_sku: it.linked_product_id ? productSkuMap.get(it.linked_product_id) ?? null : null,
    };
  });
}

/* ─── Item types (system + per-tenant custom) ────────────── */

export async function listItemTypes(tenantId: string): Promise<InventoryItemType[]> {
  /* System rows (tenant_id IS NULL) + this tenant's custom rows. */
  const { data, error } = await supabaseServer
    .from("inventory_item_types")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("type_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as InventoryItemType[];
}

export async function listWarehouses(tenantId: string): Promise<Warehouse[]> {
  const { data, error } = await supabaseServer
    .from("inventory_warehouses")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Warehouse[];
}

/* ─── Dashboard summary ──────────────────────────────────── */

export interface InventoryDashboardSummary {
  warehouse_count: number;
  item_count: number;
  total_on_hand: number;
  total_reserved: number;
  /** Phase O.5 — tenant-wide total inventory value (sum across every
   *  (item, location) bucket). */
  total_value: number;
  /** Per-currency breakdown so the dashboard can surface mixed-currency
   *  tenants honestly instead of pretending it's all USD. */
  value_by_currency: Record<string, number>;
  recent_movements: StockMovement[];
  top_balances: BalanceWithRefs[];
}

export async function buildInventoryDashboardSummary(
  tenantId: string,
): Promise<InventoryDashboardSummary> {
  const [warehouses, balances, recent, valuationRows] = await Promise.all([
    listWarehouses(tenantId),
    buildBalancesSnapshot({ tenantId }),
    buildMovementHistory({ tenantId, limit: 10 }),
    supabaseServer
      .from("inventory_valuation")
      .select("inventory_value, currency, qty_on_hand")
      .eq("tenant_id", tenantId),
  ]);

  const itemSet = new Set(balances.filter((b) => b.qty_on_hand > 0).map((b) => b.inventory_item_id));
  const totals = balances.reduce(
    (acc, b) => {
      acc.on_hand += b.qty_on_hand;
      acc.reserved += b.qty_reserved;
      return acc;
    },
    { on_hand: 0, reserved: 0 },
  );

  const topBalances = balances
    .slice()
    .sort((a, b) => b.qty_on_hand - a.qty_on_hand)
    .slice(0, 8);

  let totalValue = 0;
  const byCurrency: Record<string, number> = {};
  for (const v of (valuationRows.data ?? []) as Array<{ inventory_value: number; currency: string; qty_on_hand: number }>) {
    const value = Number(v.inventory_value) || 0;
    totalValue += value;
    const c = v.currency || "USD";
    byCurrency[c] = (byCurrency[c] ?? 0) + value;
  }

  return {
    warehouse_count: warehouses.filter((w) => w.is_active).length,
    item_count: itemSet.size,
    total_on_hand: totals.on_hand,
    total_reserved: totals.reserved,
    total_value: totalValue,
    value_by_currency: byCurrency,
    recent_movements: recent,
    top_balances: topBalances,
  };
}

/* ─── Per-item stock summary ─────────────────────────────── */

export interface ItemStockSummary {
  inventory_item_id: string;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  warehouses: Array<{
    warehouse_id: string;
    warehouse_code: string;
    warehouse_name: string;
    qty_on_hand: number;
    qty_reserved: number;
    qty_available: number;
  }>;
}

export async function getItemStockSummary(
  tenantId: string,
  inventoryItemId: string,
): Promise<ItemStockSummary> {
  const balances = await buildBalancesSnapshot({ tenantId, inventoryItemId });
  const totals = balances.reduce(
    (acc, b) => {
      acc.on_hand += b.qty_on_hand;
      acc.reserved += b.qty_reserved;
      return acc;
    },
    { on_hand: 0, reserved: 0 },
  );
  return {
    inventory_item_id: inventoryItemId,
    total_on_hand: totals.on_hand,
    total_reserved: totals.reserved,
    total_available: totals.on_hand - totals.reserved,
    warehouses: balances.map((b) => ({
      warehouse_id: b.warehouse_id,
      warehouse_code: b.warehouse_code,
      warehouse_name: b.warehouse_name,
      qty_on_hand: b.qty_on_hand,
      qty_reserved: b.qty_reserved,
      qty_available: b.qty_available,
    })),
  };
}
