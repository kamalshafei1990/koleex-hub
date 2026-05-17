import "server-only";

/* ===========================================================================
   Phase O.5 — Inventory Valuation reads.

   The valuation table is populated atomically by fn_inventory_post_movement.
   This module exposes read shapes for the UI and a defensive rebuild
   helper for the validator (and future repair flows).

   buildValuationSnapshot()         per-(item, location) rows enriched
                                     with item + location refs.
   getItemValuationSummary()        per-item summary across locations.
   rebuildValuationForItem()        replays posted+voided history for one
                                     (item, location) and returns the
                                     reconciled state. Used by the
                                     validator to prove valuation equals
                                     movement history.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ColorToken, IconName } from "./types";

export interface ValuationRow {
  id: string;
  tenant_id: string;
  inventory_item_id: string;
  warehouse_id: string;
  qty_on_hand: number;
  average_cost: number;
  inventory_value: number;
  currency: string;
  last_movement_id: string | null;
  last_in_cost: number | null;
  updated_at: string;
}

export interface ValuationRowWithRefs extends ValuationRow {
  item_code: string;
  item_name: string | null;
  item_type_name: string | null;
  item_icon: IconName;
  item_color: ColorToken;
  warehouse_code: string;
  warehouse_name: string;
  location_type: string;
}

/* ─── Snapshot — used by /api/inventory/valuation ────────────── */

export async function buildValuationSnapshot(opts: {
  tenantId: string;
  warehouseId?: string;
  inventoryItemId?: string;
  onlyPositive?: boolean;
}): Promise<ValuationRowWithRefs[]> {
  let q = supabaseServer
    .from("inventory_valuation")
    .select("*")
    .eq("tenant_id", opts.tenantId);
  if (opts.warehouseId) q = q.eq("warehouse_id", opts.warehouseId);
  if (opts.inventoryItemId) q = q.eq("inventory_item_id", opts.inventoryItemId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ValuationRow[];
  if (rows.length === 0) return [];

  const itemIds = Array.from(new Set(rows.map((r) => r.inventory_item_id)));
  const whIds = Array.from(new Set(rows.map((r) => r.warehouse_id)));

  const [itemsRes, whRes] = await Promise.all([
    supabaseServer
      .from("inventory_items")
      .select("id, item_code, item_name, item_type_id")
      .in("id", itemIds),
    supabaseServer
      .from("inventory_warehouses")
      .select("id, code, name, location_type")
      .in("id", whIds),
  ]);
  const items = (itemsRes.data ?? []) as Array<{ id: string; item_code: string; item_name: string; item_type_id: string }>;
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
  const itemMap = new Map<string, { item_code: string; item_name: string; item_type_id: string }>();
  for (const it of items) itemMap.set(it.id, { item_code: it.item_code, item_name: it.item_name, item_type_id: it.item_type_id });
  const whMap = new Map<string, { code: string; name: string; location_type: string }>();
  for (const w of (whRes.data ?? []) as Array<{ id: string; code: string; name: string; location_type: string }>) {
    whMap.set(w.id, { code: w.code, name: w.name, location_type: w.location_type });
  }

  const out: ValuationRowWithRefs[] = rows.map((r) => {
    const it = itemMap.get(r.inventory_item_id);
    const type = it ? typeMap.get(it.item_type_id) : undefined;
    const wh = whMap.get(r.warehouse_id) ?? { code: "?", name: "Unknown", location_type: "warehouse" };
    return {
      ...r,
      qty_on_hand: Number(r.qty_on_hand) || 0,
      average_cost: Number(r.average_cost) || 0,
      inventory_value: Number(r.inventory_value) || 0,
      item_code: it?.item_code ?? "—",
      item_name: it?.item_name ?? null,
      item_type_name: type?.type_name ?? null,
      item_icon: (type?.icon ?? "box") as IconName,
      item_color: (type?.color ?? "slate") as ColorToken,
      warehouse_code: wh.code,
      warehouse_name: wh.name,
      location_type: wh.location_type,
    };
  });
  return opts.onlyPositive ? out.filter((r) => r.qty_on_hand > 0) : out;
}

/* ─── Per-item summary across warehouses ─────────────────── */

export interface ItemValuationLocation {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  location_type: string;
  qty_on_hand: number;
  average_cost: number;
  inventory_value: number;
  last_in_cost: number | null;
}

export interface ItemValuationSummary {
  inventory_item_id: string;
  total_qty: number;
  total_value: number;
  /** Weighted average cost across all locations. */
  weighted_avg_cost: number;
  /** Last incoming cost across any location (the most recent IN that
   *  carried a cost, used as a quick "current market" indicator). */
  last_in_cost: number | null;
  currency: string;
  locations: ItemValuationLocation[];
  recent_movements: Array<{
    id: string;
    movement_no: string;
    movement_date: string;
    movement_type: string;
    direction: "in" | "out";
    quantity: number;
    unit_cost: number | null;
    total_cost: number | null;
    status: string;
    posted_at: string | null;
  }>;
}

export async function getItemValuationSummary(
  tenantId: string,
  inventoryItemId: string,
): Promise<ItemValuationSummary> {
  const rows = await buildValuationSnapshot({ tenantId, inventoryItemId });

  let totalQty = 0;
  let totalValue = 0;
  let lastInCost: number | null = null;
  let currency = "USD";
  const locations: ItemValuationLocation[] = rows.map((r) => {
    totalQty += r.qty_on_hand;
    totalValue += r.inventory_value;
    if (r.last_in_cost != null) lastInCost = r.last_in_cost;
    currency = r.currency || currency;
    return {
      warehouse_id: r.warehouse_id,
      warehouse_code: r.warehouse_code,
      warehouse_name: r.warehouse_name,
      location_type: r.location_type,
      qty_on_hand: r.qty_on_hand,
      average_cost: r.average_cost,
      inventory_value: r.inventory_value,
      last_in_cost: r.last_in_cost,
    };
  });
  const weighted = totalQty > 0 ? totalValue / totalQty : 0;

  /* Recent cost-relevant history for the side panel. */
  const { data: movements } = await supabaseServer
    .from("inventory_stock_movements")
    .select("id, movement_no, movement_date, movement_type, direction, quantity, unit_cost, total_cost, status, posted_at")
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", inventoryItemId)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    inventory_item_id: inventoryItemId,
    total_qty: totalQty,
    total_value: totalValue,
    weighted_avg_cost: weighted,
    last_in_cost: lastInCost,
    currency,
    locations,
    recent_movements: (movements ?? []) as ItemValuationSummary["recent_movements"],
  };
}

