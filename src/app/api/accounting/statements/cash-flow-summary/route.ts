import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildCashFlowSummary } from "@/lib/accounting/aging";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const today = new Date();
  const from  = url.searchParams.get("from") ?? new Date(today.getUTCFullYear(), 0, 1).toISOString().slice(0, 10);
  const to    = url.searchParams.get("to")   ?? today.toISOString().slice(0, 10);

  try {
    const report = await buildCashFlowSummary({ tenantId: auth.tenant_id, from, to });
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
