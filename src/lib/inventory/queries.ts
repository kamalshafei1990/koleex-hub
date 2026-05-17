import "server-only";

/* ===========================================================================
   Phase O.2 — Inventory read queries.

   Three shapes the UI cares about:

     buildBalancesSnapshot()    a list of stock balances enriched with
                                 product + warehouse labels and computed
                                 qty_available. The Stock Balances page.

     buildMovementHistory()     paged movement ledger for a tenant,
                                 optionally filtered by product / warehouse.

     getProductStockSummary()   aggregated on-hand across warehouses for
                                 a single product. Used by the product
                                 detail panel.

   No write functions in this module — write paths live in posting.ts.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  BalanceWithRefs,
  StockBalance,
  StockMovement,
  Warehouse,
} from "./types";

/* ─── Balances ────────────────────────────────────────────────── */

export async function buildBalancesSnapshot(opts: {
  tenantId: string;
  warehouseId?: string;
  productId?: string;
  onlyPositive?: boolean;
}): Promise<BalanceWithRefs[]> {
  let q = supabaseServer
    .from("inventory_stock_balances")
    .select("*")
    .eq("tenant_id", opts.tenantId);
  if (opts.warehouseId) q = q.eq("warehouse_id", opts.warehouseId);
  if (opts.productId) q = q.eq("product_id", opts.productId);
  const { data: balances, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (balances ?? []) as StockBalance[];
  if (rows.length === 0) return [];

  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  const warehouseIds = Array.from(new Set(rows.map((r) => r.warehouse_id)));

  const [prodRes, whRes] = await Promise.all([
    supabaseServer.from("products").select("id, product_name").in("id", productIds),
    supabaseServer.from("inventory_warehouses").select("id, code, name").in("id", warehouseIds),
  ]);

  const prodMap = new Map<string, string | null>();
  for (const p of (prodRes.data ?? []) as Array<{ id: string; product_name: string | null }>) {
    prodMap.set(p.id, p.product_name);
  }
  const whMap = new Map<string, { code: string; name: string }>();
  for (const w of (whRes.data ?? []) as Array<{ id: string; code: string; name: string }>) {
    whMap.set(w.id, { code: w.code, name: w.name });
  }

  const enriched: BalanceWithRefs[] = rows.map((b) => {
    const wh = whMap.get(b.warehouse_id) ?? { code: "?", name: "Unknown" };
    const onHand = Number(b.qty_on_hand) || 0;
    const reserved = Number(b.qty_reserved) || 0;
    return {
      ...b,
      qty_on_hand: onHand,
      qty_reserved: reserved,
      product_name: prodMap.get(b.product_id) ?? null,
      warehouse_code: wh.code,
      warehouse_name: wh.name,
      qty_available: onHand - reserved,
    };
  });

  return opts.onlyPositive
    ? enriched.filter((r) => r.qty_on_hand > 0)
    : enriched;
}

/* ─── Movement history ─────────────────────────────────────── */

export async function buildMovementHistory(opts: {
  tenantId: string;
  productId?: string;
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
  if (opts.productId) q = q.eq("product_id", opts.productId);
  if (opts.warehouseId) q = q.eq("warehouse_id", opts.warehouseId);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.movementType) q = q.eq("movement_type", opts.movementType);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as StockMovement[];
}

/* ─── Per-product summary ─────────────────────────────────── */

export interface ProductStockSummary {
  product_id: string;
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

export async function getProductStockSummary(
  tenantId: string,
  productId: string,
): Promise<ProductStockSummary> {
  const balances = await buildBalancesSnapshot({ tenantId, productId });
  const totals = balances.reduce(
    (acc, b) => {
      acc.on_hand += b.qty_on_hand;
      acc.reserved += b.qty_reserved;
      return acc;
    },
    { on_hand: 0, reserved: 0 },
  );
  return {
    product_id: productId,
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

/* ─── Warehouses ──────────────────────────────────────────── */

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

/* ─── Dashboard summary ───────────────────────────────────── */

export interface InventoryDashboardSummary {
  warehouse_count: number;
  product_count: number;
  total_on_hand: number;
  total_reserved: number;
  recent_movements: StockMovement[];
  top_balances: BalanceWithRefs[];
}

export async function buildInventoryDashboardSummary(
  tenantId: string,
): Promise<InventoryDashboardSummary> {
  const [warehouses, balances, recent] = await Promise.all([
    listWarehouses(tenantId),
    buildBalancesSnapshot({ tenantId }),
    buildMovementHistory({ tenantId, limit: 10 }),
  ]);

  const productSet = new Set(balances.filter((b) => b.qty_on_hand > 0).map((b) => b.product_id));
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

  return {
    warehouse_count: warehouses.filter((w) => w.is_active).length,
    product_count: productSet.size,
    total_on_hand: totals.on_hand,
    total_reserved: totals.reserved,
    recent_movements: recent,
    top_balances: topBalances,
  };
}
