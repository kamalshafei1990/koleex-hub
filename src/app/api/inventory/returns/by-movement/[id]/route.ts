import "server-only";

/* GET /api/inventory/returns/by-movement/[id]
   Resolve a movement id → the parent return (id + return_no + return_type).
   Used by InventoryMovementDetail to render the "Return → <no>" link
   when source_type='inventory_return'. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { resolveReturnLinkForMovement } from "@/lib/inventory/returns";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const link = await resolveReturnLinkForMovement(auth.tenant_id, id);
  return NextResponse.json({ link });
}
