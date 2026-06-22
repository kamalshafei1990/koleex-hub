import "server-only";

/* ===========================================================================
   GET   /api/inventory/returns/[id]    detail (header + items + bridges)
   PATCH /api/inventory/returns/[id]    edit header and/or items (draft only)
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import {
  getReturnDetail,
  setReturnItems,
  updateReturnHeader,
  type ConditionStatus,
  type Disposition,
  type ReasonCode,
} from "@/lib/inventory/returns";
import { humanizeError } from "@/lib/ui/humanize-error";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  try {
    const d = await getReturnDetail(auth.tenant_id, id);
    if (!d) return NextResponse.json({ error: "Return not found." }, { status: 404 });
    /* Rename `return_` -> `return` for the public API surface. */
    return NextResponse.json({
      return: d.return_,
      items: d.items,
      bridges: d.bridges,
    });
  } catch (e) {
    return NextResponse.json(
      { error: humanizeError(e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}

interface PatchBody {
  warehouse_id?: string;
  reason_code?: ReasonCode;
  reason_notes?: string | null;
  notes?: string | null;
  source_document_type?: string | null;
  source_document_id?: string | null;
  items?: Array<{
    inventory_item_id: string;
    quantity: number;
    unit_of_measure: string;
    condition_status: ConditionStatus;
    disposition: Disposition;
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

  if (
    body.warehouse_id ||
    body.reason_code ||
    body.reason_notes !== undefined ||
    body.notes !== undefined ||
    body.source_document_type !== undefined ||
    body.source_document_id !== undefined
  ) {
    const r = await updateReturnHeader(auth.tenant_id, id, {
      warehouse_id: body.warehouse_id,
      reason_code: body.reason_code,
      reason_notes: body.reason_notes,
      notes: body.notes,
      source_document_type: body.source_document_type,
      source_document_id: body.source_document_id,
    });
    if (!r.ok) return NextResponse.json({ error: humanizeError(r.error ?? "Update failed.") }, { status: 422 });
  }
  if (Array.isArray(body.items)) {
    const r = await setReturnItems(auth.tenant_id, id, body.items);
    if (!r.ok) return NextResponse.json({ error: humanizeError(r.error ?? "Update failed.") }, { status: 422 });
  }
  const d = await getReturnDetail(auth.tenant_id, id);
  return NextResponse.json({
    return: d?.return_ ?? null,
    items: d?.items ?? [],
    bridges: d?.bridges ?? [],
  });
}
