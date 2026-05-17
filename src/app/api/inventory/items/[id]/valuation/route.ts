import "server-only";

/* ===========================================================================
   GET /api/inventory/items/[id]/valuation
   Per-item rollup: qty, avg cost, value, last in cost, by-location
   breakdown, recent cost-relevant movements.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { getItemValuationSummary } from "@/lib/inventory/valuation";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  try {
    const summary = await getItemValuationSummary(auth.tenant_id, id);
    return NextResponse.json({ valuation: summary });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
