import "server-only";

/* ===========================================================================
   GET  /api/inventory/returns       list paged returns (filter by status, type)
   POST /api/inventory/returns       create a draft return (customer or supplier)
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import {
  createReturn,
  listReturns,
  type ReturnStatus,
  type ReturnType,
  type ReasonCode,
  type ConditionStatus,
  type Disposition,
} from "@/lib/inventory/returns";
import { humanizeError } from "@/lib/ui/humanize-error";

const MODULE = "Inventory";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as ReturnStatus | null;
  const returnType = url.searchParams.get("type") as ReturnType | null;
  const limit = Number(url.searchParams.get("limit"));
  try {
    const returns = await listReturns({
      tenantId: auth.tenant_id,
      status: status ?? null,
      returnType: returnType ?? null,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 200,
    });
    return NextResponse.json({ returns });
  } catch (e) {
    return NextResponse.json(
      { error: humanizeError(e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}

interface CreateBody {
  return_type?: ReturnType;
  customer_id?: string | null;
  supplier_id?: string | null;
  source_document_type?: string | null;
  source_document_id?: string | null;
  warehouse_id?: string;
  reason_code?: ReasonCode;
  reason_notes?: string | null;
  notes?: string | null;
  items?: Array<{
    inventory_item_id: string;
    quantity: number;
    unit_of_measure: string;
    condition_status: ConditionStatus;
    disposition: Disposition;
    notes?: string | null;
  }>;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const r = await createReturn({
    tenant_id: auth.tenant_id,
    return_type: body.return_type ?? "customer_return",
    customer_id: body.customer_id ?? null,
    supplier_id: body.supplier_id ?? null,
    source_document_type: body.source_document_type ?? null,
    source_document_id: body.source_document_id ?? null,
    warehouse_id: body.warehouse_id ?? "",
    reason_code: body.reason_code ?? "other",
    reason_notes: body.reason_notes ?? null,
    notes: body.notes ?? null,
    created_by: auth.account_id,
    items: body.items ?? [],
  });
  if (!r.ok) {
    return NextResponse.json(
      { error: humanizeError(r.error ?? "Create failed.") },
      { status: 422 },
    );
  }
  return NextResponse.json({ return: r.return_ });
}
