import "server-only";

/* ===========================================================================
   GET   /api/inventory/batches/[id]   detail
   PATCH /api/inventory/batches/[id]   limited update (expiry, notes, status)
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { getBatch, updateBatch, type UpdateBatchInput } from "@/lib/inventory/variants";

const MODULE = "Inventory";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const batch = await getBatch(auth.tenant_id, id);
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ batch });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const patch = (await req.json().catch(() => null)) as UpdateBatchInput | null;
  if (!patch) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const r = await updateBatch(auth.tenant_id, id, patch);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ batch: r.batch });
}
