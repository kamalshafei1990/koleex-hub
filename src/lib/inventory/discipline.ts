import "server-only";

/* ===========================================================================
   INV-H2 — Inventory discipline guards.

   Centralised rule enforcement for movement / item / warehouse operations.
   Each guard returns either `{ ok: true }` or `{ ok: false, error, code }`.

   These functions are the single source of truth for the rules listed in
   the INV-H2 scope brief. They DO NOT mutate state — they only check.
   The route handlers and the posting library compose them with the
   audit log to produce a complete, traceable control surface.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { MovementType } from "./types";

/* ─── Movement type classification ──────────────────────────── */

/** Movement types that ADD stock — must carry a non-zero unit_cost
 *  unless an admin override is supplied. */
export const STOCK_ADDING_TYPES: MovementType[] = [
  "opening_balance",
  "purchase_receipt",
  "adjustment_in",
  "return_in",
  /* "manual" with direction='in' also adds — handled dynamically. */
];

/** Movement types that may ONLY be created by upstream documents
 *  (purchase receipts, sales shipments, transfers, returns). They
 *  must carry source_type + source_id, and direct creation from the
 *  generic movement form is blocked. */
export const DOCUMENT_GENERATED_TYPES: MovementType[] = [
  "purchase_receipt",
  "sales_shipment",
  "return_in",
  "return_out",
  "transfer_in",
  "transfer_out",
];

/** Movement types that require approval before posting. */
export const APPROVAL_REQUIRED_TYPES: MovementType[] = [
  "manual",
  "adjustment_in",
  "adjustment_out",
];

export function isStockAdding(type: MovementType, direction?: "in" | "out"): boolean {
  if (STOCK_ADDING_TYPES.includes(type)) return true;
  if (type === "manual" && direction === "in") return true;
  return false;
}

export function isDocumentGenerated(type: MovementType): boolean {
  return DOCUMENT_GENERATED_TYPES.includes(type);
}

export function requiresApproval(type: MovementType): boolean {
  return APPROVAL_REQUIRED_TYPES.includes(type);
}

/* ─── Scope 1 — Mandatory stock value ───────────────────────── */

export interface ValueGuardInput {
  movement_type: MovementType;
  direction?: "in" | "out";
  quantity: number;
  unit_cost: number | null | undefined;
  currency: string | null | undefined;
  metadata?: Record<string, unknown>;
}

export interface GuardResult {
  ok: boolean;
  error?: string;
  code?: string;
}

