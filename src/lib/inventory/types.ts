/* ===========================================================================
   Phase O.2.1 — Universal Inventory shared types.

   The inventory module now owns its own master record (inventory_items)
   and is fully independent of the Product catalog. Products may
   optionally link in via inventory_items.linked_product_id, but the
   inventory ledger speaks only `inventory_item_id`.
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

export type IconName =
  | "box" | "package" | "machine" | "cog" | "wrench" | "tool" | "tag" | "label"
  | "file" | "book" | "screen" | "monitor" | "truck" | "pallet" | "warehouse"
  | "sample" | "warning" | "recycle" | "office" | "gift" | "star" | "cube"
  | "layers" | "cable" | "motor" | "shield" | "other";

export type ColorToken =
  | "gray" | "blue" | "cyan" | "teal" | "green" | "amber" | "orange"
  | "red"  | "rose" | "purple" | "violet" | "slate";

export type ItemStatus = "active" | "inactive" | "archived";

export type UnitOfMeasure =
  | "pcs" | "set" | "pair" | "box" | "carton" | "pallet" | "roll" | "sheet"
  | "meter" | "cm" | "mm" | "kg" | "gram" | "liter" | "ml" | "bag"
  | "bottle" | "pack" | "bundle" | "coil" | "container" | "unit";

export const ALLOWED_UNITS: UnitOfMeasure[] = [
  "pcs", "set", "pair", "box", "carton", "pallet", "roll", "sheet",
  "meter", "cm", "mm", "kg", "gram", "liter", "ml", "bag",
  "bottle", "pack", "bundle", "coil", "container", "unit",
];

export const ALLOWED_ICONS: IconName[] = [
  "box","package","machine","cog","wrench","tool","tag","label",
  "file","book","screen","monitor","truck","pallet","warehouse",
  "sample","warning","recycle","office","gift","star","cube",
  "layers","cable","motor","shield","other",
];

export const ALLOWED_COLORS: ColorToken[] = [
  "gray","blue","cyan","teal","green","amber","orange",
  "red","rose","purple","violet","slate",
];

export interface InventoryItemType {
  id: string;
  tenant_id: string | null;        // NULL for system rows
  type_key: string;
  type_name: string;
  code_prefix: string;
  icon: IconName;
  color: ColorToken;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InventoryItemCategory {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InventoryItem {
  id: string;
  tenant_id: string;
  item_code: string;
  item_name: string;
  item_type_id: string;
  category_id: string | null;
  subcategory: string | null;
  brand: string | null;
  unit_of_measure: UnitOfMeasure;
  default_warehouse_id: string | null;
  preferred_supplier_id: string | null;
  linked_product_id: string | null;
  sku: string | null;
  barcode: string | null;
  qr_code: string | null;
  cost_price: number | null;
  currency: string | null;
  min_stock: number | null;
  reorder_point: number | null;
  max_stock: number | null;
  track_stock: boolean;
  is_consumable: boolean;
  is_sellable: boolean;
  is_purchasable: boolean;
  weight: number | null;
  dimensions: string | null;
  image_url: string | null;
  description: string | null;
  notes: string | null;
  status: ItemStatus;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InventoryItemWithRefs extends InventoryItem {
  type_key: string;
  type_name: string;
  icon: IconName;
  color: ColorToken;
  category_name: string | null;
  qty_on_hand: number;
  /** Tenant-wide weighted-average cost for this item. Surfaces in the
   *  Items table as "Avg Cost". */
  avg_cost: number;
  /** Sum of inventory_value across every (item, warehouse) bucket. */
  inventory_value: number;
  /* INV-H1 — product identity overlay. */
  product_name?: string | null;
  product_slug?: string | null;
  product_image_url?: string | null;
  product_sku?: string | null;
}

export type LocationType =
  | "warehouse" | "supplier_location" | "port" | "forwarder"
  | "consolidation_point" | "in_transit" | "customer_location"
  | "exhibition_site" | "demo_location" | "virtual_location";

