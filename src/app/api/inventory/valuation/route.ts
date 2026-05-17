import "server-only";

/* ===========================================================================
   GET /api/inventory/valuation
     ?warehouse_id=          optional filter
     ?inventory_item_id=     optional filter
     ?only_positive          hide rows with zero qty
     ?totals=1               also return tenant-wide totals

   Returns:
     { rows: ValuationRowWithRefs[], totals?: ValuationTotals }
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildValuationSnapshot, getTenantValuationTotals } from "@/lib/inventory/valuation";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouse_id") ?? undefined;
  const inventoryItemId = url.searchParams.get("inventory_item_id") ?? undefined;
  const onlyPositive = url.searchParams.get("only_positive") === "1";
  const wantTotals   = url.searchParams.get("totals") === "1";

  try {
    const rows = await buildValuationSnapshot({
      tenantId: auth.tenant_id, warehouseId, inventoryItemId, onlyPositive,
    });
    const totals = wantTotals ? await getTenantValuationTotals(auth.tenant_id) : undefined;
    return NextResponse.json({ rows, totals });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
