import "server-only";

/* ===========================================================================
   Phase O.4 — Sales reads.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  SalesOrder,
  SalesOrderItem,
  SalesShipment,
  SalesShipmentItem,
} from "./types";

export async function listSalesOrders(tenantId: string, limit = 100): Promise<SalesOrder[]> {
  const { data, error } = await supabaseServer
    .from("sales_orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 500));
  if (error) throw new Error(error.message);
  return (data ?? []) as SalesOrder[];
}

export interface SalesOrderDetail {
  order: SalesOrder;
  items: SalesOrderItem[];
  shipments: SalesShipment[];
  shipment_items: SalesShipmentItem[];
}

export async function getSalesOrderDetail(tenantId: string, soId: string): Promise<SalesOrderDetail | null> {
  const { data: row, error } = await supabaseServer
    .from("sales_orders")
    .select("*")
    .eq("id", soId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;

  const [itemsRes, shipRes] = await Promise.all([
    supabaseServer.from("sales_order_items").select("*").eq("sales_order_id", soId),
    supabaseServer
      .from("sales_shipments")
      .select("*")
      .eq("sales_order_id", soId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);
  const shipments = (shipRes.data ?? []) as SalesShipment[];
  const sIds = shipments.map((s) => s.id);
  const linesRes = sIds.length
    ? await supabaseServer
        .from("sales_shipment_items")
        .select("*")
        .in("shipment_id", sIds)
        .eq("tenant_id", tenantId)
    : { data: [] as SalesShipmentItem[] };

  return {
    order: row as SalesOrder,
    items: (itemsRes.data ?? []) as SalesOrderItem[],
    shipments,
    shipment_items: (linesRes.data ?? []) as SalesShipmentItem[],
  };
}
