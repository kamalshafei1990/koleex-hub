import "server-only";

/* ===========================================================================
   Phase O.2.1 — Inventory posting engine (re-keyed onto inventory_item_id).

   Three public functions:

     createInventoryMovement()   build + insert a DRAFT movement row.
     postInventoryMovement()     promote a draft to POSTED.
     voidInventoryMovement()     void a posted movement via a reversing
                                  draft posted in the same transaction.

   `inventory_item_id` is now the universal subject of every movement.
   Products no longer feature in this layer at all — Phase O.3 must
   first resolve a product to its inventory_item via
   `ensureInventoryItemForProduct` (see items.ts) before posting.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import {
  type CreateMovementInput,
  type Direction,
  type PostMovementResult,
  type StockMovement,
  type VoidMovementResult,
  directionForType,
} from "./types";
import {
  guardStockValue,
  guardDocumentGenerated,
  guardOpeningBalanceUnique,
  guardPostingApproval,
  requiresApproval,
} from "./discipline";
import { logInventoryAudit } from "./audit";
import { applyBatchMovement } from "./variants";
import { validateSerialMovement, moveSerials, reverseSerialMovement } from "./serials";

export async function ensureDefaultWarehouse(tenantId: string): Promise<string> {
  const { data, error } = await supabaseServer.rpc("fn_inventory_ensure_default_warehouse", {
    p_tenant_id: tenantId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

function generateMovementNo(movementType: string, date: Date): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const tail = (Date.now().toString(16) + Math.random().toString(16).slice(2))
    .replace(/\./g, "")
    .slice(-6)
    .toUpperCase();
  const prefix =
    movementType === "opening_balance"  ? "IM-OB"  :
    movementType === "purchase_receipt" ? "IM-GR"  :
    movementType === "sales_shipment"   ? "IM-SH"  :
    movementType.startsWith("adjustment") ? "IM-ADJ" :
    movementType.startsWith("transfer")   ? "IM-TRF" :
    movementType.startsWith("return")     ? "IM-RTN" :
    "IM-MAN";
  return `${prefix}-${ymd}-${tail}`;
}

export async function createInventoryMovement(input: CreateMovementInput): Promise<{
  ok: boolean;
  movement?: StockMovement;
  error?: string;
  code?: string;
}> {
  if (!input.tenant_id) return { ok: false, error: "tenant_id required" };
  if (!input.inventory_item_id) return { ok: false, error: "inventory_item_id required" };
  if (!input.movement_type) return { ok: false, error: "movement_type required" };
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: "quantity must be a positive number" };
  }

  const direction: Direction | null =
    input.direction ?? directionForType(input.movement_type);
  if (!direction) {
    return { ok: false, error: `direction required for ${input.movement_type}` };
  }

  /* INV-H2 Scope 4 — block document-generated movement types when the
     call did NOT come from a workflow page (purchase receive, sales
     ship, etc). The workflow caller passes from_workflow=true and the
     required source_type/source_id. */
  const docGuard = guardDocumentGenerated({
    movement_type: input.movement_type,
    source_type: input.source_type ?? null,
    source_id: input.source_id ?? null,
    from_workflow: !!input.from_workflow,
  });
  if (!docGuard.ok) {
    return { ok: false, error: docGuard.error, code: docGuard.code };
  }

  const baseCcy = await resolveBaseCurrency(input.tenant_id);
  const effectiveCcy = input.currency ?? baseCcy;

  /* INV-H2 Scope 1 — mandatory stock value on IN movements. */
  const valGuard = guardStockValue({
    movement_type: input.movement_type,
    direction,
    quantity: input.quantity,
    unit_cost: input.unit_cost ?? null,
    currency: effectiveCcy,
    metadata: input.metadata,
  });
  if (!valGuard.ok) {
    return { ok: false, error: valGuard.error, code: valGuard.code };
  }

  const warehouseId = input.warehouse_id ?? (await ensureDefaultWarehouse(input.tenant_id));

  /* INV-H4B — if item has track_serials=true, enforce serial discipline
     BEFORE inserting the draft (refuse cleanly with a humanised error).
     For IN movements where the caller did NOT pass serial_ids but
     track_serials=true, we still allow the draft — the engine creates
     serials per serial_no via callers (e.g. purchase receive). The
     hard quantity-vs-count check only fires when an id list is given. */
  let trackSerialsItem = false;
  {
    const { data: itemRow } = await supabaseServer
      .from("inventory_items")
      .select("track_serials")
      .eq("tenant_id", input.tenant_id)
      .eq("id", input.inventory_item_id)
      .maybeSingle();
    trackSerialsItem = !!(itemRow as { track_serials?: boolean } | null)?.track_serials;
  }
  if (trackSerialsItem && input.serial_ids && input.serial_ids.length > 0) {
    const v = await validateSerialMovement(input.tenant_id, {
      inventory_item_id: input.inventory_item_id,
      movement_type: input.movement_type,
      direction,
      quantity: input.quantity,
      warehouse_id: warehouseId,
      serial_ids: input.serial_ids,
    });
    if (!v.ok) return { ok: false, error: v.error, code: "INV_H4B_SERIAL_INVALID" };
  } else if (trackSerialsItem && direction === "out") {
    /* OUT movements on serial-tracked items REQUIRE explicit serial ids. */
    return {
      ok: false,
      error: "This item tracks serial numbers. Pick the exact serial(s) being shipped.",
      code: "INV_H4B_SERIALS_REQUIRED",
    };
  }

  /* INV-H2 Scope 2 — at most one opening_balance per (item, warehouse). */
  if (input.movement_type === "opening_balance") {
    const obGuard = await guardOpeningBalanceUnique({
      tenant_id: input.tenant_id,
      inventory_item_id: input.inventory_item_id,
      warehouse_id: warehouseId,
    });
    if (!obGuard.ok) {
      return { ok: false, error: obGuard.error, code: obGuard.code };
    }
  }

  const date = input.movement_date ? new Date(input.movement_date) : new Date();
  const movementDate = date.toISOString().slice(0, 10);
  const movementNo = generateMovementNo(input.movement_type, date);

  /* Source idempotency probe. For most workflows, (source_type, source_id)
     is unique per direction (e.g. purchase_receipt_item only ever drives
     an IN). Transfers are different: the same transfer_item_id drives
     BOTH a transfer_out (at ship) AND a transfer_in (at receive). Cut the
     probe by movement_type when the source is a transfer so the receive
     side doesn't accidentally match the ship side. */
  if (input.source_type && input.source_id) {
    let probe = supabaseServer
      .from("inventory_stock_movements")
      .select("*")
      .eq("tenant_id", input.tenant_id)
      .eq("source_type", input.source_type)
      .eq("source_id", input.source_id)
      .neq("status", "voided");
    if (input.source_type === "inventory_transfer") {
      probe = probe.eq("movement_type", input.movement_type);
    }
    const { data: existing } = await probe.maybeSingle();
    if (existing) {
      return { ok: true, movement: existing as StockMovement };
    }
  }

  /* INV-H2 Scope 3 — approval state for manual / adjustment movements.
     Caller passes pre_approved=true when the actor has the
     can_approve_adjustments permission and explicitly opted to approve
     while drafting. Otherwise the row enters approval_status='pending'
     and posting is blocked until approved. */
  const needsApproval = requiresApproval(input.movement_type);
  const approvalStatus = needsApproval
    ? (input.pre_approved ? "approved" : "pending")
    : "not_required";

  /* Merge adjustment_reason / zero_value_reason into metadata for audit. */
  const mergedMeta: Record<string, unknown> = { ...(input.metadata ?? {}) };
  if (input.adjustment_reason) mergedMeta.adjustment_reason = input.adjustment_reason;

  const { data, error } = await supabaseServer
    .from("inventory_stock_movements")
    .insert({
      tenant_id: input.tenant_id,
      movement_no: movementNo,
      movement_date: movementDate,
      inventory_item_id: input.inventory_item_id,
      warehouse_id: warehouseId,
      movement_type: input.movement_type,
      direction,
      quantity: input.quantity,
      unit: input.unit ?? "pcs",
      unit_cost: input.unit_cost ?? null,
      currency: effectiveCcy,
      source_type: input.source_type ?? null,
      source_id: input.source_id ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      status: "draft",
      approval_status: approvalStatus,
      approved_by: needsApproval && input.pre_approved ? (input.created_by ?? null) : null,
      approved_at: needsApproval && input.pre_approved ? new Date().toISOString() : null,
      created_by: input.created_by ?? null,
      metadata: mergedMeta,
      /* INV-H4A — optional variant + batch (NULL = item-level back-compat). */
      variant_id: input.variant_id ?? null,
      batch_id: input.batch_id ?? null,
      /* INV-H4B — optional serial ids (NULL when item does not track). */
      serial_ids: input.serial_ids && input.serial_ids.length > 0 ? input.serial_ids : null,
    })
    .select("*")
    .single();

  if (error) {
    const msg = error.message ?? "Insert failed";
    if (error.code === "23505" && /uq_inv_mv_source/.test(msg)) {
      return { ok: false, error: "Movement already exists for this source" };
    }
    if (error.code === "23505" && /uq_inv_movements_one_opening_balance/.test(msg)) {
      return {
        ok: false,
        error: "Opening balance already exists. Use an adjustment instead.",
        code: "INV_H2_OPENING_BALANCE_DUPLICATE",
      };
    }
    /* INV-H4A — humanize variant/batch integrity errors. */
    if (/INV_H4A_MOVEMENT_VARIANT_ITEM_MISMATCH/.test(msg)) {
      return { ok: false, error: "Variant does not belong to this item.", code: "INV_H4A_VARIANT_ITEM_MISMATCH" };
    }
    if (/INV_H4A_MOVEMENT_BATCH_ITEM_MISMATCH/.test(msg)) {
      return { ok: false, error: "Batch does not belong to this item.", code: "INV_H4A_BATCH_ITEM_MISMATCH" };
    }
    if (/INV_H4A_MOVEMENT_BATCH_VARIANT_MISMATCH/.test(msg)) {
      return { ok: false, error: "Batch does not match the chosen variant.", code: "INV_H4A_BATCH_VARIANT_MISMATCH" };
    }
    if (/INV_H4A_MOVEMENT_BATCH_MISSING/.test(msg)) {
      return { ok: false, error: "Batch does not exist.", code: "INV_H4A_BATCH_MISSING" };
    }
    return { ok: false, error: msg };
  }

  const created = data as StockMovement;

  /* Audit — draft created. */
  await logInventoryAudit({
    tenant_id: input.tenant_id,
    actor_id: input.created_by ?? null,
    action: "movement_draft_created",
    entity_type: "movement",
    entity_id: created.id,
    metadata: {
      movement_type: input.movement_type,
      quantity: input.quantity,
      unit_cost: input.unit_cost ?? null,
      approval_status: approvalStatus,
      from_workflow: !!input.from_workflow,
      adjustment_reason: input.adjustment_reason ?? null,
      zero_value_override: (mergedMeta.admin_zero_value_override === true) || false,
    },
  });

  return { ok: true, movement: created };
}

