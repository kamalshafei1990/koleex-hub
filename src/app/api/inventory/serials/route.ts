import "server-only";

/* ===========================================================================
   GET  /api/inventory/serials   list serials (filter: item_id, variant_id,
                                   warehouse_id, status, condition, customer_id,
                                   supplier_id, q, limit)
   POST /api/inventory/serials   admin: manually register a serial (no IN
                                   movement yet — for back-fill imports)
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import {
  createSerial,
  listSerials,
  type SerialStatus,
  type SerialCondition,
} from "@/lib/inventory/serials";

const MODULE = "Inventory";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  try {
    const serials = await listSerials({
      tenantId: auth.tenant_id,
      inventoryItemId: url.searchParams.get("item_id"),
      variantId: url.searchParams.get("variant_id"),
      batchId: url.searchParams.get("batch_id"),
      warehouseId: url.searchParams.get("warehouse_id"),
      status: (url.searchParams.get("status") as SerialStatus | null) ?? null,
      conditionStatus: (url.searchParams.get("condition") as SerialCondition | null) ?? null,
      customerId: url.searchParams.get("customer_id"),
      supplierId: url.searchParams.get("supplier_id"),
      search: url.searchParams.get("q"),
      limit: Number(url.searchParams.get("limit")) || 200,
    });
    return NextResponse.json({ serials });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as {
    inventory_item_id?: string;
    variant_id?: string | null;
    batch_id?: string | null;
    serial_no?: string;
    warehouse_id?: string | null;
    status?: SerialStatus;
    condition_status?: SerialCondition | null;
    customer_id?: string | null;
    supplier_id?: string | null;
    purchase_date?: string | null;
    sold_date?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  } | null;
  if (!body?.inventory_item_id) {
    return NextResponse.json({ error: "inventory_item_id required" }, { status: 400 });
  }
  if (!body.serial_no?.trim()) {
    return NextResponse.json({ error: "serial_no required" }, { status: 400 });
  }

  const r = await createSerial({
    tenant_id: auth.tenant_id,
    inventory_item_id: body.inventory_item_id,
    variant_id: body.variant_id ?? null,
    batch_id: body.batch_id ?? null,
    serial_no: body.serial_no,
    warehouse_id: body.warehouse_id ?? null,
    status: body.status ?? "in_stock",
    condition_status: body.condition_status ?? null,
    customer_id: body.customer_id ?? null,
    supplier_id: body.supplier_id ?? null,
    purchase_date: body.purchase_date ?? null,
    sold_date: body.sold_date ?? null,
    notes: body.notes ?? null,
    metadata: body.metadata ?? {},
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ serial: r.serial });
}
