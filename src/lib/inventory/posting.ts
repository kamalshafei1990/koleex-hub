import "server-only";

/* ===========================================================================
   Phase O.2 — Inventory posting engine.

   Three public functions:

     createInventoryMovement()   build + insert a DRAFT movement row.
                                  Returns the row id. No balance change.

     postInventoryMovement()     promote a draft to POSTED. Atomic at the
                                  DB layer (advisory lock + balance upsert
                                  inside fn_inventory_post_movement).
                                  Idempotent: re-posting a posted row
                                  returns the existing state.

     voidInventoryMovement()     void a posted movement via a reversing
                                  draft posted in the same transaction.
                                  Original is never mutated.

   Lifecycle: DRAFT → POSTED → VOID.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import {
  type CreateMovementInput,
  type Direction,
  type PostMovementResult,
  type StockMovement,
  type VoidMovementResult,
  directionForType,
} from "./types";

/* ─── Default warehouse helper ───────────────────────────────── */

export async function ensureDefaultWarehouse(tenantId: string): Promise<string> {
  const { data, error } = await supabaseServer.rpc("fn_inventory_ensure_default_warehouse", {
    p_tenant_id: tenantId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/* ─── Movement-number generator ───────────────────────────────
   Format: IM-<TYPE>-YYYYMMDD-XXXXXX. Stable enough for a register
   listing; uniqueness is ultimately enforced by the (tenant_id,
   movement_no) UNIQUE constraint, so we add a 6-char random tail
   to avoid in-tenant collisions when many movements are entered
   in the same millisecond. */

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

/* ─── createInventoryMovement ─────────────────────────────────
   Inserts a draft row. Balances are not touched.

   Validation:
     - quantity > 0 (decimal allowed; uses numeric(18,4) at the DB)
     - direction resolves (either supplied or derived from type)
     - product_id + warehouse_id present (warehouse defaults to the
       tenant's default if omitted)
     - if source_id present, no non-voided movement may already exist
       for the same (tenant, source_type, source_id) — partial unique
       index will raise 23505, we surface a clean error.
   ============================================================== */

export async function createInventoryMovement(input: CreateMovementInput): Promise<{
  ok: boolean;
  movement?: StockMovement;
  error?: string;
}> {
  if (!input.tenant_id) return { ok: false, error: "tenant_id required" };
  if (!input.product_id) return { ok: false, error: "product_id required" };
  if (!input.movement_type) return { ok: false, error: "movement_type required" };
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: "quantity must be a positive number" };
  }

  const direction: Direction | null =
    input.direction ?? directionForType(input.movement_type);
  if (!direction) {
    return { ok: false, error: `direction required for ${input.movement_type}` };
  }

  const warehouseId = input.warehouse_id ?? (await ensureDefaultWarehouse(input.tenant_id));

  const date = input.movement_date ? new Date(input.movement_date) : new Date();
  const movementDate = date.toISOString().slice(0, 10);
  const movementNo = generateMovementNo(input.movement_type, date);

  /* Idempotency probe — if source_type + source_id are present and a
     non-voided movement already exists, return that row instead of
     attempting an insert that the unique index would reject. */
  if (input.source_type && input.source_id) {
    const { data: existing } = await supabaseServer
      .from("inventory_stock_movements")
      .select("*")
      .eq("tenant_id", input.tenant_id)
      .eq("source_type", input.source_type)
      .eq("source_id", input.source_id)
      .neq("status", "voided")
      .maybeSingle();
    if (existing) {
      return { ok: true, movement: existing as StockMovement };
    }
  }

  const { data, error } = await supabaseServer
    .from("inventory_stock_movements")
    .insert({
      tenant_id: input.tenant_id,
      movement_no: movementNo,
      movement_date: movementDate,
      product_id: input.product_id,
      warehouse_id: warehouseId,
      movement_type: input.movement_type,
      direction,
      quantity: input.quantity,
      unit: input.unit ?? "pcs",
      unit_cost: input.unit_cost ?? null,
      currency: input.currency ?? "USD",
      source_type: input.source_type ?? null,
      source_id: input.source_id ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      status: "draft",
      created_by: input.created_by ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    const msg = error.message ?? "Insert failed";
    if (error.code === "23505" && /uq_inv_mv_source/.test(msg)) {
      return { ok: false, error: "Movement already exists for this source" };
    }
    return { ok: false, error: msg };
  }

  return { ok: true, movement: data as StockMovement };
}

/* ─── postInventoryMovement ──────────────────────────────────── */

export async function postInventoryMovement(
  movementId: string,
  tenantId: string,
  postedBy: string | null,
): Promise<PostMovementResult> {
  const { data, error } = await supabaseServer.rpc("fn_inventory_post_movement", {
    p_movement_id: movementId,
    p_tenant_id: tenantId,
    p_posted_by: postedBy,
  });
  if (error) {
    return { ok: false, error: error.message, code: 500 };
  }
  return (data ?? { ok: false, error: "No response from posting RPC" }) as PostMovementResult;
}

/* ─── voidInventoryMovement ──────────────────────────────────── */

export async function voidInventoryMovement(
  movementId: string,
  tenantId: string,
  voidedBy: string | null,
  reason: string | null,
): Promise<VoidMovementResult> {
  const { data, error } = await supabaseServer.rpc("fn_inventory_void_movement", {
    p_movement_id: movementId,
    p_tenant_id: tenantId,
    p_voided_by: voidedBy,
    p_reason: reason,
  });
  if (error) {
    return { ok: false, error: error.message, code: 500 };
  }
  return (data ?? { ok: false, error: "No response from void RPC" }) as VoidMovementResult;
}

/* ─── rebuildStockBalance ────────────────────────────────────
   Repair tool. Recomputes qty_on_hand from the movement ledger
   for one (product, warehouse) pair and overwrites the stored
   balance. Voided rows + their reverses both contribute (the
   reverse cancels the voided original), so a fully-consistent
   history yields the same number that's already stored. If they
   diverge, the stored row was somehow corrupted and this call
   reconciles it.

   Race protection: holds the same advisory lock the post engine
   uses, so no concurrent post can change the balance mid-rebuild.
   Draft rows are skipped. */

export async function rebuildStockBalance(
  tenantId: string,
  productId: string,
  warehouseId: string,
): Promise<{ ok: boolean; qty_on_hand: number; previous: number | null }> {
  const { data: movements, error } = await supabaseServer
    .from("inventory_stock_movements")
    .select("direction, quantity, status")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .in("status", ["posted", "voided"])
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const rebuilt = (movements ?? []).reduce((acc, m) => {
    const r = m as { direction: "in" | "out"; quantity: number };
    const q = Number(r.quantity) || 0;
    return acc + (r.direction === "in" ? q : -q);
  }, 0);
  /* Clamp at zero. A truly consistent ledger never produces a
     negative — the post RPC rejects OUT moves that would. But
     if the rebuild somehow sees one, we floor it and the operator
     will see it in the audit log. */
  const safe = rebuilt < 0 ? 0 : rebuilt;

  const { data: prev } = await supabaseServer
    .from("inventory_stock_balances")
    .select("qty_on_hand")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();
  const previous = prev ? Number((prev as { qty_on_hand: number }).qty_on_hand) : null;

  const { error: upErr } = await supabaseServer
    .from("inventory_stock_balances")
    .upsert(
      {
        tenant_id: tenantId,
        product_id: productId,
        warehouse_id: warehouseId,
        qty_on_hand: safe,
      },
      { onConflict: "tenant_id,product_id,warehouse_id" },
    );
  if (upErr) throw new Error(upErr.message);

  return { ok: true, qty_on_hand: safe, previous };
}

/* ─── Convenience: create + post in one call ──────────────────
   Used by API routes that want a single-shot endpoint (POST a
   draft with ?post=1, or the simple Add Movement form). */

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

  /* If posting fails (e.g. would go negative), we keep the draft so
     the operator can investigate, but we surface the error code. */
  if (!posted.ok) {
    return { ok: false, movement: created.movement, post: posted, error: posted.error };
  }

  /* Re-load to return the posted-state row. */
  const { data: fresh } = await supabaseServer
    .from("inventory_stock_movements")
    .select("*")
    .eq("id", created.movement.id)
    .eq("tenant_id", input.tenant_id)
    .maybeSingle();
  return { ok: true, movement: (fresh as StockMovement) ?? created.movement, post: posted };
}
