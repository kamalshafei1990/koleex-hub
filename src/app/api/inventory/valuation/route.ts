import "server-only";

/* ===========================================================================
   GET /api/inventory/valuation
     ?warehouse_id=          optional filter
     ?inventory_item_id=     optional filter
     ?only_positive          hide rows with zero qty
     ?totals=1               also return tenant-wide totals

   Returns:
     { rows: ValuationRowWithRefs[], totals?: ValuationTotals, visibility }

   The cost figures go only to a role with the «private records» switch
   (src/lib/experience, canSeeCostData). Anyone else with Inventory gets the
   quantities: every cost field 0 (or null) with `cost_hidden`, the totals'
   values 0, and no "top holders" — a ranking by value is the value.
   Guarded by validate:finance-perf §G.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildValuationSnapshot, getTenantValuationTotals, type ValuationTotals } from "@/lib/inventory/valuation";
import { buildDrilledBalances } from "@/lib/inventory/variants";
import { canSeeCostData, hideInventoryCost } from "@/lib/experience";

/** The totals with no value in them: counts stay, amounts go. */
function hideTotalsCost(t: ValuationTotals | undefined): ValuationTotals | undefined {
  if (!t) return t;
  return {
    ...t,
    total_value: 0,
    by_currency: Object.fromEntries(Object.keys(t.by_currency).map((c) => [c, 0])),
    top_holders: [],
  };
}

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
  const groupBy = (url.searchParams.get("group_by") ?? "").toLowerCase();
  const drilled = groupBy.includes("variant") || groupBy.includes("batch");
  const cost = canSeeCostData(auth);
  const visibility = { can_see_cost_data: cost };

  try {
    if (drilled) {
      const rows = await buildDrilledBalances({
        tenantId: auth.tenant_id, inventoryItemId, warehouseId,
      });
      const filtered = onlyPositive ? rows.filter((r) => r.qty_on_hand > 0) : rows;
      const totals = wantTotals ? await getTenantValuationTotals(auth.tenant_id) : undefined;
      return NextResponse.json({
        rows: cost ? filtered : filtered.map(hideInventoryCost),
        totals: cost ? totals : hideTotalsCost(totals),
        group_by: "item,variant,batch,warehouse", visibility,
      });
    }
    const rows = await buildValuationSnapshot({
      tenantId: auth.tenant_id, warehouseId, inventoryItemId, onlyPositive,
    });
    const totals = wantTotals ? await getTenantValuationTotals(auth.tenant_id) : undefined;
    return NextResponse.json({
      rows: cost ? rows : rows.map(hideInventoryCost),
      totals: cost ? totals : hideTotalsCost(totals),
      group_by: "item,warehouse", visibility,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
