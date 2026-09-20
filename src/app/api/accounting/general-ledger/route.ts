import "server-only";

/* GET /api/accounting/general-ledger?account_id=…&from=…&to=…&limit=…&offset=…
   One account's ledger: opening balance, a page of lines with a running
   balance (base currency, with each line's own currency and rate), the
   closing balance of the whole window and the total row count for paging. */

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
  const limit = Number(url.searchParams.get("limit")) || 200;
  const offset = Number(url.searchParams.get("offset")) || 0;

  try {
    const gl = await buildGeneralLedger(auth.tenant_id, accountId, {
      from: url.searchParams.get("from") ?? undefined,
      to:   url.searchParams.get("to")   ?? undefined,
    }, { limit, offset });
    if (!gl) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ ledger: gl });
  } catch (e) {
    console.error("[api/accounting/general-ledger]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to build the ledger" }, { status: 500 });
  }
}
