import "server-only";

/* ===========================================================================
   GET /api/inventory/items/[id]/valuation
   Per-item rollup: qty, avg cost, value, last in cost, by-location
   breakdown, recent cost-relevant movements.

   The cost figures go only to a role with the «private records» switch
   (src/lib/experience, canSeeCostData): anyone else with Inventory gets the
   quantities and `cost_hidden: true`, every cost field 0 (or null where
   there was no figure). Guarded by validate:finance-perf §G.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { getItemValuationSummary } from "@/lib/inventory/valuation";
import { canSeeCostData, hideInventoryCost } from "@/lib/experience";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  try {
    const summary = await getItemValuationSummary(auth.tenant_id, id);
    if (canSeeCostData(auth)) return NextResponse.json({ valuation: summary });
    return NextResponse.json({
      valuation: {
        ...hideInventoryCost(summary),
        locations: summary.locations.map(hideInventoryCost),
        recent_movements: summary.recent_movements.map(hideInventoryCost),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
