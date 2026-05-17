import "server-only";

/* ===========================================================================
   GET /api/finance/fx/rate?from=USD&to=CNY&date=YYYY-MM-DD
   Returns { rate, effective_date }. 404 when no rate is configured.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { resolveRate, resolveBaseCurrency } from "@/lib/finance/currency";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const date = url.searchParams.get("date") ?? undefined;
  if (!from) return NextResponse.json({ error: "from currency required" }, { status: 400 });

  const to = toParam ?? (await resolveBaseCurrency(auth.tenant_id));
  try {
    const r = await resolveRate({ tenantId: auth.tenant_id, from, to, date });
    return NextResponse.json({ from: from.toUpperCase(), to: to.toUpperCase(), ...r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 404 });
  }
}
