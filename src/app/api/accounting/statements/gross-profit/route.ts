import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildGrossProfit } from "@/lib/accounting/aging";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

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