export const ALLOWED_LOCATION_TYPES: LocationType[] = [
  "warehouse","supplier_location","port","forwarder","consolidation_point",
  "in_transit","customer_location","exhibition_site","demo_location","virtual_location",
];

export interface Warehouse {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  location: string | null;
  location_type: LocationType;
  is_default: boolean;
  is_active: boolean;
  is_virtual: boolean;
  contact_person: string | null;
  contact_phone: string | null;
  address: string | null;
  customer_id: string | null;
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
  movement_date: string;
  inventory_item_id: string;
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
  /* INV-H2 — approval workflow for manual / adjustment_* movements. */
  approval_status: "not_required" | "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  /* INV-H4A — optional variant + batch (back-compat: NULL on legacy rows). */
  variant_id: string | null;
  batch_id: string | null;
}

export interface StockBalance {
  id: string;
  tenant_id: string;
  inventory_item_id: string;
  warehouse_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  last_movement_id: string | null;
  last_movement_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BalanceWithRefs extends StockBalance {
  item_code: string;
  item_name: string | null;
  item_type_name: string | null;
  item_icon: IconName;
  item_color: ColorToken;
  warehouse_code: string;
  warehouse_name: string;
  qty_available: number;
  /* INV-H1 — product identity overlay. Populated when the inventory_item
     is linked to a product in the global catalog. */
  product_id?: string | null;
  product_name?: string | null;
  product_slug?: string | null;
  product_image_url?: string | null;
}

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
      return null;
  }
}

export interface CreateMovementInput {
  tenant_id: string;
  inventory_item_id: string;
  warehouse_id?: string | null;
  movement_type: MovementType;
  direction?: Direction;
  quantity: number;
  unit?: string;
  unit_cost?: number | null;
  currency?: string;
  source_type?: string | null;
  source_id?: string | null;
  reference?: string | null;
  notes?: string | null;
  movement_date?: string;
  created_by?: string | null;
  metadata?: Record<string, unknown>;
  /** INV-H2 — set to true when this call originates from a workflow page
   *  (purchase receive, sales ship, transfer, return). Document-generated
   *  movement types are blocked at the generic /api/inventory/movements
   *  entry point unless this flag is true. */
  from_workflow?: boolean;
  /** INV-H2 — for manual / adjustment movements, the actor's reason. */
  adjustment_reason?: string;
  /** INV-H2 — true when caller has been verified as authorised to
   *  approve adjustments. The posting layer never resolves permissions
   *  by itself — the route handler does that and passes the verdict. */
  pre_approved?: boolean;
  /** INV-H4A — optional variant. Must belong to inventory_item_id. */
  variant_id?: string | null;
  /** INV-H4A — optional batch. Must belong to the same item (and variant if
   *  variant is set). When provided, posting maintains
   *  inventory_batches.quantity_remaining. */
  batch_id?: string | null;
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

/* ─── Item creation input ──────────────────────────────────── */
export interface CreateItemInput {
  tenant_id: string;
  item_name: string;
  item_type_id?: string;        // resolved from type_key if absent
  type_key?: string;
  category_id?: string | null;
  unit_of_measure?: UnitOfMeasure;
  brand?: string | null;
  sku?: string | null;
  barcode?: string | null;
  qr_code?: string | null;
  cost_price?: number | null;
  currency?: string;
  min_stock?: number | null;
  reorder_point?: number | null;
  max_stock?: number | null;
  track_stock?: boolean;
  is_consumable?: boolean;
  is_sellable?: boolean;
  is_purchasable?: boolean;
  weight?: number | null;
  dimensions?: string | null;
  image_url?: string | null;
  description?: string | null;
  notes?: string | null;
  preferred_supplier_id?: string | null;
  linked_product_id?: string | null;
  default_warehouse_id?: string | null;
  /* Optional opening balance to post immediately. */
  initial_quantity?: number;
  initial_warehouse_id?: string | null;
  created_by?: string | null;
  /** INV-H1 — passthrough metadata; the API surface uses this to stamp
   *  flags like `admin_repair` that the DB guard checks. */
  metadata?: Record<string, unknown>;
}
