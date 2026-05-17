import "server-only";

/* ===========================================================================
   GET  /api/inventory/movements    list paged movement history
   POST /api/inventory/movements    create a movement (draft, optionally post)

   Body shape:
     { inventory_item_id, warehouse_id?, movement_type, direction?,
       quantity, unit?, unit_cost?, currency?, reference?, notes?,
       movement_date?, source_type?, source_id?, post? }

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
  post?: boolean;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as MovementBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const input: CreateMovementInput = {
    tenant_id: auth.tenant_id,
    inventory_item_id: body.inventory_item_id ?? "",
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
