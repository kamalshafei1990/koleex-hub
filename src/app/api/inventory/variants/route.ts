import "server-only";

/* ===========================================================================
   GET  /api/inventory/variants    list variants (filter: item_id, status, q)
   POST /api/inventory/variants    create a variant for an inventory item

   A variant's cost follows the item's (src/lib/experience): 0 with
   cost_hidden without the private-records switch, and such a caller does
   not set one. Guarded by validate:finance-perf §G.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import {
  createVariant,
  listVariants,
  type CreateVariantInput,
  type VariantStatus,
} from "@/lib/inventory/variants";
import { canSeeCostData, hideInventoryCost, INVENTORY_COST_INPUTS } from "@/lib/experience";

const MODULE = "Inventory";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  try {
    const variants = await listVariants({
      tenantId: auth.tenant_id,
      inventoryItemId: url.searchParams.get("item_id") ?? undefined,
      status: (url.searchParams.get("status") as VariantStatus | null) ?? undefined,
      search: url.searchParams.get("q") ?? undefined,
      limit: Number(url.searchParams.get("limit")) || 200,
    });
    return NextResponse.json({ variants: canSeeCostData(auth) ? variants : variants.map(hideInventoryCost) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Partial<CreateVariantInput> | null;
  if (!body?.inventory_item_id) {
    return NextResponse.json({ error: "inventory_item_id required" }, { status: 400 });
  }
  if (!body.variant_name?.trim()) {
    return NextResponse.json({ error: "variant_name required" }, { status: 400 });
  }
  const cost = canSeeCostData(auth);
  if (!cost && INVENTORY_COST_INPUTS.some((f) => (Number(body[f]) || 0) !== 0)) {
    return NextResponse.json(
      { error: "Item costs are set only with «Can see private data» in Roles & Permissions.", code: "needs_private_data" },
      { status: 403 },
    );
  }

  const r = await createVariant({
    tenant_id: auth.tenant_id,
    inventory_item_id: body.inventory_item_id,
    variant_code: body.variant_code,
    variant_name: body.variant_name,
    attributes: body.attributes,
    sku_suffix: body.sku_suffix ?? null,
    barcode: body.barcode ?? null,
    qr_code: body.qr_code ?? null,
    cost_price: body.cost_price ?? null,
    currency: body.currency ?? null,
    weight: body.weight ?? null,
    dimensions: body.dimensions ?? null,
    status: body.status,
    metadata: body.metadata,
    created_by: auth.account_id,
  });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code ?? null }, { status: 422 });
  return NextResponse.json({ variant: cost || !r.variant ? r.variant : hideInventoryCost(r.variant) });
}
