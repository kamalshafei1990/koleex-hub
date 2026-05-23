import "server-only";

/* ===========================================================================
   GET  /api/inventory/movements    list paged movement history
   POST /api/inventory/movements    create a movement (draft, optionally post)

   Body shape:
     { inventory_item_id?, product_id?, warehouse_id?, movement_type,
       direction?, quantity, unit?, unit_cost?, currency?, reference?,
       notes?, movement_date?, source_type?, source_id?, post? }

     Either `inventory_item_id` OR `product_id` must be supplied. When
     only product_id is given, the server resolves the linked
     inventory_item via fn_inventory_ensure_item_for_product. If the
     product has no stock profile yet the call fails with a clear error
     so the UI can offer to create one.

     post=true  → create + post atomically (default).
     post=false → leave as draft so the operator can review.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildMovementHistory } from "@/lib/inventory/queries";
import {
  createAndPostInventoryMovement,
  createInventoryMovement,
} from "@/lib/inventory/posting";
import { supabaseServer } from "@/lib/server/supabase-server";
import type { CreateMovementInput, MovementType } from "@/lib/inventory/types";
import { isDocumentGenerated, requiresApproval } from "@/lib/inventory/discipline";
import { loadInventoryPermissions } from "@/lib/inventory/permissions";
import { logInventoryAudit } from "@/lib/inventory/audit";

const MODULE = "Inventory";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit"));
  try {
    const movements = await buildMovementHistory({
      tenantId: auth.tenant_id,
      inventoryItemId: url.searchParams.get("inventory_item_id") ?? undefined,
      warehouseId: url.searchParams.get("warehouse_id") ?? undefined,
      status: (url.searchParams.get("status") as "draft" | "posted" | "voided" | null) ?? undefined,
      movementType: url.searchParams.get("movement_type") ?? undefined,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 200,
    });
    return NextResponse.json({ movements });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

interface MovementBody extends Partial<CreateMovementInput> {
  /** INV-H1 — operators select products in the UI; the server resolves
   *  product_id → inventory_item_id via the existing linked profile. */
  product_id?: string;
  post?: boolean;
  /** INV-H2 — when true and the actor holds can_approve_adjustments,
   *  the adjustment is created with approval_status='approved' so the
   *  same request can post it. Otherwise the value is ignored. */
  pre_approved?: boolean;
}

/** Resolve a product to its tenant-scoped active inventory_item_id.
 *  Returns null if the product has no active stock profile. */
