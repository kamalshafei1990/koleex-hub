import "server-only";

/* ===========================================================================
   POST /api/inventory/movements/[id]/post
   Promote a draft movement to posted. Idempotent.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { postInventoryMovement } from "@/lib/inventory/posting";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const r = await postInventoryMovement(id, auth.tenant_id, auth.account_id);
  if (!r.ok) return NextResponse.json(r, { status: r.code ?? 409 });
  return NextResponse.json(r);
}
