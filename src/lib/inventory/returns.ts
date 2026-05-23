import "server-only";

/* ===========================================================================
   PHASE INV-H3B — Customer & Supplier Returns Workflow engine.

   Two flows, one engine — mirrors the INV-H3A transfer architecture:

     • Customer return: draft → pending → approved → received → completed
       (creates `return_in` movements at `received`)
     • Supplier return: draft → pending → approved → shipped → completed
       (creates `return_out` movements at `shipped`)

   Public surface
   ──────────────
     createReturn               draft create (customer | supplier)
     updateReturnHeader         header edits (draft only)
     setReturnItems             replace items on a draft (atomic)
     transitionReturn           submit / approve / cancel / complete
     receiveReturn              atomic: create + post all return_in
                                 movements; routes by disposition
     shipReturn                 atomic: create + post all return_out
                                 movements
     voidReturn                 reverse posted movements + flip status
     listReturns / getReturnDetail
     resolveReturnLinkForMovement

   Disposition routing (customer return)
   ─────────────────────────────────────
     restock        → return.warehouse_id (normal)
     quarantine     → special QUARANTINE warehouse
     scrap          → special SCRAP warehouse
     vendor_return  → special QUARANTINE warehouse (held until supplier
                      return ships it back out)

   Atomicity
   ─────────
     1. Pre-flight every line (stock check for ship-side; nothing for
        receive-side — receives just add).
     2. Posting loop is line-by-line. On any partial failure, all
        previously-posted movements from this batch are voided via
        `voidInventoryMovement` and bridge rows are removed. Net effect:
        ALL or NONE.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import {
  createInventoryMovement,
  postInventoryMovement,
  voidInventoryMovement,
} from "./posting";
import { logInventoryAudit } from "./audit";
import { humanizeError } from "@/lib/ui/humanize-error";
import type { MovementType, StockMovement } from "./types";

/* ─── Types ─────────────────────────────────────────────────── */

export type ReturnType = "customer_return" | "supplier_return";

export type ReturnStatus =
  | "draft"
  | "pending"
  | "approved"
  | "received"   // customer-only terminal-ish step before completed
  | "shipped"    // supplier-only terminal-ish step before completed
  | "completed"
  | "cancelled"
  | "voided";

export type ReasonCode =
  | "damaged" | "defective" | "wrong_item" | "excess" | "warranty"
  | "expired" | "customer_rejection" | "supplier_error" | "other";

export type ConditionStatus = "good" | "damaged" | "defective" | "scrap";

export type Disposition = "restock" | "quarantine" | "scrap" | "vendor_return";

