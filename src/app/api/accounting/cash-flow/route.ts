import "server-only";

/* ===========================================================================
   GET /api/accounting/cash-flow?from=...&to=...
   Direct-method cash flow statement from POSTED journal lines.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildCashFlow } from "@/lib/accounting/statements";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to   = url.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required (yyyy-mm-dd)" }, { status: 400 });
  }
  const statement = await buildCashFlow(auth.tenant_id, { from, to });
  return NextResponse.json({ statement });
}
