import "server-only";

/* ===========================================================================
   GET /api/accounting/balance-sheet?as_of=…
   Returns the foundation balance-sheet snapshot:
     · total assets
     · total liabilities
     · total equity
     · current year earnings (revenue − expense, YTD)
     · balanced_difference  (must be near zero for a clean ledger)

   Full P&L + multi-period statements are deferred to a later phase;
   this endpoint is intentionally a foundation, not a full statement.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildBalanceSheetSummary } from "@/lib/accounting/queries";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const asOf = url.searchParams.get("as_of") ?? undefined;
  const summary = await buildBalanceSheetSummary(auth.tenant_id, asOf);
  return NextResponse.json({ balance_sheet: summary });
}
