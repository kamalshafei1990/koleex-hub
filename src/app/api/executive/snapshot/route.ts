import "server-only";

/* ===========================================================================
   GET /api/executive/snapshot
   Returns a single payload powering the executive dashboard.
   Visibility gate: cost / profit-sensitive numbers are stripped on the
   wire for roles that cannot see them.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { buildExecutiveSnapshot } from "@/lib/executive/intelligence";
import { getUserExperience } from "@/lib/experience";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const [snapshot, experience] = await Promise.all([
      buildExecutiveSnapshot(auth.tenant_id),
      getUserExperience(auth),
    ]);

    /* Visibility masking. We zero-out sensitive figures rather than
       deleting keys so the client can render placeholders. */
    if (!experience.can_see_profit) {
      snapshot.kpis.gross_profit.value = 0;
      snapshot.kpis.gross_profit.hint = "Hidden";
      snapshot.kpis.net_profit.value = 0;
      snapshot.kpis.net_profit.hint = "Hidden";
      for (const m of snapshot.monthly) {
        m.gross_profit = 0; m.net_profit = 0; m.cogs = 0; m.operating_expense = 0;
      }
    }
    if (!experience.can_see_cost_data) {
      snapshot.kpis.inventory.value = 0;
      snapshot.kpis.inventory.hint = "Hidden";
      snapshot.inventory_intel.highest_value = [];
    }
    if (!experience.can_see_bank_balances) {
      snapshot.kpis.cash_position.value = 0;
      snapshot.kpis.cash_position.hint = "Hidden";
    }

    return NextResponse.json({
      snapshot,
      visibility: {
        can_see_profit: experience.can_see_profit,
        can_see_cost_data: experience.can_see_cost_data,
        can_see_bank_balances: experience.can_see_bank_balances,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
