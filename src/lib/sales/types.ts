/* ===========================================================================
   Phase O.4 — Sales Shipment shared types.

   The shipment is the bridge between an open SO and the inventory ledger.
   When a shipment flips to 'shipped', the engine creates one inventory
   OUT movement per line; voiding the shipment reverses them. Same
   pattern as Phase O.3 receiving, just outbound.
   ========================================================================== */

export type SalesOrderStatus =
  | "draft" | "confirmed" | "partial" | "shipped" | "closed" | "cancelled";

export type SalesShipmentStatus = "draft" | "shipped" | "voided";

export interface SalesOrder {
  id: string;
  tenant_id: string | null;
  so_no: string | null;
  customer_id: string | null;
  status: SalesOrderStatus;
  currency: string;
  notes: string | null;
  created_at: string;
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  inventory_item_id: string | null;
  product_id: string | null;
  description: string | null;
  qty: number;
  qty_shipped: number;
  unit_price: number;
  total: number;
}

export interface SalesShipment {
  id: string;
  tenant_id: string;
  sales_order_id: string;
  shipment_no: string;
  status: SalesShipmentStatus;
  source_location_id: string | null;
  customer_id: string | null;
  tracking_no: string | null;
  notes: string | null;
  shipped_at: string | null;
  shipped_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  /* Phase A.4 — mirrored accounting state for the queue UI. */
  accounting_status: "drafted" | "posted" | "failed" | "voided" | "pending" | null;
  accounting_entry_id: string | null;
  accounting_last_error: string | null;
  accounting_posted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesShipmentItem {
  id: string;
  tenant_id: string;
  shipment_id: string;
  sales_order_item_id: string;
  inventory_item_id: string | null;
  qty: number;
  unit: string;
  inventory_movement_id: string | null;
}

/* ─── Ship request shape ─────────────────────────────────────
   Input to /api/sales/orders/[id]/ship. Each row references a SO
   item and ships some quantity. The engine produces a single shipment
   header + one shipment line per row + one inventory OUT movement
   per non-zero qty (items that don't track stock are still recorded
   but skip the movement). */
export interface ShipLineInput {
  sales_order_item_id: string;
  qty: number;
  /** INV-H4B — required when the line's inventory item has track_serials=true. */
  serial_ids?: string[] | null;
}

export interface ShipRequest {
  source_location_id?: string | null;  // defaults to tenant default warehouse
  tracking_no?: string | null;
  notes?: string | null;
  shipped_at?: string | null;
  lines: ShipLineInput[];
}

export interface ShipOutcome {
  ok: boolean;
  shipment_id?: string;
  shipment_no?: string | null;
  movement_ids?: string[];
  so_status?: SalesOrderStatus;
  error?: string;
  code?: number;
}
