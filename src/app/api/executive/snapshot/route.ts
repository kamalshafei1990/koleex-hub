import "server-only";

/* ===========================================================================
   GET /api/executive/snapshot
   Returns a single payload powering the executive dashboard.

   Door: internal accounts with the Finance module (src/lib/experience,
   requireFinanceNumbers), before anything is built. It used to check only
   that the caller was signed in, so any account — a customer login included —
   read the revenue, receivables, payables, FX exposure and the top customers,
   markets and products.

   Visibility gate: profit and the cash position show only with «Bank &
   Profit» in Roles & Permissions; the inventory value and the most valuable
   stock only with the role's «private records» switch (cost data). They are
   zeroed on the wire otherwise.
   Guarded by validate:finance-perf §G.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { buildExecutiveSnapshot } from "@/lib/executive/intelligence";
import { canSeeBankAndProfit, canSeeCostData, requireFinanceNumbers } from "@/lib/experience";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireFinanceNumbers(auth);
  if (denied) return denied;

  try {
    const [snapshot, bankAndProfit] = await Promise.all([
      buildExecutiveSnapshot(auth.tenant_id),
      canSeeBankAndProfit(auth),
    ]);
    const cost = canSeeCostData(auth);

    /* Visibility masking. We zero-out sensitive figures rather than
       deleting keys so the client can render placeholders. */
    if (!bankAndProfit) {
      snapshot.kpis.gross_profit.value = 0;
      snapshot.kpis.gross_profit.hint = "Hidden";
      snapshot.kpis.net_profit.value = 0;
      snapshot.kpis.net_profit.hint = "Hidden";
      for (const m of snapshot.monthly) {
        m.gross_profit = 0; m.net_profit = 0; m.cogs = 0; m.operating_expense = 0;
      }
      snapshot.kpis.cash_position.value = 0;
      snapshot.kpis.cash_position.hint = "Hidden";
    }
    if (!cost) {
      snapshot.kpis.inventory.value = 0;
      snapshot.kpis.inventory.hint = "Hidden";
      snapshot.inventory_intel.highest_value = [];
    }

    return NextResponse.json({
      snapshot,
      visibility: {
        can_see_profit: bankAndProfit,
        can_see_cost_data: cost,
        can_see_bank_balances: bankAndProfit,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
