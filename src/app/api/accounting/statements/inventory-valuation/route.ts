import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { requirePrivateData } from "@/lib/experience";
import { buildInventoryValuationSummary } from "@/lib/accounting/aging";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  /* Owner, 26/09/2026 («أيوه اقفلهم بنفس القاعدة»): profit is «Bank &
     Profit», cost is the «private records» switch. Guarded by
     validate:finance-perf §G. */
  const noCost = requirePrivateData(auth, "The inventory value");
  if (noCost) return noCost;

  try {
    const report = await buildInventoryValuationSummary(auth.tenant_id);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
