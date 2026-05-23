import "server-only";

/* ===========================================================================
   PHASE INV-H3A — Warehouse Transfer Workflow engine.

   Public surface
   ──────────────
     createTransfer             draft create
     updateTransferHeader       header edits (draft only)
     setTransferItems           replace items on a draft (atomic)
     transitionTransfer         submit / approve / cancel
     shipTransfer               atomic: create + post all transfer_out
                                 movements, write bridge rows
     receiveTransfer            atomic: create + post all transfer_in
                                 movements, write bridge rows
     voidTransfer               void after ship/receive — reverse via
                                 the existing voidInventoryMovement
     listTransfers / getTransferDetail

   Design notes
   ────────────
     · Stock is touched ONLY at ship + receive.
     · transfer_out uses source warehouse + direction='out'.
     · transfer_in  uses destination warehouse + direction='in'.
     · Both carry source_type='inventory_transfer' and
       source_id=transfer_item_id (the bridge row carries the pair of
       movement ids for permanent traceability + the bridge is also
       what /api/inventory/movements/[id] uses to find a transfer link).
     · Atomicity for the multi-row ship/receive is implemented in two
       layers:
         1. We pre-flight every line (stock check, item validity)
            before any write. If anything fails, nothing is written.
         2. Posting happens line-by-line through the existing
            createAndPostInventoryMovement. If a later line fails, we
            void already-posted movements from this batch, undo bridge
            rows, and revert the transfer status. Net effect: ALL or
            NONE.
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

export type TransferStatus =
  | "draft"
  | "pending"
  | "approved"
  | "shipped"
  | "received"
  | "cancelled"
  | "voided";

export interface TransferRow {
  id: string;
  tenant_id: string;
  transfer_no: string;
  status: TransferStatus;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  requested_by: string | null;
  approved_by: string | null;
  shipped_by: string | null;
  received_by: string | null;
  cancelled_by: string | null;
  voided_by: string | null;
  requested_at: string | null;
  approved_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  voided_at: string | null;
  notes: string | null;
  void_reason: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferItemRow {
  id: string;
  tenant_id: string;
  transfer_id: string;
  inventory_item_id: string;
  quantity: number;
  unit_of_measure: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferBridgeRow {
  id: string;
  tenant_id: string;
  transfer_id: string;
  transfer_item_id: string;
  transfer_out_movement_id: string | null;
  transfer_in_movement_id: string | null;
}

/* ─── Number sequence ───────────────────────────────────────── */

function generateTransferNo(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const tail = (Date.now().toString(16) + Math.random().toString(16).slice(2))
    .replace(/\./g, "")
    .slice(-6)
    .toUpperCase();
  return `WT-${ymd}-${tail}`;
}

/* ─── Generic guards ────────────────────────────────────────── */

function nextStatusOk(
  current: TransferStatus,
  next: TransferStatus,
): { ok: true } | { ok: false; error: string } {
  const allowed: Record<TransferStatus, TransferStatus[]> = {
    draft:     ["pending", "cancelled"],
    pending:   ["approved", "cancelled", "draft"],
    approved:  ["shipped",  "cancelled"],
    shipped:   ["received", "voided"],
    received:  ["voided"],
    cancelled: [],
    voided:    [],
  };
  if (allowed[current].includes(next)) return { ok: true };
  return {
    ok: false,
    error: `Cannot move transfer from ${current} to ${next}.`,
  };
}

/* ─── Listing / detail ──────────────────────────────────────── */

export interface ListTransfersFilter {
  tenantId: string;
  status?: TransferStatus | null;
  limit?: number;
}

