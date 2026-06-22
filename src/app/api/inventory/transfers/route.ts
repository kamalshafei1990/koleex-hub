import "server-only";

/* ===========================================================================
   GET  /api/inventory/transfers       list paged transfers (optional status)
   POST /api/inventory/transfers       create a draft transfer + its items
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import {
  createTransfer,
  listTransfers,
  type TransferStatus,
} from "@/lib/inventory/transfers";
import { humanizeError } from "@/lib/ui/humanize-error";

const MODULE = "Inventory";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as TransferStatus | null;
  const limit = Number(url.searchParams.get("limit"));
  try {
    const transfers = await listTransfers({
      tenantId: auth.tenant_id,
      status: status ?? null,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 200,
    });
    return NextResponse.json({ transfers });
  } catch (e) {
    return NextResponse.json(
      { error: humanizeError(e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}

interface CreateBody {
  source_warehouse_id?: string;
  destination_warehouse_id?: string;
  notes?: string | null;
  items?: Array<{
    inventory_item_id: string;
    quantity: number;
    unit_of_measure: string;
    notes?: string | null;
  }>;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const r = await createTransfer({
    tenant_id: auth.tenant_id,
    source_warehouse_id: body.source_warehouse_id ?? "",
    destination_warehouse_id: body.destination_warehouse_id ?? "",
    notes: body.notes ?? null,
    created_by: auth.account_id,
    items: body.items ?? [],
  });
  if (!r.ok) return NextResponse.json({ error: humanizeError(r.error ?? "Create failed.") }, { status: 422 });
  return NextResponse.json({ transfer: r.transfer });
}
