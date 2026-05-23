import "server-only";

/* ===========================================================================
   INV-H4B — Serial-number tracking engine.

   Sits ON TOP of the existing movement engine — never duplicates posting
   logic. Public surface:

     • createSerial / listSerials / getSerial / updateSerial / archiveSerial
     • assignSerialToMovement
     • validateSerialMovement   — refuses bad serials BEFORE engine post
     • moveSerials              — applies state changes AFTER engine post
     • reverseSerialMovement    — undoes the most recent state change on void
     • getSerialHistory / getSerialCurrentState

   Lifecycle (status):

     in_stock      — at rest in a warehouse, available
     reserved      — earmarked (reserved for future shipment; reserved by
                     higher layers — engine doesn't auto-set this today)
     sold          — shipped to a customer
     returned      — returned (held in QUARANTINE) pending disposition
     damaged       — flagged damaged (kept on books, removed from stock)
     scrapped      — written off
     in_transit    — between warehouses (still tagged to source warehouse)

   State transitions per movement type (when item.track_serials = true):

     purchase_receipt   → IN  → status=in_stock,  warehouse=movement.warehouse
                                supplier_id=stamped, purchase_date=posted_at
     opening_balance    → IN  → status=in_stock,  warehouse=movement.warehouse
     adjustment_in      → IN  → status=in_stock,  warehouse=movement.warehouse
     transfer_in        → IN  → status=in_stock,  warehouse=destination
     return_in          → IN  → disposition-aware (see returns.ts caller)
                                restock    → in_stock
                                quarantine → returned (warehouse=QUARANTINE)
                                scrap      → scrapped
                                vendor_return → returned

     sales_shipment     → OUT → status=sold, customer_id stamped,
                                sold_date=posted_at
     adjustment_out     → OUT → status=in_stock or scrapped if reason="scrap"
     transfer_out       → OUT → status=in_transit (warehouse unchanged)
     return_out         → OUT → status=returned (supplier return) or scrapped

   On VOID: each serial keeps metadata.previous_state so we can revert
   cleanly. Reverse uses the previous_state stamp on the serial OR (if
   missing) re-derives from the movement timeline.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import { humanizeError } from "@/lib/ui/humanize-error";
import type { MovementType, Direction } from "./types";

/* ─── Types ─────────────────────────────────────────────────── */

export type SerialStatus =
  | "in_stock"
  | "reserved"
  | "sold"
  | "returned"
  | "damaged"
  | "scrapped"
  | "in_transit";

export type SerialCondition = "new" | "opened" | "refurbished" | "damaged";