/* ─── Tenant-wide totals (for the dashboard KPI) ─────────── */

export interface ValuationTotals {
  total_value: number;
  total_items: number;
  total_lots: number;        // distinct (item, location) buckets
  by_currency: Record<string, number>;
  /** Top eight (item, location) buckets by value. */
  top_holders: ValuationRowWithRefs[];
}

export async function getTenantValuationTotals(tenantId: string): Promise<ValuationTotals> {
  const rows = await buildValuationSnapshot({ tenantId, onlyPositive: true });
  let totalValue = 0;
  const items = new Set<string>();
  const byCurrency: Record<string, number> = {};
  for (const r of rows) {
    totalValue += r.inventory_value;
    items.add(r.inventory_item_id);
    byCurrency[r.currency] = (byCurrency[r.currency] ?? 0) + r.inventory_value;
  }
  const top = rows.slice().sort((a, b) => b.inventory_value - a.inventory_value).slice(0, 8);
  return {
    total_value: totalValue,
    total_items: items.size,
    total_lots: rows.length,
    by_currency: byCurrency,
    top_holders: top,
  };
}

/* ─── Rebuild — replays posted + voided history through WAC ─
   Returns the canonical (qty, avg, value) so the caller can compare
   it to the stored valuation row. NOT writeable; pure read. */

export async function rebuildValuationForItem(
  tenantId: string,
  inventoryItemId: string,
  warehouseId: string,
): Promise<{ qty: number; avg: number; value: number; events: number }> {
  const { data: movements, error } = await supabaseServer
    .from("inventory_stock_movements")
    .select("direction, quantity, unit_cost, status, created_at")
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", inventoryItemId)
    .eq("warehouse_id", warehouseId)
    .in("status", ["posted", "voided"])
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  let qty = 0;
  let avg = 0;
  let count = 0;
  for (const m of (movements ?? []) as Array<{ direction: "in" | "out"; quantity: number; unit_cost: number | null; status: string }>) {
    const q = Number(m.quantity) || 0;
    const c = m.unit_cost != null ? Number(m.unit_cost) : null;
    if (m.direction === "in") {
      const newQty = qty + q;
      if (c != null && newQty > 0) {
        avg = (qty * avg + q * c) / newQty;
      }
      /* If no unit_cost, avg stays. */
      qty = newQty;
    } else {
      qty = Math.max(0, qty - q);
      /* OUT doesn't change avg under WAC. */
    }
    count += 1;
  }
  const value = qty * avg;
  return { qty, avg, value, events: count };
}
