import "server-only";

/* ===========================================================================
   GET   /api/inventory/transfers/[id]   detail (header + items + bridges)
   PATCH /api/inventory/transfers/[id]   edit header and/or items (draft only)
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import {
  getTransferDetail,
  setTransferItems,
  updateTransferHeader,
} from "@/lib/inventory/transfers";
import { humanizeError } from "@/lib/ui/humanize-error";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  try {
    const d = await getTransferDetail(auth.tenant_id, id);
    if (!d) return NextResponse.json({ error: "Transfer not found." }, { status: 404 });
    return NextResponse.json(d);
  } catch (e) {
    return NextResponse.json(
      { error: humanizeError(e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}

interface PatchBody {
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Inventory", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  /* Header */
  if (body.source_warehouse_id || body.destination_warehouse_id || body.notes !== undefined) {
    const r = await updateTransferHeader(auth.tenant_id, id, {
      source_warehouse_id: body.source_warehouse_id,
      destination_warehouse_id: body.destination_warehouse_id,
      notes: body.notes,
    });
    if (!r.ok) return NextResponse.json({ error: humanizeError(r.error ?? "Update failed.") }, { status: 422 });
  }
  /* Items */
  if (Array.isArray(body.items)) {
    const r = await setTransferItems(auth.tenant_id, id, body.items);
    if (!r.ok) return NextResponse.json({ error: humanizeError(r.error ?? "Update failed.") }, { status: 422 });
  }
  const d = await getTransferDetail(auth.tenant_id, id);
  return NextResponse.json(d);
}
