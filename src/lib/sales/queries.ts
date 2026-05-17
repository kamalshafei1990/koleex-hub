import "server-only";

/* ===========================================================================
   Phase O.4 / O.4.1 — Sales reads.

   Two enriched shapes:

     listSalesOrders()       SO list joined with the customer name and
                              aggregated qty totals (ordered / shipped /
                              remaining) so the table can render
                              everything in one round-trip.

     getSalesOrderDetail()   header + items + shipments + shipment items
                              + customer name + location dictionary +
                              per-item live stock totals (from
                              inventory_stock_balances). The UI needs
                              available stock per line; we ship that
                              alongside the rest so the detail page
                              doesn't have to fan out.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  SalesOrder,
  SalesOrderItem,
  SalesShipment,
  SalesShipmentItem,
} from "./types";

export interface SalesOrderListRow extends SalesOrder {
  customer_name: string | null;
  qty_ordered: number;
  qty_shipped: number;
  qty_remaining: number;
  line_count: number;
}

export interface SalesOrderListOptions {
  search?: string;
  status?: string;
  /** Created since this date (YYYY-MM-DD), inclusive. */
  since?: string;
  limit?: number;
}

export async function listSalesOrders(
  tenantId: string,
  opts: SalesOrderListOptions = {},
): Promise<SalesOrderListRow[]> {
  const limit = Math.min(opts.limit ?? 100, 500);

  /* Build the base query. We deliberately don't push the search term
     to the DB: SO number and customer name (after join) both need to
     match, and PostgREST can't OR across a joined column with a free
     ILIKE in one call. Instead we fetch a slightly wider window and
     filter in memory — row volumes are small. */
  let q = supabaseServer
    .from("sales_orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(opts.search ? Math.max(limit, 500) : limit);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.since)  q = q.gte("created_at", opts.since);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SalesOrder[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[]));

  const [itemsRes, customersRes] = await Promise.all([
    supabaseServer
      .from("sales_order_items")
      .select("sales_order_id, qty, qty_shipped")
      .in("sales_order_id", ids),
    customerIds.length
      ? supabaseServer.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const totals = new Map<string, { ordered: number; shipped: number; count: number }>();
  for (const it of (itemsRes.data ?? []) as Array<{ sales_order_id: string; qty: number; qty_shipped: number }>) {
    const cur = totals.get(it.sales_order_id) ?? { ordered: 0, shipped: 0, count: 0 };
    cur.ordered += Number(it.qty) || 0;
    cur.shipped += Number(it.qty_shipped) || 0;
    cur.count   += 1;
    totals.set(it.sales_order_id, cur);
  }

  const customerMap = new Map<string, string>();
  for (const c of (customersRes.data ?? []) as Array<{ id: string; name: string }>) {
    customerMap.set(c.id, c.name);
  }

  const enriched: SalesOrderListRow[] = rows.map((r) => {
    const t = totals.get(r.id) ?? { ordered: 0, shipped: 0, count: 0 };
    return {
      ...r,
      customer_name: r.customer_id ? customerMap.get(r.customer_id) ?? null : null,
      qty_ordered: t.ordered,
      qty_shipped: t.shipped,
      qty_remaining: Math.max(0, t.ordered - t.shipped),
      line_count: t.count,
    };
  });

  /* Post-filter on SO number OR customer name. Cap to the requested
     limit again so the caller never receives more than they asked for. */
  if (opts.search) {
    const s = opts.search.toLowerCase();
    return enriched
      .filter((r) =>
        (r.so_no ?? "").toLowerCase().includes(s) ||
        (r.customer_name ?? "").toLowerCase().includes(s),
      )
      .slice(0, limit);
  }
  return enriched;
}

/* ─── Detail ──────────────────────────────────────────────── */

export interface SalesOrderItemWithStock extends SalesOrderItem {
  total_on_hand: number;
  available_locations: Array<{
    warehouse_id: string;
    warehouse_code: string;
    warehouse_name: string;
    location_type: string;
    qty_on_hand: number;
  }>;
}

export interface SalesOrderDetail {
  order: SalesOrder & {
    customer_name: string | null;
    qty_ordered: number;
    qty_shipped: number;
    qty_remaining: number;
  };
  items: SalesOrderItemWithStock[];
  shipments: Array<SalesShipment & { source_location_code: string | null; source_location_name: string | null; line_count: number; total_qty: number }>;
  shipment_items: SalesShipmentItem[];
}

export async function getSalesOrderDetail(
  tenantId: string,
  soId: string,
): Promise<SalesOrderDetail | null> {
  const { data: row, error } = await supabaseServer
    .from("sales_orders")
    .select("*")
    .eq("id", soId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;
  const so = row as SalesOrder;

  const [itemsRes, shipRes, customerRes] = await Promise.all([
    supabaseServer
      .from("sales_order_items")
      .select("*")
      .eq("sales_order_id", soId),
    supabaseServer
      .from("sales_shipments")
      .select("*")
      .eq("sales_order_id", soId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    so.customer_id
      ? supabaseServer.from("customers").select("id, name").eq("id", so.customer_id).maybeSingle()
      : Promise.resolve({ data: null as { id: string; name: string } | null }),
  ]);
  const items = (itemsRes.data ?? []) as SalesOrderItem[];
  const shipments = (shipRes.data ?? []) as SalesShipment[];

  /* Shipment lines for the history table. */
  const sIds = shipments.map((s) => s.id);
  const linesRes = sIds.length
    ? await supabaseServer
        .from("sales_shipment_items")
        .select("*")
        .in("shipment_id", sIds)
        .eq("tenant_id", tenantId)
    : { data: [] as SalesShipmentItem[] };
  const shipLines = (linesRes.data ?? []) as SalesShipmentItem[];

  /* Build a per-shipment summary (line count + total qty + source
     location code/name). */
  const sourceIds = Array.from(new Set(shipments.map((s) => s.source_location_id).filter(Boolean) as string[]));
  const whRes = sourceIds.length
    ? await supabaseServer.from("inventory_warehouses").select("id, code, name").in("id", sourceIds)
    : { data: [] as Array<{ id: string; code: string; name: string }> };
  const whMap = new Map<string, { code: string; name: string }>();
  for (const w of (whRes.data ?? [])) whMap.set(w.id, { code: w.code, name: w.name });
  const shipSummary = new Map<string, { count: number; qty: number }>();
  for (const sl of shipLines) {
    const cur = shipSummary.get(sl.shipment_id) ?? { count: 0, qty: 0 };
    cur.count += 1;
    cur.qty   += Number(sl.qty) || 0;
    shipSummary.set(sl.shipment_id, cur);
  }
  const shipmentsEnriched = shipments.map((s) => {
    const wh = s.source_location_id ? whMap.get(s.source_location_id) : null;
    const sum = shipSummary.get(s.id) ?? { count: 0, qty: 0 };
    return {
      ...s,
      source_location_code: wh?.code ?? null,
      source_location_name: wh?.name ?? null,
      line_count: sum.count,
      total_qty: sum.qty,
    };
  });

  /* Per-item live stock — collect inventory_item_ids across SO lines and
     fetch their balances + location refs in one go. */
  const inventoryItemIds = Array.from(new Set(items.map((it) => it.inventory_item_id).filter(Boolean) as string[]));
  const balancesRes = inventoryItemIds.length
    ? await supabaseServer
        .from("inventory_stock_balances")
        .select("inventory_item_id, warehouse_id, qty_on_hand")
        .eq("tenant_id", tenantId)
        .in("inventory_item_id", inventoryItemIds)
    : { data: [] as Array<{ inventory_item_id: string; warehouse_id: string; qty_on_hand: number }> };
  const allWhIds = Array.from(new Set((balancesRes.data ?? []).map((b) => b.warehouse_id)));
  const stockWhRes = allWhIds.length
    ? await supabaseServer
        .from("inventory_warehouses")
        .select("id, code, name, location_type")
        .in("id", allWhIds)
    : { data: [] as Array<{ id: string; code: string; name: string; location_type: string }> };
  const stockWhMap = new Map<string, { code: string; name: string; location_type: string }>();
  for (const w of (stockWhRes.data ?? [])) stockWhMap.set(w.id, { code: w.code, name: w.name, location_type: w.location_type });
  const stockByItem = new Map<string, Array<{ warehouse_id: string; qty_on_hand: number }>>();
  for (const b of (balancesRes.data ?? []) as Array<{ inventory_item_id: string; warehouse_id: string; qty_on_hand: number }>) {
    const arr = stockByItem.get(b.inventory_item_id) ?? [];
    arr.push({ warehouse_id: b.warehouse_id, qty_on_hand: Number(b.qty_on_hand) || 0 });
    stockByItem.set(b.inventory_item_id, arr);
  }

  const itemsEnriched: SalesOrderItemWithStock[] = items.map((it) => {
    const buckets = it.inventory_item_id ? stockByItem.get(it.inventory_item_id) ?? [] : [];
    const sorted = buckets.slice().sort((a, b) => b.qty_on_hand - a.qty_on_hand);
    const totalOnHand = sorted.reduce((acc, b) => acc + b.qty_on_hand, 0);
    return {
      ...it,
      total_on_hand: totalOnHand,
      available_locations: sorted.map((b) => {
        const w = stockWhMap.get(b.warehouse_id) ?? { code: "?", name: "Unknown", location_type: "warehouse" };
        return {
          warehouse_id: b.warehouse_id,
          warehouse_code: w.code,
          warehouse_name: w.name,
          location_type: w.location_type,
          qty_on_hand: b.qty_on_hand,
        };
      }),
    };
  });

  const totals = items.reduce(
    (acc, it) => {
      acc.ordered += Number(it.qty) || 0;
      acc.shipped += Number(it.qty_shipped) || 0;
      return acc;
    },
    { ordered: 0, shipped: 0 },
  );

  return {
    order: {
      ...so,
      customer_name:
        so.customer_id
          ? ((customerRes as { data: { name: string } | null }).data?.name ?? null)
          : null,
      qty_ordered: totals.ordered,
      qty_shipped: totals.shipped,
      qty_remaining: Math.max(0, totals.ordered - totals.shipped),
    },
    items: itemsEnriched,
    shipments: shipmentsEnriched,
    shipment_items: shipLines,
  };
}
