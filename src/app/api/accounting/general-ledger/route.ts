import "server-only";

/* ===========================================================================
   GET /api/accounting/general-ledger?account_id=…&from=…&to=…
   Returns the GL for a single account: opening balance, posted-line
   detail with running balance, closing balance.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildGeneralLedger } from "@/lib/accounting/queries";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const accountId = url.searchParams.get("account_id");
  if (!accountId) return NextResponse.json({ error: "account_id is required" }, { status: 400 });

  const gl = await buildGeneralLedger(auth.tenant_id, accountId, {
    from: url.searchParams.get("from") ?? undefined,
    to:   url.searchParams.get("to")   ?? undefined,
  });
  if (!gl) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  return NextResponse.json({ ledger: gl });
}