export interface ReturnRow {
  id: string;
  tenant_id: string;
  return_no: string;
  return_type: ReturnType;
  status: ReturnStatus;
  customer_id: string | null;
  supplier_id: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
  warehouse_id: string;
  reason_code: ReasonCode;
  reason_notes: string | null;
  requested_by: string | null;
  approved_by: string | null;
  processed_by: string | null;
  cancelled_by: string | null;
  voided_by: string | null;
  requested_at: string | null;
  approved_at: string | null;
  processed_at: string | null;
  cancelled_at: string | null;
  voided_at: string | null;
  notes: string | null;
  void_reason: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReturnItemRow {
  id: string;
  tenant_id: string;
  return_id: string;
  inventory_item_id: string;
  quantity: number;
  unit_of_measure: string;
  condition_status: ConditionStatus;
  disposition: Disposition;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReturnBridgeRow {
  id: string;
  tenant_id: string;
  return_id: string;
  return_item_id: string;
  movement_id: string;
  created_at: string;
}

/* ─── Number sequence ───────────────────────────────────────── */

function generateReturnNo(returnType: ReturnType, date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const tail = (Date.now().toString(16) + Math.random().toString(16).slice(2))
    .replace(/\./g, "")
    .slice(-6)
    .toUpperCase();
  const prefix = returnType === "customer_return" ? "RC" : "RS";
  return `${prefix}-${ymd}-${tail}`;
}

/* ─── State machine ─────────────────────────────────────────── */

function allowedNext(returnType: ReturnType): Record<ReturnStatus, ReturnStatus[]> {
  /* Both flows share draft/pending/approved → terminal completed/cancelled/voided.
     Only the middle step differs (received vs shipped). */
  if (returnType === "customer_return") {
    return {
      draft:     ["pending", "cancelled"],
      pending:   ["approved", "cancelled", "draft"],
      approved:  ["received", "cancelled"],
      received:  ["completed", "voided"],
      shipped:   [], /* not reachable for customer flow */
      completed: ["voided"],
      cancelled: [],
      voided:    [],
    };
  }
  return {
    draft:     ["pending", "cancelled"],
    pending:   ["approved", "cancelled", "draft"],
    approved:  ["shipped", "cancelled"],
    shipped:   ["completed", "voided"],
    received:  [], /* not reachable for supplier flow */
    completed: ["voided"],
    cancelled: [],
    voided:    [],
  };
}

function nextStatusOk(
  cur: ReturnRow,
  next: ReturnStatus,
): { ok: true } | { ok: false; error: string } {
  const map = allowedNext(cur.return_type);
  if (map[cur.status].includes(next)) return { ok: true };
  return {
    ok: false,
    error: `Cannot move ${cur.return_type === "customer_return" ? "customer return" : "supplier return"} from ${cur.status} to ${next}.`,
  };
}

/* ─── Special-location resolver ─────────────────────────────── */

async function ensureSpecialWarehouse(
  tenantId: string,
  code: "QUARANTINE" | "SCRAP" | "DAMAGED",
): Promise<string> {
  const name =
    code === "QUARANTINE" ? "Quarantine"
    : code === "SCRAP"    ? "Scrap"
                          : "Damaged Goods";
  const { data, error } = await supabaseServer.rpc("fn_inventory_ensure_special_location", {
    p_tenant_id: tenantId,
    p_code: code,
    p_name: name,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Resolve destination warehouse for a customer-return line based on
 *  disposition. */
async function resolveCustomerReturnDestination(
  tenantId: string,
  returnWarehouseId: string,
  disposition: Disposition,
): Promise<string> {
  if (disposition === "restock") return returnWarehouseId;
  if (disposition === "scrap") return await ensureSpecialWarehouse(tenantId, "SCRAP");
  /* quarantine + vendor_return both land in QUARANTINE. */
  return await ensureSpecialWarehouse(tenantId, "QUARANTINE");
}

/* ─── Listing / detail ──────────────────────────────────────── */

export interface ListReturnsFilter {
  tenantId: string;
  status?: ReturnStatus | null;
  returnType?: ReturnType | null;
  limit?: number;
}

export async function listReturns(f: ListReturnsFilter): Promise<ReturnRow[]> {
  const lim = Number.isFinite(f.limit) && (f.limit ?? 0) > 0 ? f.limit : 200;
  let q = supabaseServer
    .from("inventory_returns")
    .select("*")
    .eq("tenant_id", f.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(lim!);
  if (f.status) q = q.eq("status", f.status);
  if (f.returnType) q = q.eq("return_type", f.returnType);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ReturnRow[];
}

export interface ReturnDetail {
  return_: ReturnRow;
  items: ReturnItemRow[];
  bridges: ReturnBridgeRow[];
}

export async function getReturnDetail(
  tenantId: string,
  returnId: string,
): Promise<ReturnDetail | null> {
  const { data: r, error } = await supabaseServer
    .from("inventory_returns")
    .select("*")
    .eq("id", returnId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!r) return null;
  const [{ data: items }, { data: bridges }] = await Promise.all([
    supabaseServer
      .from("inventory_return_items")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("return_id", returnId)
      .order("created_at", { ascending: true }),
    supabaseServer
      .from("inventory_return_movements")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("return_id", returnId),
  ]);
  return {
    return_: r as ReturnRow,
    items: (items ?? []) as ReturnItemRow[],
    bridges: (bridges ?? []) as ReturnBridgeRow[],
  };
}

/* ─── Create / update ───────────────────────────────────────── */

export interface CreateReturnInput {
  tenant_id: string;
  return_type: ReturnType;
  customer_id?: string | null;
  supplier_id?: string | null;
  source_document_type?: string | null;
  source_document_id?: string | null;
  warehouse_id: string;
  reason_code: ReasonCode;
  reason_notes?: string | null;
  notes?: string | null;
  created_by?: string | null;
  items: Array<{
    inventory_item_id: string;
    quantity: number;
    unit_of_measure: string;
    condition_status: ConditionStatus;
    disposition: Disposition;
    notes?: string | null;
  }>;
}

function validateLines(
  input: CreateReturnInput["items"],
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "Add at least one item to the return." };
  }
  for (const it of input) {
    if (!it.inventory_item_id) return { ok: false, error: "Each line needs an item." };
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
      return { ok: false, error: "Each line needs a positive quantity." };
    }
    if (!it.unit_of_measure) return { ok: false, error: "Each line needs a unit." };
    if (!it.condition_status) return { ok: false, error: "Each line needs a condition." };
    if (!it.disposition) return { ok: false, error: "Each line needs a disposition." };
  }
  return { ok: true };
}

export async function createReturn(
  input: CreateReturnInput,
): Promise<{ ok: boolean; return_?: ReturnRow; error?: string }> {
  if (!input.tenant_id) return { ok: false, error: "tenant_id required" };
  if (!input.return_type) return { ok: false, error: "return_type required" };
  if (input.return_type === "customer_return" && !input.customer_id) {
    return { ok: false, error: "Customer return requires a customer." };
  }
  if (input.return_type === "supplier_return" && !input.supplier_id) {
    return { ok: false, error: "Supplier return requires a supplier." };
  }
  if (!input.warehouse_id) return { ok: false, error: "Warehouse is required." };
  if (!input.reason_code) return { ok: false, error: "Reason is required." };

  const v = validateLines(input.items);
  if (!v.ok) return v;

  const returnNo = generateReturnNo(input.return_type);
  const { data: created, error } = await supabaseServer
    .from("inventory_returns")
    .insert({
      tenant_id: input.tenant_id,
      return_no: returnNo,
      return_type: input.return_type,
      status: "draft" as ReturnStatus,
      customer_id: input.return_type === "customer_return" ? input.customer_id : null,
      supplier_id: input.return_type === "supplier_return" ? input.supplier_id : null,
      source_document_type: input.source_document_type ?? null,
      source_document_id: input.source_document_id ?? null,
      warehouse_id: input.warehouse_id,
      reason_code: input.reason_code,
      reason_notes: input.reason_notes ?? null,
      notes: input.notes ?? null,
      created_by: input.created_by ?? null,
      requested_by: input.created_by ?? null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: humanizeError(error.message) };
  const r = created as ReturnRow;

  const rows = input.items.map((it) => ({
    tenant_id: input.tenant_id,
    return_id: r.id,
    inventory_item_id: it.inventory_item_id,
    quantity: it.quantity,
    unit_of_measure: it.unit_of_measure,
    condition_status: it.condition_status,
    disposition: it.disposition,
    notes: it.notes ?? null,
  }));
  const { error: insErr } = await supabaseServer
    .from("inventory_return_items")
    .insert(rows);
  if (insErr) {
    /* roll back header */
    await supabaseServer.from("inventory_returns").delete().eq("id", r.id);
    return { ok: false, error: humanizeError(insErr.message) };
  }
  return { ok: true, return_: r };
}

export async function updateReturnHeader(
  tenantId: string,
  returnId: string,
  patch: {
    warehouse_id?: string;
    reason_code?: ReasonCode;
    reason_notes?: string | null;
    notes?: string | null;
    source_document_type?: string | null;
    source_document_id?: string | null;
  },
): Promise<{ ok: boolean; return_?: ReturnRow; error?: string }> {
  const { data: existing } = await supabaseServer
    .from("inventory_returns")
    .select("*")
    .eq("id", returnId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const cur = existing as ReturnRow | null;
  if (!cur) return { ok: false, error: "Return not found." };
  if (cur.status !== "draft") {
    return { ok: false, error: "Only draft returns can be edited." };
  }
  const updates: Record<string, unknown> = {};
  if (patch.warehouse_id) updates.warehouse_id = patch.warehouse_id;
  if (patch.reason_code) updates.reason_code = patch.reason_code;
  if (patch.reason_notes !== undefined) updates.reason_notes = patch.reason_notes;
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.source_document_type !== undefined) updates.source_document_type = patch.source_document_type;
  if (patch.source_document_id !== undefined) updates.source_document_id = patch.source_document_id;
  if (Object.keys(updates).length === 0) return { ok: true, return_: cur };

  const { data, error } = await supabaseServer
    .from("inventory_returns")
    .update(updates)
    .eq("id", returnId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) return { ok: false, error: humanizeError(error.message) };
  return { ok: true, return_: data as ReturnRow };
}

export async function setReturnItems(
  tenantId: string,
  returnId: string,
  items: CreateReturnInput["items"],
): Promise<{ ok: boolean; error?: string }> {
  const { data: r } = await supabaseServer
    .from("inventory_returns")
    .select("status")
    .eq("id", returnId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const cur = r as { status: ReturnStatus } | null;
  if (!cur) return { ok: false, error: "Return not found." };
  if (cur.status !== "draft") {
    return { ok: false, error: "Only draft returns can be edited." };
  }
  const v = validateLines(items);
  if (!v.ok) return v;
  const { error: delErr } = await supabaseServer
    .from("inventory_return_items")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("return_id", returnId);
  if (delErr) return { ok: false, error: humanizeError(delErr.message) };
  const rows = items.map((it) => ({
    tenant_id: tenantId,
    return_id: returnId,
    inventory_item_id: it.inventory_item_id,
    quantity: it.quantity,
    unit_of_measure: it.unit_of_measure,
    condition_status: it.condition_status,
    disposition: it.disposition,
    notes: it.notes ?? null,
  }));
  const { error: insErr } = await supabaseServer
    .from("inventory_return_items")
    .insert(rows);
  if (insErr) return { ok: false, error: humanizeError(insErr.message) };
  return { ok: true };
}

/* ─── State transitions (non-stock) ─────────────────────────── */

export async function transitionReturn(
  tenantId: string,
  returnId: string,
  next: "pending" | "approved" | "cancelled" | "completed",
  actorId: string | null,
): Promise<{ ok: boolean; return_?: ReturnRow; error?: string }> {
  const { data: existing } = await supabaseServer
    .from("inventory_returns")
    .select("*")
    .eq("id", returnId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const cur = existing as ReturnRow | null;
  if (!cur) return { ok: false, error: "Return not found." };

  const guard = nextStatusOk(cur, next);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (next === "pending" || next === "approved") {
    const { count } = await supabaseServer
      .from("inventory_return_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("return_id", returnId);
    if (!count || count === 0) {
      return { ok: false, error: "Add at least one item before submitting." };
    }
  }

  const patch: Record<string, unknown> = { status: next };
  const now = new Date().toISOString();
  if (next === "pending") { patch.requested_by = actorId; patch.requested_at = now; }
  if (next === "approved") { patch.approved_by = actorId; patch.approved_at = now; }
  if (next === "cancelled") { patch.cancelled_by = actorId; patch.cancelled_at = now; }
  if (next === "completed") { patch.processed_by = actorId; patch.processed_at = now; }

  const { data, error } = await supabaseServer
    .from("inventory_returns")
    .update(patch)
    .eq("id", returnId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) return { ok: false, error: humanizeError(error.message) };

  const action =
    next === "pending"   ? "return_submitted" :
    next === "approved"  ? "return_approved" :
    next === "cancelled" ? "return_cancelled" :
                           "return_completed";
  await logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action: action as never,
    entity_type: "return" as never,
    entity_id: returnId,
    metadata: { from: cur.status, to: next, return_type: cur.return_type },
  });

  return { ok: true, return_: data as ReturnRow };
}

/* ─── Stock helpers ─────────────────────────────────────────── */

async function readOnHand(
  tenantId: string,
  inventoryItemId: string,
  warehouseId: string,
): Promise<number> {
  const { data } = await supabaseServer
    .from("inventory_stock_balances")
    .select("qty_on_hand")
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", inventoryItemId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();
  if (!data) return 0;
  return Number((data as { qty_on_hand: number }).qty_on_hand) || 0;
}

/** Resolve the unit cost basis for a return movement.
 *  Prefers inventory_items.cost_price (per-item canonical cost). Returns
 *  null when no cost basis is configured; callers then stamp a
 *  `zero_value_reason` metadata flag. */
async function readUnitCost(
  tenantId: string,
  inventoryItemId: string,
): Promise<{ unit_cost: number; currency: string | null } | null> {
  const { data } = await supabaseServer
    .from("inventory_items")
    .select("cost_price, currency")
    .eq("tenant_id", tenantId)
    .eq("id", inventoryItemId)
    .maybeSingle();
  if (!data) return null;
  const r = data as { cost_price: number | null; currency: string | null };
  if (r.cost_price == null || !(r.cost_price > 0)) return null;
  return { unit_cost: Number(r.cost_price), currency: r.currency };
}

/* ─── Receive (customer) — atomic return_in batch ───────────── */

export async function receiveReturn(
  tenantId: string,
  returnId: string,
  actorId: string | null,
  /** INV-H4B — per-line serial selection. Map of return_item_id → serial_ids[]. */
  serialsByLine?: Record<string, string[]>,
): Promise<{ ok: boolean; error?: string }> {
  const detail = await getReturnDetail(tenantId, returnId);
  if (!detail) return { ok: false, error: "Return not found." };
  const { return_: r, items } = detail;
  if (r.return_type !== "customer_return") {
    return { ok: false, error: "Receive only applies to customer returns. Use ship for supplier returns." };
  }
  if (r.status !== "approved") {
    return { ok: false, error: "Only approved customer returns can be received." };
  }
  if (items.length === 0) {
    return { ok: false, error: "Return has no items." };
  }

  const createdMovementIds: string[] = [];
  const createdBridgeIds: string[] = [];

  for (const line of items) {
    /* Resolve destination warehouse from disposition. */
    let destWh: string;
    try {
      destWh = await resolveCustomerReturnDestination(tenantId, r.warehouse_id, line.disposition);
    } catch (e) {
      await unwindReceive(createdMovementIds, createdBridgeIds, tenantId, actorId);
      return { ok: false, error: humanizeError(e instanceof Error ? e.message : String(e)) };
    }

    const cost = await readUnitCost(tenantId, line.inventory_item_id);
    const meta: Record<string, unknown> = {
      return_id: r.id,
      return_no: r.return_no,
      return_type: r.return_type,
      disposition: line.disposition,
      condition_status: line.condition_status,
      /* INV-H4B — customer_id stamped so the serial engine can clear/keep it
         on return state changes. */
      customer_id: r.customer_id,
    };
    if (!cost) {
      meta.zero_value_reason = "return_no_cost_basis";
      /* discipline guard expects either positive unit_cost OR a zero-value
         override flag — stamp both so the IN movement is accepted. */
      meta.admin_zero_value_override = true;
    }

    const created = await createInventoryMovement({
      tenant_id: tenantId,
      inventory_item_id: line.inventory_item_id,
      warehouse_id: destWh,
      movement_type: "return_in" as MovementType,
      direction: "in",
      quantity: Number(line.quantity),
      unit: line.unit_of_measure,
      unit_cost: cost?.unit_cost ?? 0,
      currency: cost?.currency ?? undefined,
      from_workflow: true,
      source_type: "inventory_return",
      source_id: line.id,
      reference: r.return_no,
      notes: line.notes ?? null,
      created_by: actorId,
      metadata: meta,
      serial_ids: serialsByLine?.[line.id] ?? null,
    });
    if (!created.ok || !created.movement) {
      await unwindReceive(createdMovementIds, createdBridgeIds, tenantId, actorId);
      return { ok: false, error: humanizeError(created.error ?? "Receive failed.") };
    }
    const posted = await postInventoryMovement(created.movement.id, tenantId, actorId);
    if (!posted.ok) {
      await unwindReceive([...createdMovementIds, created.movement.id], createdBridgeIds, tenantId, actorId);
      return { ok: false, error: humanizeError(posted.error ?? "Receive failed.") };
    }
    createdMovementIds.push(created.movement.id);

    const { data: brData, error: brErr } = await supabaseServer
      .from("inventory_return_movements")
      .insert({
        tenant_id: tenantId,
        return_id: r.id,
        return_item_id: line.id,
        movement_id: created.movement.id,
      })
      .select("id")
      .single();
    if (brErr) {
      await unwindReceive(createdMovementIds, createdBridgeIds, tenantId, actorId);
      return { ok: false, error: humanizeError(brErr.message) };
    }
    createdBridgeIds.push((brData as { id: string }).id);
  }

  /* Promote to received. */
  const { error: stErr } = await supabaseServer
    .from("inventory_returns")
    .update({
      status: "received" as ReturnStatus,
      processed_by: actorId,
      processed_at: new Date().toISOString(),
    })
    .eq("id", returnId)
    .eq("tenant_id", tenantId);
  if (stErr) {
    await unwindReceive(createdMovementIds, createdBridgeIds, tenantId, actorId);
    return { ok: false, error: humanizeError(stErr.message) };
  }

  await logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action: "return_received" as never,
    entity_type: "return" as never,
    entity_id: returnId,
    metadata: { movement_ids: createdMovementIds },
  });

  return { ok: true };
}

async function unwindReceive(
  movementIds: string[],
  bridgeIds: string[],
  tenantId: string,
  actorId: string | null,
): Promise<void> {
  for (const id of movementIds) {
    try {
      await voidInventoryMovement(id, tenantId, actorId, "Atomic receive rollback");
    } catch {/* swallow — already-voided is fine */}
  }
  for (const id of bridgeIds) {
    try {
      await supabaseServer
        .from("inventory_return_movements")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
    } catch {/* swallow */}
  }
}

/* ─── Ship (supplier) — atomic return_out batch ─────────────── */

export async function shipReturn(
  tenantId: string,
  returnId: string,
  actorId: string | null,
  /** INV-H4B — per-line serial selection. Map of return_item_id → serial_ids[]. */
  serialsByLine?: Record<string, string[]>,
): Promise<{ ok: boolean; error?: string; offending_item_id?: string }> {
  const detail = await getReturnDetail(tenantId, returnId);
  if (!detail) return { ok: false, error: "Return not found." };
  const { return_: r, items } = detail;
  if (r.return_type !== "supplier_return") {
    return { ok: false, error: "Ship only applies to supplier returns. Use receive for customer returns." };
  }
  if (r.status !== "approved") {
    return { ok: false, error: "Only approved supplier returns can be shipped." };
  }
  if (items.length === 0) {
    return { ok: false, error: "Return has no items." };
  }

  /* Pre-flight stock check: every line must have enough at return.warehouse_id. */
  for (const line of items) {
    const onHand = await readOnHand(tenantId, line.inventory_item_id, r.warehouse_id);
    if (onHand < Number(line.quantity)) {
      return {
        ok: false,
        error: `Not enough stock at the source warehouse for one of the items (have ${onHand}, need ${line.quantity}).`,
        offending_item_id: line.inventory_item_id,
      };
    }
  }

  const createdMovementIds: string[] = [];
  const createdBridgeIds: string[] = [];

  for (const line of items) {
    const created = await createInventoryMovement({
      tenant_id: tenantId,
      inventory_item_id: line.inventory_item_id,
      warehouse_id: r.warehouse_id,
      movement_type: "return_out" as MovementType,
      direction: "out",
      quantity: Number(line.quantity),
      unit: line.unit_of_measure,
      from_workflow: true,
      source_type: "inventory_return",
      source_id: line.id,
      reference: r.return_no,
      notes: line.notes ?? null,
      created_by: actorId,
      metadata: {
        return_id: r.id,
        return_no: r.return_no,
        return_type: r.return_type,
        condition_status: line.condition_status,
        supplier_id: r.supplier_id,
      },
      serial_ids: serialsByLine?.[line.id] ?? null,
    });
    if (!created.ok || !created.movement) {
      await unwindShip(createdMovementIds, createdBridgeIds, tenantId, actorId);
      return {
        ok: false,
        error: humanizeError(created.error ?? "Ship failed."),
        offending_item_id: line.inventory_item_id,
      };
    }
    const posted = await postInventoryMovement(created.movement.id, tenantId, actorId);
    if (!posted.ok) {
      await unwindShip([...createdMovementIds, created.movement.id], createdBridgeIds, tenantId, actorId);
      return {
        ok: false,
        error: humanizeError(posted.error ?? "Ship failed."),
        offending_item_id: line.inventory_item_id,
      };
    }
    createdMovementIds.push(created.movement.id);

    const { data: brData, error: brErr } = await supabaseServer
      .from("inventory_return_movements")
      .insert({
        tenant_id: tenantId,
        return_id: r.id,
        return_item_id: line.id,
        movement_id: created.movement.id,
      })
      .select("id")
      .single();
    if (brErr) {
      await unwindShip(createdMovementIds, createdBridgeIds, tenantId, actorId);
      return { ok: false, error: humanizeError(brErr.message) };
    }
    createdBridgeIds.push((brData as { id: string }).id);
  }

  const { error: stErr } = await supabaseServer
    .from("inventory_returns")
    .update({
      status: "shipped" as ReturnStatus,
      processed_by: actorId,
      processed_at: new Date().toISOString(),
    })
    .eq("id", returnId)
    .eq("tenant_id", tenantId);
  if (stErr) {
    await unwindShip(createdMovementIds, createdBridgeIds, tenantId, actorId);
    return { ok: false, error: humanizeError(stErr.message) };
  }

  await logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action: "return_shipped" as never,
    entity_type: "return" as never,
    entity_id: returnId,
    metadata: { movement_ids: createdMovementIds },
  });

  return { ok: true };
}

async function unwindShip(
  movementIds: string[],
  bridgeIds: string[],
  tenantId: string,
  actorId: string | null,
): Promise<void> {
  for (const id of movementIds) {
    try {
      await voidInventoryMovement(id, tenantId, actorId, "Atomic ship rollback");
    } catch {/* swallow */}
  }
  for (const id of bridgeIds) {
    try {
      await supabaseServer
        .from("inventory_return_movements")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
    } catch {/* swallow */}
  }
}

/* ─── Void (after received/shipped/completed) ───────────────── */

export async function voidReturn(
  tenantId: string,
  returnId: string,
  actorId: string | null,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "A void reason is required (min 3 characters)." };
  }
  const detail = await getReturnDetail(tenantId, returnId);
  if (!detail) return { ok: false, error: "Return not found." };
  const { return_: r, bridges } = detail;
  if (!["received", "shipped", "completed"].includes(r.status)) {
    return { ok: false, error: "Only received, shipped, or completed returns can be voided. Use Cancel for drafts." };
  }

  const movementIds = bridges.map((b) => b.movement_id);
  for (const id of movementIds) {
    const v = await voidInventoryMovement(id, tenantId, actorId, `Return voided: ${trimmed}`);
    if (!v.ok && !v.already_voided) {
      return { ok: false, error: humanizeError(v.error ?? "Void failed.") };
    }
  }

  const { error: stErr } = await supabaseServer
    .from("inventory_returns")
    .update({
      status: "voided" as ReturnStatus,
      voided_by: actorId,
      voided_at: new Date().toISOString(),
      void_reason: trimmed,
    })
    .eq("id", returnId)
    .eq("tenant_id", tenantId);
  if (stErr) return { ok: false, error: humanizeError(stErr.message) };

  await logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action: "return_voided" as never,
    entity_type: "return" as never,
    entity_id: returnId,
    metadata: { reason: trimmed, reversed_movement_ids: movementIds },
  });

  return { ok: true };
}

/* ─── Traceability ──────────────────────────────────────────── */

export async function resolveReturnLinkForMovement(
  tenantId: string,
  movementId: string,
): Promise<{ return_id: string; return_no: string; return_type: ReturnType } | null> {
  const { data } = await supabaseServer
    .from("inventory_return_movements")
    .select("return_id, inventory_returns!inner(return_no, return_type)")
    .eq("tenant_id", tenantId)
    .eq("movement_id", movementId)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    return_id: string;
    inventory_returns:
      | { return_no: string; return_type: ReturnType }
      | { return_no: string; return_type: ReturnType }[];
  };
  const rRaw = row.inventory_returns;
  const meta = Array.isArray(rRaw) ? rRaw[0] : rRaw;
  return {
    return_id: row.return_id,
    return_no: meta?.return_no ?? "",
    return_type: meta?.return_type ?? "customer_return",
  };
}

/* Type re-exports. */
export type { StockMovement };
