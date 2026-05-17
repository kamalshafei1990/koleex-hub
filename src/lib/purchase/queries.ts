import "server-only";

/* ===========================================================================
   Phase O.3 — Purchase queries.

   Reads only — write paths live in receiving.ts.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseReceipt,
  PurchaseReceiptItem,
} from "./types";

export async function listPurchaseOrders(tenantId: string, limit = 100): Promise<PurchaseOrder[]> {
  const { data, error } = await supabaseServer
    .from("purchase_orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 500));
  if (error) throw new Error(error.message);
  return (data ?? []) as PurchaseOrder[];
}

export interface PurchaseOrderWithLines {
  order: PurchaseOrder;
  items: PurchaseOrderItem[];
  receipts: PurchaseReceipt[];
  receipt_items: PurchaseReceiptItem[];
}

export async function getPurchaseOrderDetail(
  tenantId: string,
  poId: string,
): Promise<PurchaseOrderWithLines | null> {
  const { data: poRow, error } = await supabaseServer
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!poRow) return null;

  const [itemsRes, receiptsRes] = await Promise.all([
    supabaseServer.from("purchase_order_items").select("*").eq("po_id", poId).order("sort_order", { ascending: true }),
    supabaseServer
      .from("purchase_receipts")
      .select("*")
      .eq("po_id", poId)
      .eq("tenant_id", tenantId)
      .order("received_at", { ascending: false }),
  ]);

  const receipts = (receiptsRes.data ?? []) as PurchaseReceipt[];
  const rIds = receipts.map((r) => r.id);
  const linesRes = rIds.length
    ? await supabaseServer
        .from("purchase_receipt_items")
        .select("*")
        .in("receipt_id", rIds)
        .eq("tenant_id", tenantId)
    : { data: [] as PurchaseReceiptItem[] };

  return {
    order: poRow as PurchaseOrder,
    items: (itemsRes.data ?? []) as PurchaseOrderItem[],
    receipts,
    receipt_items: (linesRes.data ?? []) as PurchaseReceiptItem[],
  };
}
