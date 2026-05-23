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
import type { CreateMovementInput } from "@/lib/inventory/types";

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

  const input: CreateMovementInput = {
    tenant_id: auth.tenant_id,
    inventory_item_id: inventoryItemId,
    warehouse_id: body.warehouse_id ?? undefined,
    movement_type: body.movement_type as CreateMovementInput["movement_type"],
    direction: body.direction,
    quantity: Number(body.quantity ?? 0),
    unit: body.unit,
    unit_cost: body.unit_cost ?? null,
    currency: body.currency,
    source_type: body.source_type ?? null,
    source_id: body.source_id ?? null,
    reference: body.reference ?? null,
    notes: body.notes ?? null,
    movement_date: body.movement_date,
    created_by: auth.account_id,
    metadata: {},
  };

  const shouldPost = body.post !== false;

  if (!shouldPost) {
    const r = await createInventoryMovement(input);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
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
