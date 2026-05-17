import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildFinanceWorkspace } from "@/lib/finance/workspace";
import { getUserExperience } from "@/lib/experience";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  try {
    const [snapshot, experience] = await Promise.all([
      buildFinanceWorkspace(auth.tenant_id),
      getUserExperience(auth),
    ]);
    if (!experience.can_see_bank_balances) {
      snapshot.banks = snapshot.banks.map((b) => ({ ...b, current_balance: 0 }));
    }
    return NextResponse.json({ snapshot, visibility: {
      can_see_bank_balances: experience.can_see_bank_balances,
      can_see_profit: experience.can_see_profit,
    } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
