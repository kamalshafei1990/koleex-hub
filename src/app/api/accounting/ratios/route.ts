import "server-only";

/* ===========================================================================
   GET /api/accounting/ratios?as_of=YYYY-MM-DD
   10 accounting ratios from POSTED journal balances.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { requireBankAndProfit } from "@/lib/experience";
import { buildFinancialRatios } from "@/lib/accounting/statements";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  /* Owner, 26/09/2026 («أيوه اقفلهم بنفس القاعدة»): profit is «Bank &
     Profit», cost is the «private records» switch. Guarded by
     validate:finance-perf §G. */
  const denied = await requireBankAndProfit(auth, "The financial ratios");
  if (denied) return denied;

  const url = new URL(req.url);
  const asOf = url.searchParams.get("as_of") ?? new Date().toISOString().slice(0, 10);
  const ratios = await buildFinancialRatios(auth.tenant_id, asOf);
  return NextResponse.json({ ratios });
}
