import "server-only";

/* ===========================================================================
   GET /api/reports/templates
   Returns the descriptor for every report the operator is allowed
   to generate. Authn-gated to Finance module — anyone without Finance
   sees an empty list (so the picker on /finance/reports renders
   nothing rather than a 403).

   Each descriptor says whether THIS caller may open it (`locked`, the
   refusal code from src/lib/experience reportRefusal — the same check
   buildAndAudit makes), so the picker shows a locked report with the
   reason instead of a failing preview. Guarded by validate:finance-perf §G.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { listReportTemplates } from "@/lib/reports/registry";
import { canSeeBankAndProfit, canSeeCostData, reportRefusal } from "@/lib/experience";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const can = { bankAndProfit: await canSeeBankAndProfit(auth), cost: canSeeCostData(auth) };
  return NextResponse.json({ templates: listReportTemplates().map((t) => ({ ...t, locked: reportRefusal(t.type, can) })) });
}
