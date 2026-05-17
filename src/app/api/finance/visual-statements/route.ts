import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildVisualSnapshot, type Granularity } from "@/lib/finance/visual-statements";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const granularity = (url.searchParams.get("granularity") ?? "year") as Granularity;
  if (!["week", "quarter", "year"].includes(granularity)) {
    return NextResponse.json({ error: "granularity must be week | quarter | year" }, { status: 400 });
  }
  try {
    const snapshot = await buildVisualSnapshot(auth.tenant_id, granularity);
    return NextResponse.json({ snapshot });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
