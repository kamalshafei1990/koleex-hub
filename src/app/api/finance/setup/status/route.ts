import "server-only";

/* ===========================================================================
   GET /api/finance/setup/status — onboarding snapshot per card.

   The card totals follow the opening-balance rule (src/lib/experience,
   hideSetupCardTotal): bank, cash, loans and capital need «Bank & Profit»,
   the starting position needs it and the private-records switch; a hidden
   total goes out as 0 with total_hidden. Counts and progress stay.
   Guarded by validate:finance-perf §G.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildSetupSnapshot } from "@/lib/finance/onboarding";
import { canSeeBankAndProfit, canSeeCostData, hideSetupCardTotal } from "@/lib/experience";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  try {
    const [snapshot, bankAndProfit] = await Promise.all([buildSetupSnapshot(auth.tenant_id), canSeeBankAndProfit(auth)]);
    const can = { bankAndProfit, cost: canSeeCostData(auth) };
    return NextResponse.json({ snapshot: { ...snapshot, cards: snapshot.cards.map((c) => hideSetupCardTotal(c, can)) } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