export interface InventorySerial {
  id: string;
  tenant_id: string;
  inventory_item_id: string;
  variant_id: string | null;
  batch_id: string | null;
  serial_no: string;
  warehouse_id: string | null;
  status: SerialStatus;
  condition_status: SerialCondition | null;
  source_movement_id: string | null;
  current_movement_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  purchase_date: string | null;
  sold_date: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InventorySerialWithRefs extends InventorySerial {
  item_code: string | null;
  item_name: string | null;
  variant_name: string | null;
  warehouse_code: string | null;
  warehouse_name: string | null;
  customer_name: string | null;
  supplier_name: string | null;
}

export interface SerialMovementContext {
  movement_type: MovementType;
  direction: Direction;
  warehouse_id: string;
  destination_warehouse_id?: string | null;
  posted_at?: string | null;
  customer_id?: string | null;
  supplier_id?: string | null;
  disposition?: "restock" | "quarantine" | "scrap" | "vendor_return" | null;
  /** When adjustment_out reason is "scrap" the serial is written off rather
   *  than left in stock. */
  scrap_intent?: boolean;
}

/* ─── Humanise DB errors ────────────────────────────────────── */

function human(e: { message?: string } | null | undefined, fallback: string): string {
  const raw = e?.message ?? "";
  if (/INV_H4B_SERIAL_VARIANT_ITEM_MISMATCH/.test(raw))
    return "Serial's variant must belong to the chosen item.";
  if (/INV_H4B_SERIAL_BATCH_ITEM_MISMATCH/.test(raw))
    return "Serial's batch must belong to the chosen item.";
  if (/INV_H4B_SERIAL_BATCH_VARIANT_MISMATCH/.test(raw))
    return "Serial's batch must match the chosen variant.";
  if (/INV_H4B_SERIAL_VARIANT_MISSING/.test(raw))
    return "Selected variant does not exist.";
  if (/INV_H4B_SERIAL_BATCH_MISSING/.test(raw))
    return "Selected batch does not exist.";
  if (/uq_inv_serials_tenant_serial/.test(raw))
    return "A serial with this number already exists in this tenant.";
  return humanizeError(raw || fallback);
}

/* ─── CRUD ──────────────────────────────────────────────────── */

export interface CreateSerialInput {
  tenant_id: string;
  inventory_item_id: string;
  variant_id?: string | null;
  batch_id?: string | null;
  serial_no: string;
  warehouse_id?: string | null;
  status?: SerialStatus;
  condition_status?: SerialCondition | null;
  source_movement_id?: string | null;
  current_movement_id?: string | null;
  customer_id?: string | null;
  supplier_id?: string | null;
  purchase_date?: string | null;
  sold_date?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createSerial(
  input: CreateSerialInput,
): Promise<{ ok: boolean; serial?: InventorySerial; error?: string }> {
  if (!input.tenant_id) return { ok: false, error: "tenant_id required" };
  if (!input.inventory_item_id) return { ok: false, error: "inventory_item_id required" };
  if (!input.serial_no?.trim()) return { ok: false, error: "serial_no required" };

  const { data, error } = await supabaseServer
    .from("inventory_serials")
    .insert({
      tenant_id: input.tenant_id,
      inventory_item_id: input.inventory_item_id,
      variant_id: input.variant_id ?? null,
      batch_id: input.batch_id ?? null,
      serial_no: input.serial_no.trim(),
      warehouse_id: input.warehouse_id ?? null,
      status: input.status ?? "in_stock",
      condition_status: input.condition_status ?? null,
      source_movement_id: input.source_movement_id ?? null,
      current_movement_id: input.current_movement_id ?? input.source_movement_id ?? null,
      customer_id: input.customer_id ?? null,
      supplier_id: input.supplier_id ?? null,
      purchase_date: input.purchase_date ?? null,
      sold_date: input.sold_date ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: human(error, "Failed to create serial") };
  return { ok: true, serial: data as InventorySerial };
}

export interface ListSerialsFilter {
  tenantId: string;
  inventoryItemId?: string | null;
  variantId?: string | null;
  batchId?: string | null;
  warehouseId?: string | null;
  status?: SerialStatus | null;
  conditionStatus?: SerialCondition | null;
  customerId?: string | null;
  supplierId?: string | null;
  search?: string | null;
  limit?: number;
}

export async function listSerials(f: ListSerialsFilter): Promise<InventorySerialWithRefs[]> {
  const limit = Math.min(f.limit ?? 200, 1000);
  let q = supabaseServer
    .from("inventory_serials")
    .select("*")
    .eq("tenant_id", f.tenantId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (f.inventoryItemId) q = q.eq("inventory_item_id", f.inventoryItemId);
  if (f.variantId) q = q.eq("variant_id", f.variantId);
  if (f.batchId) q = q.eq("batch_id", f.batchId);
  if (f.warehouseId) q = q.eq("warehouse_id", f.warehouseId);
  if (f.status) q = q.eq("status", f.status);
  if (f.conditionStatus) q = q.eq("condition_status", f.conditionStatus);
  if (f.customerId) q = q.eq("customer_id", f.customerId);
  if (f.supplierId) q = q.eq("supplier_id", f.supplierId);
  if (f.search) {
    const s = f.search.replace(/[%_]/g, "\\$&");
    q = q.ilike("serial_no", `%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as InventorySerial[];
  if (rows.length === 0) return [];

  const itemIds = Array.from(new Set(rows.map((r) => r.inventory_item_id)));
  const variantIds = Array.from(
    new Set(rows.map((r) => r.variant_id).filter((v): v is string => !!v)),
  );
  const whIds = Array.from(
    new Set(rows.map((r) => r.warehouse_id).filter((v): v is string => !!v)),
  );
  const contactIds = Array.from(
    new Set([
      ...rows.map((r) => r.customer_id),
      ...rows.map((r) => r.supplier_id),
    ].filter((v): v is string => !!v)),
  );

  const [itemsRes, varRes, whRes, ctRes] = await Promise.all([
    itemIds.length
      ? supabaseServer.from("inventory_items").select("id, item_code, item_name").in("id", itemIds)
      : Promise.resolve({ data: [] }),
    variantIds.length
      ? supabaseServer
          .from("inventory_item_variants")
          .select("id, variant_name")
          .in("id", variantIds)
      : Promise.resolve({ data: [] }),
    whIds.length
      ? supabaseServer.from("inventory_warehouses").select("id, code, name").in("id", whIds)
      : Promise.resolve({ data: [] }),
    contactIds.length
      ? supabaseServer.from("contacts").select("id, name").in("id", contactIds)
      : Promise.resolve({ data: [] }),
  ]);

  const itemMap = new Map<string, { item_code: string; item_name: string }>();
  for (const i of (itemsRes.data ?? []) as Array<{
    id: string;
    item_code: string;
    item_name: string;
  }>) {
    itemMap.set(i.id, { item_code: i.item_code, item_name: i.item_name });
  }
  const varMap = new Map<string, string>();
  for (const v of (varRes.data ?? []) as Array<{ id: string; variant_name: string }>) {
    varMap.set(v.id, v.variant_name);
  }
  const whMap = new Map<string, { code: string; name: string }>();
  for (const w of (whRes.data ?? []) as Array<{ id: string; code: string; name: string }>) {
    whMap.set(w.id, { code: w.code, name: w.name });
  }
  const ctMap = new Map<string, string>();
  for (const c of (ctRes.data ?? []) as Array<{ id: string; name: string }>) {
    ctMap.set(c.id, c.name);
  }

  return rows.map((r) => ({
    ...r,
    item_code: itemMap.get(r.inventory_item_id)?.item_code ?? null,
    item_name: itemMap.get(r.inventory_item_id)?.item_name ?? null,
    variant_name: r.variant_id ? varMap.get(r.variant_id) ?? null : null,
    warehouse_code: r.warehouse_id ? whMap.get(r.warehouse_id)?.code ?? null : null,
    warehouse_name: r.warehouse_id ? whMap.get(r.warehouse_id)?.name ?? null : null,
    customer_name: r.customer_id ? ctMap.get(r.customer_id) ?? null : null,
    supplier_name: r.supplier_id ? ctMap.get(r.supplier_id) ?? null : null,
  }));
}

export async function getSerial(
  tenantId: string,
  serialId: string,
): Promise<InventorySerialWithRefs | null> {
  const list = await listSerials({ tenantId, limit: 1 });
  const cached = list.find((s) => s.id === serialId);
  if (cached) return cached;
  const { data } = await supabaseServer
    .from("inventory_serials")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", serialId)
    .maybeSingle();
  if (!data) return null;
  const row = data as InventorySerial;
  const enriched = await listSerials({
    tenantId,
    inventoryItemId: row.inventory_item_id,
    limit: 1000,
  });
  return enriched.find((s) => s.id === serialId) ?? null;
}

export interface UpdateSerialPatch {
  condition_status?: SerialCondition | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  /** Allowed only for admin paths — do not expose in normal UI. */
  status?: SerialStatus;
}

export async function updateSerial(
  tenantId: string,
  serialId: string,
  patch: UpdateSerialPatch,
): Promise<{ ok: boolean; serial?: InventorySerial; error?: string }> {
  const update: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    const { data } = await supabaseServer
      .from("inventory_serials")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", serialId)
      .maybeSingle();
    return data ? { ok: true, serial: data as InventorySerial } : { ok: false, error: "Serial not found." };
  }
  const { data, error } = await supabaseServer
    .from("inventory_serials")
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("id", serialId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: human(error, "Failed to update serial") };
  if (!data) return { ok: false, error: "Serial not found." };
  return { ok: true, serial: data as InventorySerial };
}

/** Admin-only soft delete: flips status → scrapped. */
export async function archiveSerial(
  tenantId: string,
  serialId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseServer
    .from("inventory_serials")
    .update({ status: "scrapped" })
    .eq("tenant_id", tenantId)
    .eq("id", serialId);
  if (error) return { ok: false, error: human(error, "Failed to archive serial") };
  return { ok: true };
}

/* ─── Validation (pre-post) ─────────────────────────────────── */

/** Validate that the provided serial_ids match the rules for this movement.
 *  Throws by returning ok:false with a humanised error. */
export async function validateSerialMovement(
  tenantId: string,
  ctx: {
    inventory_item_id: string;
    movement_type: MovementType;
    direction: Direction;
    quantity: number;
    warehouse_id: string;
    serial_ids: string[];
  },
): Promise<{ ok: boolean; error?: string }> {
  const ids = Array.isArray(ctx.serial_ids) ? ctx.serial_ids.filter(Boolean) : [];

  /* Reject duplicates inside the picker. */
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    return { ok: false, error: "Each serial can only be selected once." };
  }

  /* Quantity must equal serial count exactly. */
  if (ids.length !== Number(ctx.quantity)) {
    return {
      ok: false,
      error: `This item tracks serial numbers. Pick exactly ${ctx.quantity} serial${ctx.quantity === 1 ? "" : "s"} (you picked ${ids.length}).`,
    };
  }

  if (ids.length === 0) return { ok: true };

  /* Load the serials. */
  const { data, error } = await supabaseServer
    .from("inventory_serials")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("id", ids);
  if (error) return { ok: false, error: human(error, "Failed to read serials") };
  const rows = (data ?? []) as InventorySerial[];

  if (ctx.direction === "in") {
    /* For IN movements: any serial passed by id must already belong to this
       item (we'll update its state). Brand-new serials must be created
       through createSerial first OR via the engine helper that auto-creates
       them — those callers will pass serial_no, not id. validateSerialMovement
       only validates id-based pickers, so any id given here MUST resolve. */
    for (const id of ids) {
      const s = rows.find((r) => r.id === id);
      if (!s) {
        return { ok: false, error: "One or more serials no longer exist." };
      }
      if (s.inventory_item_id !== ctx.inventory_item_id) {
        return { ok: false, error: `Serial ${s.serial_no} belongs to a different item.` };
      }
    }
    return { ok: true };
  }

  /* OUT movements: all serials must exist, belong to this item, be in
     source warehouse, and be in_stock. */
  for (const id of ids) {
    const s = rows.find((r) => r.id === id);
    if (!s) {
      return { ok: false, error: "One or more serials no longer exist." };
    }
    if (s.inventory_item_id !== ctx.inventory_item_id) {
      return { ok: false, error: `Serial ${s.serial_no} belongs to a different item.` };
    }
    if (s.warehouse_id !== ctx.warehouse_id) {
      return {
        ok: false,
        error: `Serial ${s.serial_no} is not at the source warehouse.`,
      };
    }
    if (s.status !== "in_stock") {
      return {
        ok: false,
        error: `Serial ${s.serial_no} is ${s.status.replace("_", " ")} and cannot be shipped.`,
      };
    }
  }
  return { ok: true };
}

/* ─── State transitions (post-post) ─────────────────────────── */

interface SerialApplyOptions {
  movementId: string;
  ctx: SerialMovementContext;
}

function nextStateForMovement(
  cur: InventorySerial,
  movementType: MovementType,
  direction: Direction,
  ctx: SerialMovementContext,
): { status: SerialStatus; warehouse_id: string | null; customer_id?: string | null; supplier_id?: string | null; sold_date?: string | null; purchase_date?: string | null } {
  const posted = ctx.posted_at ?? new Date().toISOString();

  if (direction === "in") {
    if (movementType === "purchase_receipt") {
      return {
        status: "in_stock",
        warehouse_id: ctx.warehouse_id,
        supplier_id: ctx.supplier_id ?? cur.supplier_id,
        purchase_date: cur.purchase_date ?? posted,
      };
    }
    if (movementType === "transfer_in") {
      return {
        status: "in_stock",
        warehouse_id: ctx.warehouse_id, // destination, passed by caller
      };
    }
    if (movementType === "return_in") {
      /* Disposition-aware. */
      const disp = ctx.disposition ?? "restock";
      if (disp === "restock") return { status: "in_stock", warehouse_id: ctx.warehouse_id };
      if (disp === "scrap") return { status: "scrapped", warehouse_id: ctx.warehouse_id };
      /* quarantine + vendor_return both land as "returned" in the
         QUARANTINE warehouse (warehouse_id is set by caller). */
      return { status: "returned", warehouse_id: ctx.warehouse_id };
    }
    /* opening_balance / adjustment_in → in_stock at movement warehouse. */
    return { status: "in_stock", warehouse_id: ctx.warehouse_id };
  }

  /* OUT */
  if (movementType === "sales_shipment") {
    return {
      status: "sold",
      warehouse_id: cur.warehouse_id, // keep last warehouse for traceability
      customer_id: ctx.customer_id ?? cur.customer_id,
      sold_date: posted,
    };
  }
  if (movementType === "transfer_out") {
    return {
      status: "in_transit",
      warehouse_id: cur.warehouse_id, // unchanged until receive
    };
  }
  if (movementType === "return_out") {
    /* Supplier return ship — leaves the company. Track as "returned". */
    return { status: "returned", warehouse_id: cur.warehouse_id };
  }
  if (movementType === "adjustment_out") {
    /* If reason indicates scrap, mark scrapped. Otherwise the serial leaves
       stock; we set status=scrapped (functionally identical for ledger). */
    if (ctx.scrap_intent) return { status: "scrapped", warehouse_id: cur.warehouse_id };
    return { status: "scrapped", warehouse_id: cur.warehouse_id };
  }
  return { status: cur.status, warehouse_id: cur.warehouse_id };
}

/** Apply state changes to a batch of serials after a movement posts. */
export async function moveSerials(
  tenantId: string,
  serialIds: string[],
  opts: SerialApplyOptions,
): Promise<{ ok: boolean; error?: string }> {
  if (!serialIds || serialIds.length === 0) return { ok: true };
  const { data, error } = await supabaseServer
    .from("inventory_serials")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("id", serialIds);
  if (error) return { ok: false, error: human(error, "Failed to read serials") };
  const rows = (data ?? []) as InventorySerial[];

  for (const s of rows) {
    const next = nextStateForMovement(s, opts.ctx.movement_type, opts.ctx.direction, opts.ctx);
    const prevMeta = { ...(s.metadata ?? {}) } as Record<string, unknown>;
    prevMeta.previous_state = {
      status: s.status,
      warehouse_id: s.warehouse_id,
      customer_id: s.customer_id,
      sold_date: s.sold_date,
      current_movement_id: s.current_movement_id,
    };
    const patch: Record<string, unknown> = {
      status: next.status,
      warehouse_id: next.warehouse_id,
      current_movement_id: opts.movementId,
      metadata: prevMeta,
    };
    if (next.customer_id !== undefined) patch.customer_id = next.customer_id;
    if (next.supplier_id !== undefined) patch.supplier_id = next.supplier_id;
    if (next.sold_date !== undefined) patch.sold_date = next.sold_date;
    if (next.purchase_date !== undefined) patch.purchase_date = next.purchase_date;
    if (s.source_movement_id == null) patch.source_movement_id = opts.movementId;

    const { error: upErr } = await supabaseServer
      .from("inventory_serials")
      .update(patch)
      .eq("tenant_id", tenantId)
      .eq("id", s.id);
    if (upErr) return { ok: false, error: human(upErr, "Failed to update serial state") };
  }
  return { ok: true };
}

/** Stamp source/current movement linkage without changing state. */
export async function assignSerialToMovement(
  tenantId: string,
  serialId: string,
  movementId: string,
  role: "source" | "current",
): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> =
    role === "source" ? { source_movement_id: movementId, current_movement_id: movementId } : { current_movement_id: movementId };
  const { error } = await supabaseServer
    .from("inventory_serials")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", serialId);
  if (error) return { ok: false, error: human(error, "Failed to link serial") };
  return { ok: true };
}

/** Reverse the most recent state change for a list of serials. Used by void. */
export async function reverseSerialMovement(
  tenantId: string,
  serialIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (!serialIds || serialIds.length === 0) return { ok: true };
  const { data, error } = await supabaseServer
    .from("inventory_serials")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("id", serialIds);
  if (error) return { ok: false, error: human(error, "Failed to read serials") };
  const rows = (data ?? []) as InventorySerial[];

  for (const s of rows) {
    const prev = (s.metadata as { previous_state?: Record<string, unknown> } | null)?.previous_state;
    const patch: Record<string, unknown> = {};
    if (prev && typeof prev === "object") {
      if ("status" in prev) patch.status = prev.status;
      if ("warehouse_id" in prev) patch.warehouse_id = prev.warehouse_id;
      if ("customer_id" in prev) patch.customer_id = prev.customer_id;
      if ("sold_date" in prev) patch.sold_date = prev.sold_date;
      if ("current_movement_id" in prev) patch.current_movement_id = prev.current_movement_id;
    } else {
      /* No stamped previous_state — best-effort: flip out-of-stock states
         back to in_stock. */
      if (s.status === "sold" || s.status === "in_transit" || s.status === "returned" || s.status === "scrapped") {
        patch.status = "in_stock";
        patch.customer_id = null;
        patch.sold_date = null;
      }
    }
    /* Always clear the previous_state stamp after reversal. */
    const meta = { ...(s.metadata ?? {}) } as Record<string, unknown>;
    delete meta.previous_state;
    patch.metadata = meta;
    if (Object.keys(patch).length === 0) continue;

    const { error: upErr } = await supabaseServer
      .from("inventory_serials")
      .update(patch)
      .eq("tenant_id", tenantId)
      .eq("id", s.id);
    if (upErr) return { ok: false, error: human(upErr, "Failed to reverse serial state") };
  }
  return { ok: true };
}

/* ─── Read helpers ──────────────────────────────────────────── */

export interface SerialHistoryRow {
  movement_id: string;
  movement_no: string;
  movement_type: MovementType;
  direction: Direction;
  warehouse_id: string;
  warehouse_name: string | null;
  warehouse_code: string | null;
  occurred_at: string;
  status: MovementStatusForHistory;
  serial_status_after: SerialStatus | null;
}

export type MovementStatusForHistory = "draft" | "posted" | "voided";

export async function getSerialHistory(
  tenantId: string,
  serialId: string,
): Promise<SerialHistoryRow[]> {
  /* Pull every movement whose serial_ids contains this id. */
  const { data, error } = await supabaseServer
    .from("inventory_stock_movements")
    .select("id, movement_no, movement_type, direction, warehouse_id, status, created_at, posted_at, voided_at")
    .eq("tenant_id", tenantId)
    .contains("serial_ids", [serialId])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    movement_no: string;
    movement_type: MovementType;
    direction: Direction;
    warehouse_id: string;
    status: MovementStatusForHistory;
    created_at: string;
    posted_at: string | null;
    voided_at: string | null;
  }>;
  if (rows.length === 0) return [];

  const whIds = Array.from(new Set(rows.map((r) => r.warehouse_id)));
  const { data: whs } = await supabaseServer
    .from("inventory_warehouses")
    .select("id, code, name")
    .in("id", whIds);
  const whMap = new Map<string, { code: string; name: string }>();
  for (const w of (whs ?? []) as Array<{ id: string; code: string; name: string }>) {
    whMap.set(w.id, { code: w.code, name: w.name });
  }

  return rows.map((r) => ({
    movement_id: r.id,
    movement_no: r.movement_no,
    movement_type: r.movement_type,
    direction: r.direction,
    warehouse_id: r.warehouse_id,
    warehouse_name: whMap.get(r.warehouse_id)?.name ?? null,
    warehouse_code: whMap.get(r.warehouse_id)?.code ?? null,
    occurred_at: r.posted_at ?? r.voided_at ?? r.created_at,
    status: r.status,
    serial_status_after: null, // populated by caller if needed
  }));
}

export async function getSerialCurrentState(
  tenantId: string,
  serialId: string,
): Promise<{
  status: SerialStatus;
  warehouse_id: string | null;
  current_movement_id: string | null;
  condition_status: SerialCondition | null;
} | null> {
  const { data } = await supabaseServer
    .from("inventory_serials")
    .select("status, warehouse_id, current_movement_id, condition_status")
    .eq("tenant_id", tenantId)
    .eq("id", serialId)
    .maybeSingle();
  if (!data) return null;
  return data as {
    status: SerialStatus;
    warehouse_id: string | null;
    current_movement_id: string | null;
    condition_status: SerialCondition | null;
  };
}
