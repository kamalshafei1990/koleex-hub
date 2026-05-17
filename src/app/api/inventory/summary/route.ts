import "server-only";

/* ===========================================================================
   GET /api/inventory/summary
   Tenant-level dashboard summary: warehouse count, total on-hand,
   top balances, recent movements.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildInventoryDashboardSummary } from "@/lib/inventory/queries";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  try {
    const summary = await buildInventoryDashboardSummary(auth.tenant_id);
    return NextResponse.json({ summary });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
