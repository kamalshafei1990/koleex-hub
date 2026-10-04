import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildFinanceWorkspace } from "@/lib/finance/workspace";
import { canSeeBankAndProfit } from "@/lib/experience";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  try {
    /* Bank balances show only with «Bank & Profit» in Roles & Permissions. */
    const [snapshot, bankAndProfit] = await Promise.all([
      buildFinanceWorkspace(auth.tenant_id),
      canSeeBankAndProfit(auth),
    ]);
    if (!bankAndProfit) {
      snapshot.banks = snapshot.banks.map((b) => ({ ...b, current_balance: 0 }));
    }
    return NextResponse.json({ snapshot, visibility: {
      can_see_bank_balances: bankAndProfit,
      can_see_profit: bankAndProfit,
    } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
