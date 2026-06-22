import "server-only";

/* ===========================================================================
   GET    /api/inventory/variants/[id]   detail
   PATCH  /api/inventory/variants/[id]   limited update
   DELETE /api/inventory/variants/[id]   soft delete (status='archived')
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import {
  archiveVariant,
  getVariant,
  updateVariant,
  type UpdateVariantInput,
} from "@/lib/inventory/variants";

const MODULE = "Inventory";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const variant = await getVariant(auth.tenant_id, id);
  if (!variant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ variant });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "edit");
  if (deny) return deny;

  const patch = (await req.json().catch(() => null)) as UpdateVariantInput | null;
  if (!patch) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const r = await updateVariant(auth.tenant_id, id, patch);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ variant: r.variant });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "delete");
  if (deny) return deny;

  const r = await archiveVariant(auth.tenant_id, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ ok: true });
}