/** INV-H2 — Posting gate. Loads the draft first, runs the approval guard,
 *  then delegates to the RPC. */
export async function postInventoryMovement(
  movementId: string,
  tenantId: string,
  postedBy: string | null,
): Promise<PostMovementResult> {
  /* Fetch the draft to inspect movement_type + approval_status. */
  const { data: draft } = await supabaseServer
    .from("inventory_stock_movements")
    .select("movement_type, approval_status, status")
    .eq("id", movementId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const d = draft as {
    movement_type: import("./types").MovementType;
    approval_status: string;
    status: string;
  } | null;
  if (d && d.status === "draft") {
    const approvalGuard = guardPostingApproval({
      movement_type: d.movement_type,
      approval_status: d.approval_status ?? "not_required",
      is_super_admin: false, // SA gate happens in the route handler
      can_approve: false,
    });
    if (!approvalGuard.ok) {
      return { ok: false, error: approvalGuard.error, code: 409 };
    }
  }

  /* INV-H4A — pre-check batch capacity for OUT-with-batch movements so we
     can refuse cleanly BEFORE the post RPC mutates balances. */
  if (d?.status === "draft") {
    const { data: row } = await supabaseServer
      .from("inventory_stock_movements")
      .select("batch_id, direction, quantity")
      .eq("id", movementId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const r = row as { batch_id: string | null; direction: "in" | "out"; quantity: number } | null;
    if (r?.batch_id && r.direction === "out") {
      const { data: batchRow } = await supabaseServer
        .from("inventory_batches")
        .select("quantity_remaining, batch_no")
        .eq("tenant_id", tenantId)
        .eq("id", r.batch_id)
        .maybeSingle();
      const remaining = Number((batchRow as { quantity_remaining: number } | null)?.quantity_remaining ?? 0);
      if (remaining < Number(r.quantity)) {
        const no = (batchRow as { batch_no: string } | null)?.batch_no ?? r.batch_id;
        return {
          ok: false,
          error: `Batch ${no} only has ${remaining} remaining (cannot ship ${r.quantity}).`,
          code: 409,
        };
      }
    }
  }

  const { data, error } = await supabaseServer.rpc("fn_inventory_post_movement", {
    p_movement_id: movementId,
    p_tenant_id: tenantId,
    p_posted_by: postedBy,
  });
  if (error) return { ok: false, error: error.message, code: 500 };
  const result = (data ?? { ok: false, error: "No response from posting RPC" }) as PostMovementResult;
  if (result.ok && !result.already_posted) {
    /* INV-H4A — sync batch.quantity_remaining for posted movements that
       carry a batch reference. */
    const { data: posted } = await supabaseServer
      .from("inventory_stock_movements")
      .select("batch_id, direction, quantity")
      .eq("id", movementId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const pRow = posted as { batch_id: string | null; direction: "in" | "out"; quantity: number } | null;
    if (pRow?.batch_id) {
      const delta = pRow.direction === "in" ? Number(pRow.quantity) : -Number(pRow.quantity);
      await applyBatchMovement(tenantId, pRow.batch_id, delta);
    }
    /* INV-H4B — apply serial state changes if the movement carries any. */
    const { data: postedFull } = await supabaseServer
      .from("inventory_stock_movements")
      .select("id, movement_type, direction, warehouse_id, serial_ids, posted_at, metadata")
      .eq("id", movementId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const pFull = postedFull as {
      id: string;
      movement_type: import("./types").MovementType;
      direction: import("./types").Direction;
      warehouse_id: string;
      serial_ids: string[] | null;
      posted_at: string | null;
      metadata: Record<string, unknown> | null;
    } | null;
    if (pFull?.serial_ids && pFull.serial_ids.length > 0) {
      const meta = (pFull.metadata ?? {}) as Record<string, unknown>;
      await moveSerials(tenantId, pFull.serial_ids, {
        movementId: pFull.id,
        ctx: {
          movement_type: pFull.movement_type,
          direction: pFull.direction,
          warehouse_id: pFull.warehouse_id,
          posted_at: pFull.posted_at,
          customer_id: (meta.customer_id as string | undefined) ?? null,
          supplier_id: (meta.supplier_id as string | undefined) ?? null,
          disposition: (meta.disposition as "restock" | "quarantine" | "scrap" | "vendor_return" | undefined) ?? null,
          scrap_intent:
            (meta.adjustment_reason as string | undefined) === "scrap" ||
            (meta.scrap_intent as boolean | undefined) === true,
        },
      });
    }
    await logInventoryAudit({
      tenant_id: tenantId,
      actor_id: postedBy,
      action: "movement_posted",
      entity_type: "movement",
      entity_id: movementId,
      metadata: { qty_before: result.qty_before, qty_after: result.qty_after },
    });
  }
  return result;
}

/** INV-H2 — Void with reason + permission gate. The route handler runs
 *  the permission guard; this function still enforces a non-empty
 *  reason and logs the action. Idempotent on already-voided. */
export async function voidInventoryMovement(
  movementId: string,
  tenantId: string,
  voidedBy: string | null,
  reason: string | null,
): Promise<VoidMovementResult> {
  /* Empty-reason guard at the storage layer so any caller — workflow
     or generic — must supply one. */
  const trimmedReason = (reason ?? "").trim();
  if (trimmedReason.length < 3) {
    /* Allow the RPC to short-circuit on already-voided rows without a
       reason — peek first. */
    const { data: row } = await supabaseServer
      .from("inventory_stock_movements")
      .select("status")
      .eq("id", movementId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if ((row as { status: string } | null)?.status === "voided") {
      return { ok: true, already_voided: true, movement_id: movementId };
    }
    return { ok: false, error: "A void reason is required (min 3 characters).", code: 422 };
  }

  /* INV-H4A — capture batch+direction BEFORE void so we can reverse the
     batch.quantity_remaining effect. INV-H4B — also capture serial_ids. */
  const { data: preVoid } = await supabaseServer
    .from("inventory_stock_movements")
    .select("batch_id, direction, quantity, status, serial_ids")
    .eq("id", movementId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const preRow = preVoid as {
    batch_id: string | null;
    direction: "in" | "out";
    quantity: number;
    status: string;
    serial_ids: string[] | null;
  } | null;

  const { data, error } = await supabaseServer.rpc("fn_inventory_void_movement", {
    p_movement_id: movementId,
    p_tenant_id: tenantId,
    p_voided_by: voidedBy,
    p_reason: trimmedReason,
  });
  if (error) return { ok: false, error: error.message, code: 500 };
  const result = (data ?? { ok: false, error: "No response from void RPC" }) as VoidMovementResult;
  if (result.ok && !result.already_voided) {
    /* Reverse batch.quantity_remaining if the voided movement had a batch
       AND was previously posted. */
    if (preRow?.batch_id && preRow.status === "posted") {
      const delta = preRow.direction === "in" ? -Number(preRow.quantity) : Number(preRow.quantity);
      await applyBatchMovement(tenantId, preRow.batch_id, delta);
    }
    /* INV-H4B — reverse serial state changes if any were applied. */
    if (preRow?.serial_ids && preRow.serial_ids.length > 0 && preRow.status === "posted") {
      await reverseSerialMovement(tenantId, preRow.serial_ids);
    }
    await logInventoryAudit({
      tenant_id: tenantId,
      actor_id: voidedBy,
      action: "movement_voided",
      entity_type: "movement",
      entity_id: movementId,
      metadata: { reason: trimmedReason, reverse_movement_id: result.reverse_movement_id ?? null },
    });
  }
  return result;
}

/* ─── rebuildStockBalance — repair tool ─────────────────────── */
export async function rebuildStockBalance(
  tenantId: string,
  inventoryItemId: string,
  warehouseId: string,
): Promise<{ ok: boolean; qty_on_hand: number; previous: number | null }> {
  const { data: movements, error } = await supabaseServer
    .from("inventory_stock_movements")
    .select("direction, quantity, status")
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", inventoryItemId)
    .eq("warehouse_id", warehouseId)
    .in("status", ["posted", "voided"])
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const rebuilt = (movements ?? []).reduce((acc, m) => {
    const r = m as { direction: "in" | "out"; quantity: number };
    const q = Number(r.quantity) || 0;
    return acc + (r.direction === "in" ? q : -q);
  }, 0);
  const safe = rebuilt < 0 ? 0 : rebuilt;

  const { data: prev } = await supabaseServer
    .from("inventory_stock_balances")
    .select("qty_on_hand")
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", inventoryItemId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();
  const previous = prev ? Number((prev as { qty_on_hand: number }).qty_on_hand) : null;

  const { error: upErr } = await supabaseServer
    .from("inventory_stock_balances")
    .upsert(
      {
        tenant_id: tenantId,
        inventory_item_id: inventoryItemId,
        warehouse_id: warehouseId,
        qty_on_hand: safe,
      },
      { onConflict: "tenant_id,inventory_item_id,warehouse_id" },
    );
  if (upErr) throw new Error(upErr.message);

  return { ok: true, qty_on_hand: safe, previous };
}

export async function createAndPostInventoryMovement(
  input: CreateMovementInput,
): Promise<{
  ok: boolean;
  movement?: StockMovement;
  post?: PostMovementResult;
  error?: string;
}> {
  const created = await createInventoryMovement(input);
  if (!created.ok || !created.movement) return { ok: false, error: created.error };

  const posted = await postInventoryMovement(
    created.movement.id,
    input.tenant_id,
    input.created_by ?? null,
  );
  if (!posted.ok) {
    return { ok: false, movement: created.movement, post: posted, error: posted.error };
  }

  const { data: fresh } = await supabaseServer
    .from("inventory_stock_movements")
    .select("*")
    .eq("id", created.movement.id)
    .eq("tenant_id", input.tenant_id)
    .maybeSingle();
  return { ok: true, movement: (fresh as StockMovement) ?? created.movement, post: posted };
}
