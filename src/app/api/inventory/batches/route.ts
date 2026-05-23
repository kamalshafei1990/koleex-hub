import "server-only";

/* ===========================================================================
   GET  /api/inventory/batches    list batches
                                  filters: item_id, variant_id, warehouse_id,
                                           expiry_status (normal|near_expiry|
                                                          expired|depleted|all),
                                           q (search by batch_no / supplier_batch_no)
   POST /api/inventory/batches    create a batch
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import {
  createBatch,
  listBatches,
  type BatchExpiryStatus,
  type CreateBatchInput,
} from "@/lib/inventory/variants";

const MODULE = "Inventory";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  try {
    const batches = await listBatches({
      tenantId: auth.tenant_id,
      inventoryItemId: url.searchParams.get("item_id") ?? undefined,
      variantId: url.searchParams.get("variant_id") ?? undefined,
      warehouseId: url.searchParams.get("warehouse_id") ?? undefined,
      expiryStatus: (url.searchParams.get("expiry_status") as BatchExpiryStatus | "all" | null) ?? undefined,
      search: url.searchParams.get("q") ?? undefined,
      limit: Number(url.searchParams.get("limit")) || 200,
    });
    return NextResponse.json({ batches });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Partial<CreateBatchInput> | null;
  if (!body?.inventory_item_id) {
    return NextResponse.json({ error: "inventory_item_id required" }, { status: 400 });
  }
  if (!body.warehouse_id) {
    return NextResponse.json({ error: "warehouse_id required" }, { status: 400 });
  }
  if (body.quantity_initial == null || !Number.isFinite(body.quantity_initial) || body.quantity_initial < 0) {
    return NextResponse.json({ error: "quantity_initial must be >= 0" }, { status: 400 });
  }

  const r = await createBatch({
    tenant_id: auth.tenant_id,
    inventory_item_id: body.inventory_item_id,
    variant_id: body.variant_id ?? null,
    batch_no: body.batch_no,
    supplier_batch_no: body.supplier_batch_no ?? null,
    manufacture_date: body.manufacture_date ?? null,
    expiry_date: body.expiry_date ?? null,
    quantity_initial: body.quantity_initial,
    warehouse_id: body.warehouse_id,
    notes: body.notes ?? null,
    metadata: body.metadata,
    created_by: auth.account_id,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ batch: r.batch });
}
