/* ===========================================================================
   Phase O.3 — Purchase Receiving Integration: shared types.

   The receipt is the bridge between an open PO and the inventory ledger.
   When a receipt flips to 'posted', the engine creates one inventory
   stock movement per accepted line; voiding the receipt reverses them.
   ========================================================================== */

export type PurchaseOrderStatus =
  | "draft"
  | "confirmed"
  | "partial"
  | "received"
  | "closed"
  | "cancelled";

export type PurchaseReceiptStatus =
  | "draft"
  | "partial"
  | "complete"
  | "cancelled"
  | "posted"
  | "voided";

export interface PurchaseOrder {
  id: string;
  tenant_id: string | null;
  po_no: string | null;
  supplier_id: string;
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_delivery_date: string | null;
  currency: string | null;
  total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  product_id: string | null;
  description: string | null;
  qty: number;
  qty_received: number;
  qty_billed: number;
  unit: string | null;
  unit_cost: number;
  line_total: number | null;
  sort_order: number | null;
}

export type ReceiveDestinationMode =
  | "warehouse"
  | "port"
  | "forwarder"
  | "in_transit"
  | "consolidation"
  | "direct_ship_to_customer"
  | "non_stock_purchase";

/** Which destination modes still produce stock movements. */
export const STOCK_MOVING_DESTINATION_MODES: ReceiveDestinationMode[] = [
  "warehouse",
  "port",
  "forwarder",
  "in_transit",
  "consolidation",
  "direct_ship_to_customer",
];

export interface PurchaseReceipt {
  id: string;
  tenant_id: string | null;
  gr_no: string | null;
  po_id: string | null;
  supplier_id: string | null;
  warehouse_id: string | null;
  status: PurchaseReceiptStatus;
  received_at: string | null;
  received_by_account_id: string | null;
  posted_at: string | null;
  posted_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  carrier: string | null;
  tracking_no: string | null;
  notes: string | null;
  destination_mode: ReceiveDestinationMode;
  destination_location_id: string | null;
  customer_id: string | null;
  shipment_reference: string | null;
  forwarder_name: string | null;
  port_name: string | null;
  expected_ship_date: string | null;
  expected_arrival_date: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PurchaseReceiptItem {
  id: string;
  tenant_id: string | null;
  receipt_id: string;
  po_item_id: string | null;
  product_id: string | null;
  description: string | null;
  qty_received: number;
  qty_accepted: number;
  qty_rejected: number;
  unit: string | null;
  unit_cost: number | null;
  currency: string;
  warehouse_id: string | null;
  inventory_movement_id: string | null;
  condition_notes: string | null;
}

/* ─── Receive request shape ──────────────────────────────────────
   Input to /api/purchase/orders/[id]/receive. Each row references a
   PO item and supplies the physical-receipt quantities. The engine
   produces a single receipt record + one line per row + one
   inventory movement per non-zero qty_accepted. */
export interface ReceiveLineInput {
  po_item_id: string;
  qty_received: number;
  qty_accepted?: number;        // defaults to qty_received
  qty_rejected?: number;        // defaults to 0
  warehouse_id?: string | null; // defaults to receipt-level WH
  condition_notes?: string | null;
}

export interface ReceiveRequest {
  /* Destination-aware routing. When omitted, defaults to 'warehouse'
     against the tenant's default warehouse for back-compat. */
  destination_mode?: ReceiveDestinationMode;
  destination_location_id?: string | null;     // pre-resolved location (any type)
  warehouse_id?: string | null;                // legacy alias of destination_location_id when mode='warehouse'
  customer_id?: string | null;                 // required for direct_ship_to_customer
  port_name?: string | null;
  forwarder_name?: string | null;
  shipment_reference?: string | null;
  expected_ship_date?: string | null;
  expected_arrival_date?: string | null;
  received_at?: string | null;
  carrier?: string | null;
  tracking_no?: string | null;
  notes?: string | null;
  lines: ReceiveLineInput[];
}

export interface ReceiveOutcome {
  ok: boolean;
  receipt_id?: string;
  receipt_no?: string | null;
  destination_mode?: ReceiveDestinationMode;
  destination_location_id?: string | null;
  movement_ids?: string[];
  affects_inventory?: boolean;
  po_status?: PurchaseOrderStatus;
  error?: string;
  code?: number;
}
