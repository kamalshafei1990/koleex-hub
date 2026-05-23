import "server-only";

/* ===========================================================================
   GET /api/inventory/serials/[id]/timeline
   Returns the chronological lifecycle of a serial: every movement that
   touched it, in order, with humanised warehouse + timestamp.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { getSerialHistory } from "@/lib/inventory/serials";

const MODULE = "Inventory";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  try {
    const timeline = await getSerialHistory(auth.tenant_id, id);
    return NextResponse.json({ timeline });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
