import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { requireBankAndProfit, requirePrivateData } from "@/lib/experience";
import { buildGrossProfit } from "@/lib/accounting/aging";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  /* Owner, 26/09/2026 («أيوه اقفلهم بنفس القاعدة»): profit is «Bank &
     Profit», cost is the «private records» switch. Guarded by
     validate:finance-perf §G. */
  const denied = await requireBankAndProfit(auth, "Gross profit per invoice");
  if (denied) return denied;
  const noCost = requirePrivateData(auth, "Gross profit per invoice");
  if (noCost) return noCost;

  const url = new URL(req.url);
  try {
    const report = await buildGrossProfit({
      tenantId: auth.tenant_id,
      from: url.searchParams.get("from") ?? undefined,
      to:   url.searchParams.get("to") ?? undefined,
    });
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
