import "server-only";

/* ===========================================================================
   GET /api/accounting/profit-loss?from=...&to=...&compare_prior=1

   Tenant-scoped Profit & Loss statement built from POSTED journal
   lines only. Optional compare_prior=1 returns the same shape for
   the immediately-prior period in a `comparison` field.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildProfitLoss } from "@/lib/accounting/statements";

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
  const comparePrior = url.searchParams.get("compare_prior") === "1";

  const statement = await buildProfitLoss(auth.tenant_id, { from, to }, { comparePrior });
  return NextResponse.json({ statement });
}