export function guardStockValue(input: ValueGuardInput): GuardResult {
  if (!isStockAdding(input.movement_type, input.direction)) return { ok: true };
  if (input.quantity <= 0) return { ok: true };

  const meta = (input.metadata ?? {}) as Record<string, unknown>;
  const override = meta.admin_zero_value_override === true;
  const reason = typeof meta.zero_value_reason === "string"
    ? (meta.zero_value_reason as string).trim()
    : "";

  const hasCost = input.unit_cost != null && Number(input.unit_cost) > 0;
  const hasCcy = !!input.currency && String(input.currency).trim().length > 0;

  if (hasCost && hasCcy) return { ok: true };

  if (override) {
    if (!reason || reason.length < 3) {
      return {
        ok: false,
        error: "Admin zero-value override requires a reason in metadata.zero_value_reason.",
        code: "INV_H2_ZERO_VALUE_REASON_REQUIRED",
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    error: "Inventory value is required before stock can be added.",
    code: "INV_H2_VALUE_REQUIRED",
  };
}

/* ─── Scope 4 — Document-generated movement protection ─────── */

export interface DocumentSourceGuardInput {
  movement_type: MovementType;
  source_type: string | null | undefined;
  source_id: string | null | undefined;
  /** When false, the route is the generic /api/inventory/movements path
   *  and document-generated types must be refused. When true, the call
   *  came from a workflow (purchase receive, sales ship, transfer, …)
   *  and source_type/source_id are already attached. */
  from_workflow: boolean;
}

export function guardDocumentGenerated(input: DocumentSourceGuardInput): GuardResult {
  if (!isDocumentGenerated(input.movement_type)) return { ok: true };

  if (!input.from_workflow) {
    return {
      ok: false,
      error: "Use the related workflow to create this inventory movement.",
      code: "INV_H2_USE_WORKFLOW",
    };
  }
  if (!input.source_type || !input.source_id) {
    return {
      ok: false,
      error: "Workflow movements require source_type and source_id.",
      code: "INV_H2_SOURCE_REQUIRED",
    };
  }
  return { ok: true };
}

/* ─── Scope 2 — Opening balance one-time rule ──────────────── */

export interface OpeningBalanceGuardInput {
  tenant_id: string;
  inventory_item_id: string;
  warehouse_id: string;
}

export async function guardOpeningBalanceUnique(
  input: OpeningBalanceGuardInput,
): Promise<GuardResult> {
  /* Mirror the DB index: skip voided rows and skip auto-generated reverse
     entries (reverses_movement_id is not null) and OUT-direction rows
     (the reverse of an opening_balance is type=opening_balance, dir=out). */
  const { data, error } = await supabaseServer
    .from("inventory_stock_movements")
    .select("id, status, direction, reverses_movement_id")
    .eq("tenant_id", input.tenant_id)
    .eq("inventory_item_id", input.inventory_item_id)
    .eq("warehouse_id", input.warehouse_id)
    .eq("movement_type", "opening_balance")
    .eq("direction", "in")
    .is("reverses_movement_id", null)
    .neq("status", "voided")
    .limit(1);
  if (error) return { ok: false, error: error.message, code: "INV_H2_DB" };
  if ((data ?? []).length > 0) {
    return {
      ok: false,
      error: "Opening balance already exists. Use an adjustment instead.",
      code: "INV_H2_OPENING_BALANCE_DUPLICATE",
    };
  }
  return { ok: true };
}

/* ─── Scope 6 — Stock profile edit / archive guards ────────── */

export interface ProfileGuardContext {
  tenant_id: string;
  inventory_item_id: string;
}

/** Returns sum of qty_on_hand across all warehouses for this item. */
async function totalOnHand(
  tenantId: string,
  inventoryItemId: string,
): Promise<number> {
  const { data, error } = await supabaseServer
    .from("inventory_stock_balances")
    .select("qty_on_hand")
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", inventoryItemId);
  if (error) return 0;
  return ((data ?? []) as Array<{ qty_on_hand: number | string }>).reduce(
    (acc, r) => acc + Number(r.qty_on_hand ?? 0),
    0,
  );
}

async function hasAnyPostedMovement(
  tenantId: string,
  inventoryItemId: string,
): Promise<boolean> {
  const { count } = await supabaseServer
    .from("inventory_stock_movements")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("inventory_item_id", inventoryItemId)
    .in("status", ["posted", "voided"]);
  return (count ?? 0) > 0;
}

export async function guardProfileArchivable(
  ctx: ProfileGuardContext,
): Promise<GuardResult> {
  const qty = await totalOnHand(ctx.tenant_id, ctx.inventory_item_id);
  if (qty > 0) {
    return {
      ok: false,
      error: "Stock exists for this product. Move or adjust stock before archiving.",
      code: "INV_H2_PROFILE_HAS_STOCK",
    };
  }
  return { ok: true };
}

export async function guardProfileDeletable(
  ctx: ProfileGuardContext,
): Promise<GuardResult> {
  const hasHistory = await hasAnyPostedMovement(ctx.tenant_id, ctx.inventory_item_id);
  if (hasHistory) {
    return {
      ok: false,
      error: "Movement history exists. This stock profile cannot be deleted.",
      code: "INV_H2_PROFILE_HAS_HISTORY",
    };
  }
  return { ok: true };
}

export interface ProfilePatchGuardInput extends ProfileGuardContext {
  patch: Record<string, unknown>;
  is_super_admin: boolean;
}

export async function guardProfilePatch(
  input: ProfilePatchGuardInput,
): Promise<GuardResult> {
  const patch = input.patch ?? {};
  const touchesLinked = "linked_product_id" in patch;
  const touchesUnit = "unit_of_measure" in patch;
  const touchesTrack = "track_stock" in patch;

  if (!touchesLinked && !touchesUnit && !touchesTrack) return { ok: true };

  const hasHistory = await hasAnyPostedMovement(input.tenant_id, input.inventory_item_id);

  if (touchesLinked && hasHistory) {
    return {
      ok: false,
      error: "linked_product_id cannot change after movement history exists.",
      code: "INV_H2_PROFILE_LINK_LOCKED",
    };
  }
  if (touchesUnit && hasHistory && !input.is_super_admin) {
    return {
      ok: false,
      error: "unit_of_measure cannot change after movements exist. Requires admin override.",
      code: "INV_H2_PROFILE_UNIT_LOCKED",
    };
  }
  if (touchesTrack && patch.track_stock === false) {
    const qty = await totalOnHand(input.tenant_id, input.inventory_item_id);
    if (qty > 0) {
      return {
        ok: false,
        error: "Cannot disable stock tracking while on-hand quantity > 0.",
        code: "INV_H2_PROFILE_TRACK_LOCKED",
      };
    }
  }
  return { ok: true };
}

/* ─── Scope 7 — Warehouse guards ───────────────────────────── */

export interface WarehouseGuardContext {
  tenant_id: string;
  warehouse_id: string;
}

export async function guardWarehouseArchivable(
  ctx: WarehouseGuardContext,
): Promise<GuardResult> {
  /* Stock present? */
  const { data: bal } = await supabaseServer
    .from("inventory_stock_balances")
    .select("qty_on_hand")
    .eq("tenant_id", ctx.tenant_id)
    .eq("warehouse_id", ctx.warehouse_id);
  const total = ((bal ?? []) as Array<{ qty_on_hand: number | string }>).reduce(
    (acc, r) => acc + Number(r.qty_on_hand ?? 0),
    0,
  );
  if (total > 0) {
    return {
      ok: false,
      error: "This warehouse still holds stock. Transfer or adjust stock first.",
      code: "INV_H2_WAREHOUSE_HAS_STOCK",
    };
  }
  return { ok: true };
}

/** A tenant must always retain at least one active warehouse with
 *  is_default=true. If the target warehouse is the last active default,
 *  refuse to drop its default flag. */
export interface WarehouseDefaultGuardInput extends WarehouseGuardContext {
  next_is_default: boolean;
}

export async function guardWarehouseDefaultRemoval(
  input: WarehouseDefaultGuardInput,
): Promise<GuardResult> {
  if (input.next_is_default) return { ok: true };
  /* If the warehouse is currently default, ensure another active default exists. */
  const { data: current } = await supabaseServer
    .from("inventory_warehouses")
    .select("is_default, is_active, deleted_at")
    .eq("tenant_id", input.tenant_id)
    .eq("id", input.warehouse_id)
    .maybeSingle();
  const c = current as { is_default: boolean; is_active: boolean; deleted_at: string | null } | null;
  if (!c || !c.is_default) return { ok: true };

  const { count } = await supabaseServer
    .from("inventory_warehouses")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", input.tenant_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .neq("id", input.warehouse_id);
  if ((count ?? 0) === 0) {
    return {
      ok: false,
      error: "Cannot remove default — this is the only active warehouse.",
      code: "INV_H2_WAREHOUSE_LAST_DEFAULT",
    };
  }
  return { ok: true };
}

/* ─── Scope 5 — Void discipline ────────────────────────────── */

export interface VoidGuardInput {
  movement_type: MovementType;
  source_type: string | null;
  source_id: string | null;
  status: string;
  void_reason: string | null | undefined;
  is_super_admin: boolean;
  can_void: boolean;
  from_source_document: boolean;
}

export interface VoidGuardResult extends GuardResult {
  /** True when the movement is system-generated and was voided from
   *  the movement page (not from the source document). The route
   *  should still proceed but log a warning entry. */
  warn?: boolean;
  warning?: string;
}

export function guardMovementVoid(input: VoidGuardInput): VoidGuardResult {
  /* Idempotent — already voided ⇒ no-op success. */
  if (input.status === "voided") return { ok: true };

  if (!input.is_super_admin && !input.can_void) {
    return {
      ok: false,
      error: "You do not have permission to void inventory movements.",
      code: "INV_H2_VOID_PERMISSION_DENIED",
    };
  }

  const reason = (input.void_reason ?? "").trim();
  if (reason.length < 3) {
    return {
      ok: false,
      error: "A void reason is required (min 3 characters).",
      code: "INV_H2_VOID_REASON_REQUIRED",
    };
  }

  if (input.source_type && input.source_id && !input.from_source_document) {
    return {
      ok: true,
      warn: true,
      warning: "Void this movement from the source document to preserve traceability.",
    };
  }

  return { ok: true };
}

/* ─── Scope 3 — Manual movement approval ───────────────────── */

export interface ApprovalGuardInput {
  movement_type: MovementType;
  approval_status: string;
  is_super_admin: boolean;
  can_approve: boolean;
}

/** Refuse to post if this movement needs approval but is still pending /
 *  rejected. Approved-or-not_required movements pass through. */
export function guardPostingApproval(input: ApprovalGuardInput): GuardResult {
  if (!requiresApproval(input.movement_type)) return { ok: true };
  if (input.approval_status === "approved") return { ok: true };
  if (input.approval_status === "not_required") return { ok: true }; // legacy
  return {
    ok: false,
    error: "Manual inventory changes require approval before posting.",
    code: "INV_H2_APPROVAL_REQUIRED",
  };
}

export function guardApprovalAction(input: ApprovalGuardInput): GuardResult {
  if (!input.is_super_admin && !input.can_approve) {
    return {
      ok: false,
      error: "You do not have permission to approve inventory adjustments.",
      code: "INV_H2_APPROVE_PERMISSION_DENIED",
    };
  }
  return { ok: true };
}
