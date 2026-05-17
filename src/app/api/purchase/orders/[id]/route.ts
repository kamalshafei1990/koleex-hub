import "server-only";

/* ===========================================================================
   GET   /api/purchase/orders/[id]    full PO detail: header + items
                                       + receipts + receipt lines
   PATCH /api/purchase/orders/[id]    update PO header (limited fields:
                                       status transitions, notes, dates,
                                       payment terms; line edits go via
                                       a separate endpoint in a later phase)
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getPurchaseOrderDetail } from "@/lib/purchase/queries";
import type { PurchaseOrderStatus } from "@/lib/purchase/types";

const MODULE = "Purchase";

const ALLOWED_STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft:     ["confirmed", "cancelled"],
  confirmed: ["partial", "received", "cancelled", "closed"],
  partial:   ["received", "closed", "cancelled"],
  received:  ["closed"],
  closed:    [],
  cancelled: [],
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  try {
    const detail = await getPurchaseOrderDetail(auth.tenant_id, id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

interface PatchBody {
  status?: PurchaseOrderStatus;
  notes?: string | null;
  internal_notes?: string | null;
  expected_delivery_date?: string | null;
  payment_terms?: string | null;
  incoterms?: string | null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const { data: current, error: loadErr } = await supabaseServer
    .from("purchase_orders")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const currentStatus = (current as { status: PurchaseOrderStatus }).status;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status && body.status !== currentStatus) {
    if (!ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(body.status)) {
      return NextResponse.json(
        { error: `Cannot transition PO from '${currentStatus}' to '${body.status}'` },
        { status: 409 },
      );
    }
    updates.status = body.status;
  }
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.internal_notes !== undefined) updates.internal_notes = body.internal_notes;
  if (body.expected_delivery_date !== undefined) updates.expected_delivery_date = body.expected_delivery_date;
  if (body.payment_terms !== undefined) updates.payment_terms = body.payment_terms;
  if (body.incoterms !== undefined) updates.incoterms = body.incoterms;

  const { data, error } = await supabaseServer
    .from("purchase_orders")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