export async function listTransfers(
  f: ListTransfersFilter,
): Promise<TransferRow[]> {
  const lim = Number.isFinite(f.limit) && (f.limit ?? 0) > 0 ? f.limit : 200;
  let q = supabaseServer
    .from("inventory_transfers")
    .select("*")
    .eq("tenant_id", f.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(lim!);
  if (f.status) q = q.eq("status", f.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as TransferRow[];
}

export interface TransferDetail {
  transfer: TransferRow;
  items: TransferItemRow[];
  bridges: TransferBridgeRow[];
}

export async function getTransferDetail(
  tenantId: string,
  transferId: string,
): Promise<TransferDetail | null> {
  const { data: t, error: tErr } = await supabaseServer
    .from("inventory_transfers")
    .select("*")
    .eq("id", transferId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (tErr) throw new Error(tErr.message);
  if (!t) return null;
  const [{ data: items }, { data: bridges }] = await Promise.all([
    supabaseServer
      .from("inventory_transfer_items")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("transfer_id", transferId)
      .order("created_at", { ascending: true }),
    supabaseServer
      .from("inventory_transfer_movements")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("transfer_id", transferId),
  ]);
  return {
    transfer: t as TransferRow,
    items: (items ?? []) as TransferItemRow[],
    bridges: (bridges ?? []) as TransferBridgeRow[],
  };
}

/* ─── Create / update ───────────────────────────────────────── */

export interface CreateTransferInput {
  tenant_id: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  notes?: string | null;
  created_by?: string | null;
  items: Array<{
    inventory_item_id: string;
    quantity: number;
    unit_of_measure: string;
    notes?: string | null;
  }>;
}

export async function createTransfer(
  input: CreateTransferInput,
): Promise<{ ok: boolean; transfer?: TransferRow; error?: string }> {
  if (!input.tenant_id) return { ok: false, error: "tenant_id required" };
  if (!input.source_warehouse_id || !input.destination_warehouse_id) {
    return { ok: false, error: "Both source and destination warehouses are required." };
  }
  if (input.source_warehouse_id === input.destination_warehouse_id) {
    return { ok: false, error: "Source and destination warehouses must differ." };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "Add at least one item to the transfer." };
  }
  for (const it of input.items) {
    if (!it.inventory_item_id) return { ok: false, error: "Each line needs an item." };
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
      return { ok: false, error: "Each line needs a positive quantity." };
    }
    if (!it.unit_of_measure) return { ok: false, error: "Each line needs a unit." };
  }

  const transferNo = generateTransferNo();
  const { data: created, error } = await supabaseServer
    .from("inventory_transfers")
    .insert({
      tenant_id: input.tenant_id,
      transfer_no: transferNo,
      status: "draft" as TransferStatus,
      source_warehouse_id: input.source_warehouse_id,
      destination_warehouse_id: input.destination_warehouse_id,
      notes: input.notes ?? null,
      created_by: input.created_by ?? null,
      requested_by: input.created_by ?? null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: humanizeError(error.message) };

  const transfer = created as TransferRow;

  const itemRows = input.items.map((it) => ({
    tenant_id: input.tenant_id,
    transfer_id: transfer.id,
    inventory_item_id: it.inventory_item_id,
    quantity: it.quantity,
    unit_of_measure: it.unit_of_measure,
    notes: it.notes ?? null,
  }));
  const { error: itemsErr } = await supabaseServer
    .from("inventory_transfer_items")
    .insert(itemRows);
  if (itemsErr) {
    /* rollback header */
    await supabaseServer.from("inventory_transfers").delete().eq("id", transfer.id);
    return { ok: false, error: humanizeError(itemsErr.message) };
  }

  return { ok: true, transfer };
}

export async function updateTransferHeader(
  tenantId: string,
  transferId: string,
  patch: {
    source_warehouse_id?: string;
    destination_warehouse_id?: string;
    notes?: string | null;
  },
): Promise<{ ok: boolean; transfer?: TransferRow; error?: string }> {
  const { data: existing } = await supabaseServer
    .from("inventory_transfers")
    .select("*")
    .eq("id", transferId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const cur = existing as TransferRow | null;
  if (!cur) return { ok: false, error: "Transfer not found." };
  if (cur.status !== "draft") {
    return { ok: false, error: "Only draft transfers can be edited." };
  }
  const src = patch.source_warehouse_id ?? cur.source_warehouse_id;
  const dest = patch.destination_warehouse_id ?? cur.destination_warehouse_id;
  if (src === dest) {
    return { ok: false, error: "Source and destination warehouses must differ." };
  }
  const { data, error } = await supabaseServer
    .from("inventory_transfers")
    .update({
      source_warehouse_id: src,
      destination_warehouse_id: dest,
      notes: patch.notes ?? cur.notes,
    })
    .eq("id", transferId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) return { ok: false, error: humanizeError(error.message) };
  return { ok: true, transfer: data as TransferRow };
}

export async function setTransferItems(
  tenantId: string,
  transferId: string,
  items: Array<{
    inventory_item_id: string;
    quantity: number;
    unit_of_measure: string;
    notes?: string | null;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const { data: t } = await supabaseServer
    .from("inventory_transfers")
    .select("status")
    .eq("id", transferId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const cur = t as { status: TransferStatus } | null;
  if (!cur) return { ok: false, error: "Transfer not found." };
  if (cur.status !== "draft") {
    return { ok: false, error: "Only draft transfers can be edited." };
  }
  for (const it of items) {
    if (!it.inventory_item_id || !Number.isFinite(it.quantity) || it.quantity <= 0) {
      return { ok: false, error: "Each line needs an item and positive quantity." };
    }
  }
  /* delete existing then insert new — same transaction expectation;
     the FK cascade keeps bridge rows clean (none exist for drafts). */
  const { error: delErr } = await supabaseServer
    .from("inventory_transfer_items")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("transfer_id", transferId);
  if (delErr) return { ok: false, error: humanizeError(delErr.message) };
  if (items.length === 0) return { ok: true };
  const rows = items.map((it) => ({
    tenant_id: tenantId,
    transfer_id: transferId,
    inventory_item_id: it.inventory_item_id,
    quantity: it.quantity,
    unit_of_measure: it.unit_of_measure,
    notes: it.notes ?? null,
  }));
  const { error: insErr } = await supabaseServer
    .from("inventory_transfer_items")
    .insert(rows);
  if (insErr) return { ok: false, error: humanizeError(insErr.message) };
  return { ok: true };
}

/* ─── State transitions ─────────────────────────────────────── */

export async function transitionTransfer(
  tenantId: string,
  transferId: string,
  next: "pending" | "approved" | "cancelled",
  actorId: string | null,
): Promise<{ ok: boolean; transfer?: TransferRow; error?: string }> {
  const { data: existing } = await supabaseServer
    .from("inventory_transfers")
    .select("*")
    .eq("id", transferId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const cur = existing as TransferRow | null;
  if (!cur) return { ok: false, error: "Transfer not found." };
  const guard = nextStatusOk(cur.status, next);
  if (!guard.ok) return { ok: false, error: guard.error };

  /* For approved -> ensure there's at least one item. */
  if (next === "pending" || next === "approved") {
    const { count } = await supabaseServer
      .from("inventory_transfer_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("transfer_id", transferId);
    if (!count || count === 0) {
      return { ok: false, error: "Add at least one item before submitting." };
    }
  }

  const patch: Record<string, unknown> = { status: next };
  const now = new Date().toISOString();
  if (next === "pending") { patch.requested_by = actorId; patch.requested_at = now; }
  if (next === "approved") { patch.approved_by = actorId; patch.approved_at = now; }
  if (next === "cancelled") { patch.cancelled_by = actorId; patch.cancelled_at = now; }

  const { data, error } = await supabaseServer
    .from("inventory_transfers")
    .update(patch)
    .eq("id", transferId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();
  if (error) return { ok: false, error: humanizeError(error.message) };

  await logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action:
      next === "pending"   ? "transfer_submitted" as never :
      next === "approved"  ? "transfer_approved"  as never :
                             "transfer_cancelled" as never,
    entity_type: "transfer" as never,
    entity_id: transferId,
    metadata: { from: cur.status, to: next },
  });

  return { ok: true, transfer: data as TransferRow };
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

/* ─── Ship — atomic transfer_out batch ──────────────────────── */

export async function shipTransfer(
  tenantId: string,
  transferId: string,
  actorId: string | null,
): Promise<{ ok: boolean; error?: string; offending_item_id?: string }> {
  const detail = await getTransferDetail(tenantId, transferId);
  if (!detail) return { ok: false, error: "Transfer not found." };
  const { transfer, items, bridges } = detail;
  if (transfer.status !== "approved") {
    return { ok: false, error: "Only approved transfers can be shipped." };
  }
  if (items.length === 0) {
    return { ok: false, error: "Transfer has no items." };
  }

  /* Pre-flight: stock check for every line. */
  for (const line of items) {
    const onHand = await readOnHand(
      tenantId,
      line.inventory_item_id,
      transfer.source_warehouse_id,
    );
    if (onHand < Number(line.quantity)) {
      return {
        ok: false,
        error: `Not enough stock at the source warehouse for one of the items (have ${onHand}, need ${line.quantity}).`,
        offending_item_id: line.inventory_item_id,
      };
    }
  }

  /* Posting loop with manual unwind on partial failure. */
  const createdMovementIds: string[] = [];
  const upsertedBridgeIds: string[] = [];

  for (const line of items) {
    const created = await createInventoryMovement({
      tenant_id: tenantId,
      inventory_item_id: line.inventory_item_id,
      warehouse_id: transfer.source_warehouse_id,
      movement_type: "transfer_out" as MovementType,
      direction: "out",
      quantity: Number(line.quantity),
      unit: line.unit_of_measure,
      from_workflow: true,
      source_type: "inventory_transfer",
      source_id: line.id,
      reference: transfer.transfer_no,
      notes: line.notes ?? null,
      created_by: actorId,
      metadata: { transfer_id: transfer.id },
    });
    if (!created.ok || !created.movement) {
      await unwindShip(createdMovementIds, upsertedBridgeIds, tenantId, actorId);
      return { ok: false, error: humanizeError(created.error ?? "Ship failed."), offending_item_id: line.inventory_item_id };
    }
    const posted = await postInventoryMovement(created.movement.id, tenantId, actorId);
    if (!posted.ok) {
      await unwindShip([...createdMovementIds, created.movement.id], upsertedBridgeIds, tenantId, actorId);
      return { ok: false, error: humanizeError(posted.error ?? "Ship failed."), offending_item_id: line.inventory_item_id };
    }
    createdMovementIds.push(created.movement.id);

    /* Bridge row (upsert on transfer_item_id). */
    const existingBridge = bridges.find((b) => b.transfer_item_id === line.id);
    if (existingBridge) {
      const { error: upErr } = await supabaseServer
        .from("inventory_transfer_movements")
        .update({ transfer_out_movement_id: created.movement.id })
        .eq("id", existingBridge.id)
        .eq("tenant_id", tenantId);
      if (upErr) {
        await unwindShip(createdMovementIds, upsertedBridgeIds, tenantId, actorId);
        return { ok: false, error: humanizeError(upErr.message) };
      }
      upsertedBridgeIds.push(existingBridge.id);
    } else {
      const { data: brData, error: brErr } = await supabaseServer
        .from("inventory_transfer_movements")
        .insert({
          tenant_id: tenantId,
          transfer_id: transfer.id,
          transfer_item_id: line.id,
          transfer_out_movement_id: created.movement.id,
        })
        .select("id")
        .single();
      if (brErr) {
        await unwindShip(createdMovementIds, upsertedBridgeIds, tenantId, actorId);
        return { ok: false, error: humanizeError(brErr.message) };
      }
      upsertedBridgeIds.push((brData as { id: string }).id);
    }
  }

  /* All-good — promote transfer to "shipped". */
  const { error: stErr } = await supabaseServer
    .from("inventory_transfers")
    .update({
      status: "shipped" as TransferStatus,
      shipped_by: actorId,
      shipped_at: new Date().toISOString(),
    })
    .eq("id", transferId)
    .eq("tenant_id", tenantId);
  if (stErr) {
    await unwindShip(createdMovementIds, upsertedBridgeIds, tenantId, actorId);
    return { ok: false, error: humanizeError(stErr.message) };
  }

  await logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action: "transfer_shipped" as never,
    entity_type: "transfer" as never,
    entity_id: transferId,
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
  /* Best-effort void of every posted movement we created. */
  for (const id of movementIds) {
    try {
      await voidInventoryMovement(id, tenantId, actorId, "Atomic ship rollback");
    } catch {/* swallow — already-voided is fine */}
  }
  /* Bridge rows created in this run get their transfer_out cleared so
     the row isn't half-populated. We do NOT delete pre-existing bridge
     rows from prior failed runs. */
  for (const id of bridgeIds) {
    try {
      await supabaseServer
        .from("inventory_transfer_movements")
        .update({ transfer_out_movement_id: null })
        .eq("id", id)
        .eq("tenant_id", tenantId);
    } catch {/* swallow */}
  }
}

/* ─── Receive — atomic transfer_in batch ────────────────────── */

export async function receiveTransfer(
  tenantId: string,
  transferId: string,
  actorId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const detail = await getTransferDetail(tenantId, transferId);
  if (!detail) return { ok: false, error: "Transfer not found." };
  const { transfer, items, bridges } = detail;
  if (transfer.status !== "shipped") {
    return { ok: false, error: "Only shipped transfers can be received." };
  }
  if (items.length === 0) {
    return { ok: false, error: "Transfer has no items." };
  }

  const bridgeByItem = new Map(bridges.map((b) => [b.transfer_item_id, b]));

  /* Pre-flight: every item must have a posted transfer_out + unit_cost
     (for valuation continuity). */
  const movementIds = items.map((i) => bridgeByItem.get(i.id)?.transfer_out_movement_id).filter(Boolean) as string[];
  const { data: outMovementsData } = await supabaseServer
    .from("inventory_stock_movements")
    .select("id, unit_cost, currency, quantity, status, inventory_item_id")
    .in("id", movementIds.length ? movementIds : ["00000000-0000-0000-0000-000000000000"]);
  const outMovements = (outMovementsData ?? []) as Array<{
    id: string; unit_cost: number | null; currency: string; quantity: number;
    status: string; inventory_item_id: string;
  }>;
  const outById = new Map(outMovements.map((m) => [m.id, m]));

  const createdInMovementIds: string[] = [];

  for (const line of items) {
    const bridge = bridgeByItem.get(line.id);
    if (!bridge?.transfer_out_movement_id) {
      await unwindReceive(createdInMovementIds, tenantId, actorId);
      return { ok: false, error: "Transfer is in an inconsistent state — ship record missing." };
    }
    const outMv = outById.get(bridge.transfer_out_movement_id);
    if (!outMv || outMv.status !== "posted") {
      await unwindReceive(createdInMovementIds, tenantId, actorId);
      return { ok: false, error: "Shipment movement is not posted." };
    }
    const created = await createInventoryMovement({
      tenant_id: tenantId,
      inventory_item_id: line.inventory_item_id,
      warehouse_id: transfer.destination_warehouse_id,
      movement_type: "transfer_in" as MovementType,
      direction: "in",
      quantity: Number(line.quantity),
      unit: line.unit_of_measure,
      /* Carry the same unit_cost forward so valuation stays continuous
         across the transfer. The discipline guard requires a positive
         unit_cost for IN movements. */
      unit_cost: outMv.unit_cost ?? 0,
      currency: outMv.currency,
      from_workflow: true,
      source_type: "inventory_transfer",
      source_id: line.id,
      reference: transfer.transfer_no,
      notes: line.notes ?? null,
      created_by: actorId,
      metadata: { transfer_id: transfer.id, paired_out_movement_id: outMv.id },
    });
    if (!created.ok || !created.movement) {
      await unwindReceive(createdInMovementIds, tenantId, actorId);
      return { ok: false, error: humanizeError(created.error ?? "Receive failed.") };
    }
    const posted = await postInventoryMovement(created.movement.id, tenantId, actorId);
    if (!posted.ok) {
      await unwindReceive([...createdInMovementIds, created.movement.id], tenantId, actorId);
      return { ok: false, error: humanizeError(posted.error ?? "Receive failed.") };
    }
    createdInMovementIds.push(created.movement.id);

    /* Update bridge row with the in-movement id. */
    const { error: brErr } = await supabaseServer
      .from("inventory_transfer_movements")
      .update({ transfer_in_movement_id: created.movement.id })
      .eq("id", bridge.id)
      .eq("tenant_id", tenantId);
    if (brErr) {
      await unwindReceive(createdInMovementIds, tenantId, actorId);
      return { ok: false, error: humanizeError(brErr.message) };
    }
  }

  const { error: stErr } = await supabaseServer
    .from("inventory_transfers")
    .update({
      status: "received" as TransferStatus,
      received_by: actorId,
      received_at: new Date().toISOString(),
    })
    .eq("id", transferId)
    .eq("tenant_id", tenantId);
  if (stErr) {
    await unwindReceive(createdInMovementIds, tenantId, actorId);
    return { ok: false, error: humanizeError(stErr.message) };
  }

  await logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action: "transfer_received" as never,
    entity_type: "transfer" as never,
    entity_id: transferId,
    metadata: { movement_ids: createdInMovementIds },
  });

  return { ok: true };
}

async function unwindReceive(
  inMovementIds: string[],
  tenantId: string,
  actorId: string | null,
): Promise<void> {
  for (const id of inMovementIds) {
    try {
      await voidInventoryMovement(id, tenantId, actorId, "Atomic receive rollback");
    } catch {/* swallow */}
    try {
      await supabaseServer
        .from("inventory_transfer_movements")
        .update({ transfer_in_movement_id: null })
        .eq("transfer_in_movement_id", id)
        .eq("tenant_id", tenantId);
    } catch {/* swallow */}
  }
}

/* ─── Void (after ship/receive) ─────────────────────────────── */

export async function voidTransfer(
  tenantId: string,
  transferId: string,
  actorId: string | null,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "A void reason is required (min 3 characters)." };
  }
  const detail = await getTransferDetail(tenantId, transferId);
  if (!detail) return { ok: false, error: "Transfer not found." };
  const { transfer, bridges } = detail;
  if (transfer.status !== "shipped" && transfer.status !== "received") {
    return { ok: false, error: "Only shipped or received transfers can be voided. Use Cancel for drafts." };
  }

  /* Reverse every posted movement attached to this transfer. */
  const allIds: string[] = [];
  for (const b of bridges) {
    if (b.transfer_in_movement_id) allIds.push(b.transfer_in_movement_id);
    if (b.transfer_out_movement_id) allIds.push(b.transfer_out_movement_id);
  }
  for (const id of allIds) {
    const r = await voidInventoryMovement(id, tenantId, actorId, `Transfer voided: ${trimmed}`);
    if (!r.ok && !r.already_voided) {
      return { ok: false, error: humanizeError(r.error ?? "Void failed.") };
    }
  }

  const { error: stErr } = await supabaseServer
    .from("inventory_transfers")
    .update({
      status: "voided" as TransferStatus,
      voided_by: actorId,
      voided_at: new Date().toISOString(),
      void_reason: trimmed,
    })
    .eq("id", transferId)
    .eq("tenant_id", tenantId);
  if (stErr) return { ok: false, error: humanizeError(stErr.message) };

  await logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action: "transfer_voided" as never,
    entity_type: "transfer" as never,
    entity_id: transferId,
    metadata: { reason: trimmed, reversed_movement_ids: allIds },
  });

  return { ok: true };
}

/* ─── Helpers for routes ────────────────────────────────────── */

export async function resolveTransferLinkForMovement(
  tenantId: string,
  movementId: string,
): Promise<{ transfer_id: string; transfer_no: string } | null> {
  const { data } = await supabaseServer
    .from("inventory_transfer_movements")
    .select("transfer_id, inventory_transfers!inner(transfer_no)")
    .eq("tenant_id", tenantId)
    .or(`transfer_out_movement_id.eq.${movementId},transfer_in_movement_id.eq.${movementId}`)
    .maybeSingle();
  if (!data) return null;
  const row = data as { transfer_id: string; inventory_transfers: { transfer_no: string } | { transfer_no: string }[] };
  const noRaw = row.inventory_transfers;
  const transferNo = Array.isArray(noRaw) ? noRaw[0]?.transfer_no : noRaw?.transfer_no;
  return { transfer_id: row.transfer_id, transfer_no: transferNo ?? "" };
}

/* Type re-exports for movement bridging (used by detail page). */
export type { StockMovement };
