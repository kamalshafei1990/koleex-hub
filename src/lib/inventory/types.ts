/* ===========================================================================
   Phase O.2 — Inventory Movement Core: shared types.

   The inventory module sits ALONGSIDE the accounting module: both are
   append-only ledgers whose derived state (balance sheet for accounting,
   on-hand for inventory) is rebuildable from the journal alone. The
   API mirrors that shape on purpose — drafts are editable, posted rows
   are immutable, voids are reversing entries that never mutate the
   original.

   No valuation, no FIFO, no COGS, no reservations engine in this phase.
   `unit_cost` is captured so a later accounting integration phase can
   read it without a migration.
   ========================================================================== */

export type MovementType =
  | "opening_balance"
  | "purchase_receipt"
  | "sales_shipment"
  | "adjustment_in"
  | "adjustment_out"
  | "transfer_in"
  | "transfer_out"
  | "return_in"
  | "return_out"
  | "manual";

export type Direction = "in" | "out";
export type MovementStatus = "draft" | "posted" | "voided";

export interface Warehouse {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  location: string | null;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface StockMovement {
  id: string;
  tenant_id: string;
  movement_no: string;
  movement_date: string;            // YYYY-MM-DD
  product_id: string;
  warehouse_id: string;
  movement_type: MovementType;
  direction: Direction;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  currency: string;
  source_type: string | null;
  source_id: string | null;
  related_movement_id: string | null;
  reference: string | null;
  notes: string | null;
  status: MovementStatus;
  posted_by: string | null;
  posted_at: string | null;
  voided_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  reverses_movement_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface StockBalance {
  id: string;
  tenant_id: string;
  product_id: string;
  warehouse_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  last_movement_id: string | null;
  last_movement_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Convenience shape for the UI: a balance row joined with the
 *  product's display name + sku-ish identifiers and the warehouse
 *  label. The API enriches balances on the way out. */
export interface BalanceWithRefs extends StockBalance {
  product_name: string | null;
  warehouse_code: string;
  warehouse_name: string;
  qty_available: number;            // on_hand - reserved
}

/** Direction defaults derived from movement_type. Centralised so
 *  the API, the validator, and the UI all agree. The user MAY
 *  override it (e.g. a `manual` movement can be either direction)
 *  but for typed flows we fill it in. */
export function directionForType(type: MovementType): Direction | null {
  switch (type) {
    case "opening_balance":
    case "purchase_receipt":
    case "adjustment_in":
    case "transfer_in":
    case "return_in":
      return "in";
    case "sales_shipment":
    case "adjustment_out":
    case "transfer_out":
    case "return_out":
      return "out";
    case "manual":
      return null;                  // caller must supply
  }
}

export interface CreateMovementInput {
  tenant_id: string;
  product_id: string;
  warehouse_id?: string | null;     // defaults to the tenant's default WH
  movement_type: MovementType;
  direction?: Direction;            // required for `manual`
  quantity: number;
  unit?: string;
  unit_cost?: number | null;
  currency?: string;
  source_type?: string | null;
  source_id?: string | null;
  reference?: string | null;
  notes?: string | null;
  movement_date?: string;           // defaults to today
  created_by?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PostMovementResult {
  ok: boolean;
  movement_id?: string;
  already_posted?: boolean;
  qty_before?: number;
  qty_after?: number;
  error?: string;
  code?: number;
}

export interface VoidMovementResult {
  ok: boolean;
  movement_id?: string;
  reverse_movement_id?: string;
  already_voided?: boolean;
  error?: string;
  code?: number;
}
