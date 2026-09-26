import "server-only";

/* ===========================================================================
   GET /api/inventory/balances
     ?warehouse_id=        optional filter
     ?inventory_item_id=   optional filter
     ?only_positive        hide rows with zero on-hand
     ?group_by=            INV-H4A — default "item,warehouse" (back-compat).
                           Pass "item,variant,batch,warehouse" to receive
                           the drilled-down shape (uses inventory_stock_movements
                           aggregation since stock_balances is item-warehouse only).
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildBalancesSnapshot } from "@/lib/inventory/queries";
import { buildDrilledBalances } from "@/lib/inventory/variants";
import { canSeeCostData, hideInventoryCost } from "@/lib/experience";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Inventory");
  if (deny) return deny;

  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouse_id") ?? undefined;
  const inventoryItemId = url.searchParams.get("inventory_item_id") ?? undefined;
  const onlyPositive = url.searchParams.get("only_positive") === "1";
  const groupBy = (url.searchParams.get("group_by") ?? "").toLowerCase();
  const drilled =
    groupBy.includes("variant") || groupBy.includes("batch");

  try {
    if (drilled) {
      const rows = await buildDrilledBalances({
        tenantId: auth.tenant_id,
        inventoryItemId,
        warehouseId,
      });
      const filtered = onlyPositive ? rows.filter((r) => r.qty_on_hand > 0) : rows;
      /* The drilled rows carry the weighted cost and the value: 0 with
         cost_hidden without the private-records switch (src/lib/experience).
         The default shape is quantities only. Guarded by validate:finance-perf §G. */
      return NextResponse.json({
        balances: canSeeCostData(auth) ? filtered : filtered.map(hideInventoryCost),
        group_by: "item,variant,batch,warehouse",
      });
    }
    const balances = await buildBalancesSnapshot({
      tenantId: auth.tenant_id,
      warehouseId,
      inventoryItemId,
      onlyPositive,
    });
    return NextResponse.json({ balances, group_by: "item,warehouse" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