async function resolveProductToItem(
  tenantId: string,
  productId: string,
): Promise<{ ok: true; itemId: string } | { ok: false; reason: "no_profile" | "guard" }> {
  /* Look up an existing active profile first (don't auto-create — the
     stock profile should be deliberate. The product-side stock section
     is the place that creates profiles.). */
  const { data, error } = await supabaseServer
    .from("inventory_items")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("linked_product_id", productId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .maybeSingle();
  if (error) return { ok: false, reason: "guard" };
  if (!data) return { ok: false, reason: "no_profile" };
  return { ok: true, itemId: (data as { id: string }).id };
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as MovementBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  /* INV-H1 — resolve product_id → inventory_item_id when the operator
     picked a product. */
  let inventoryItemId = body.inventory_item_id ?? "";
  if (!inventoryItemId && body.product_id) {
    const resolved = await resolveProductToItem(auth.tenant_id, body.product_id);
    if (!resolved.ok) {
      return NextResponse.json(
        {
          error:
            resolved.reason === "no_profile"
              ? "This product is not tracked in inventory. Create a stock profile from the Product first."
              : "Failed to resolve product → stock profile.",
          code: "INV_H1_NO_STOCK_PROFILE",
          product_id: body.product_id,
        },
        { status: 422 },
      );
    }
    inventoryItemId = resolved.itemId;
  }

  if (!inventoryItemId) {
    return NextResponse.json(
      { error: "Provide either product_id (with a stock profile) or inventory_item_id." },
      { status: 400 },
    );
  }

  /* INV-H2 Scope 4 — refuse purchase_receipt / sales_shipment / transfer
     / return creation from the generic Movements form. These must come
     from their respective workflow pages. */
  const movementType = body.movement_type as MovementType;
  if (isDocumentGenerated(movementType)) {
    await logInventoryAudit({
      tenant_id: auth.tenant_id,
      actor_id: auth.account_id,
      action: "restricted_action_blocked",
      entity_type: "movement",
      entity_id: null,
      metadata: {
        reason: "document_generated_blocked_from_generic_route",
        movement_type: movementType,
      },
    });
    return NextResponse.json(
      {
        error: "Receipts and shipments are created from Purchase and Sales workflows.",
        code: "INV_H2_USE_WORKFLOW",
      },
      { status: 422 },
    );
  }

  /* INV-H2 Scope 3 — load inventory permissions to decide whether the
     caller may opt to pre-approve a manual adjustment. */
  const perms = await loadInventoryPermissions(auth);

  const adjustmentReason =
    typeof body.adjustment_reason === "string" ? body.adjustment_reason.trim() : "";

  const needsApproval = requiresApproval(movementType);
  if (needsApproval && !adjustmentReason) {
    return NextResponse.json(
      {
        error: "Manual inventory changes require a reason.",
        code: "INV_H2_REASON_REQUIRED",
      },
      { status: 422 },
    );
  }

  /* A caller can ask to pre-approve in the same request only when they
     hold can_approve_adjustments OR is_super_admin. Otherwise the row
     is created as approval_status='pending' and the actor must use
     the /approve endpoint (Scope 3 separation). */
  const canPreApprove = (auth.is_super_admin || perms.can_approve) && body.pre_approved === true;

  const input: CreateMovementInput = {
    tenant_id: auth.tenant_id,
    inventory_item_id: inventoryItemId,
    warehouse_id: body.warehouse_id ?? undefined,
    movement_type: movementType,
    direction: body.direction,
    quantity: Number(body.quantity ?? 0),
    unit: body.unit,
    unit_cost: body.unit_cost ?? null,
    currency: body.currency,
    /* Generic /api/inventory/movements is NEVER a workflow caller. The
       discipline layer uses this to refuse document-generated types and
       to skip the source-required check. */
    from_workflow: false,
    source_type: null,
    source_id: null,
    reference: body.reference ?? null,
    notes: body.notes ?? null,
    movement_date: body.movement_date,
    created_by: auth.account_id,
    adjustment_reason: adjustmentReason || undefined,
    pre_approved: canPreApprove,
    metadata: body.metadata ?? {},
    /* INV-H4A — optional variant + batch (NULL = item-level back-compat). */
    variant_id: body.variant_id ?? null,
    batch_id: body.batch_id ?? null,
    /* INV-H4B — optional serial ids. */
    serial_ids: Array.isArray(body.serial_ids) ? body.serial_ids : null,
  };

  /* Default behaviour: opening_balance and (legacy non-restricted) types
     are still post-on-create. Manual / adjustment_in / adjustment_out
     are now ALWAYS created as drafts — caller cannot bypass the
     approval gate by setting post=true. */
  const callerWantsPost = body.post !== false;
  const shouldPost = needsApproval ? canPreApprove && callerWantsPost : callerWantsPost;

  if (!shouldPost) {
    const r = await createInventoryMovement(input);
    if (!r.ok) {
      return NextResponse.json(
        { error: r.error, code: r.code ?? null },
        { status: 422 },
      );
    }
    return NextResponse.json({ movement: r.movement });
  }

  const r = await createAndPostInventoryMovement(input);
  if (!r.ok) {
    if (r.movement && r.post) {
      return NextResponse.json(
        { error: r.error, movement: r.movement, post: r.post },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: r.error }, { status: 422 });
  }
  return NextResponse.json({ movement: r.movement, post: r.post });
}
