import "server-only";

/* GET /api/inventory/transfers/by-movement/[id]
   Resolve a movement id → the parent transfer (id + transfer_no).
   Used by InventoryMovementDetail to display the "View transfer →" link
   when source_type='inventory_transfer'. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { resolveTransferLinkForMovement } from "@/lib/inventory/transfers";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const link = await resolveTransferLinkForMovement(auth.tenant_id, id);
  return NextResponse.json({ link });
}
