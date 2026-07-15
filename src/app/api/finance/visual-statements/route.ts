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
  if (!["week", "month", "quarter", "year"].includes(granularity)) {
    return NextResponse.json({ error: "granularity must be week | month | quarter | year" }, { status: 400 });
  }
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  const periodEnd = url.searchParams.get("period_end") ?? undefined;
  const compareEnd = url.searchParams.get("compare_end") ?? undefined;
  if (periodEnd && !isoRe.test(periodEnd)) {
    return NextResponse.json({ error: "period_end must be ISO yyyy-mm-dd" }, { status: 400 });
  }
  if (compareEnd && !isoRe.test(compareEnd)) {
    return NextResponse.json({ error: "compare_end must be ISO yyyy-mm-dd" }, { status: 400 });
  }
  try {
    const snapshot = await buildVisualSnapshot(auth.tenant_id, granularity, {
      periodEnd,
      compareEnd,
    });
    /* PERF: the snapshot aggregates journal lines across several periods and
       takes ~2s to build. Finance figures change slowly, so cache it in the
       browser (keyed by the URL, i.e. granularity + period). max-age keeps it
       fresh for 60s; stale-while-revalidate then serves the last snapshot
       INSTANTLY for up to 5 min while a fresh one loads in the background — so
       the heavy recompute never blocks a navigation after the first load. */
    return NextResponse.json({ snapshot }, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
