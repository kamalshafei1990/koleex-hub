import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/work-reports/compliance/stats?months=6 — compliance by month
   (owner's pick 26/09/2026): each person's months (on time, late, missing,
   pending) and the team's, over the last 1–12 months counting has run.

   The compliance board's scope: a super admin and HR·view see everyone; a
   manager their own people at every level; anyone else nobody. Whether a
   report was sent, never its text (src/lib/server/reports/stats.ts).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireReportsUser } from "@/lib/server/reports/core";
import { loadComplianceStats } from "@/lib/server/reports/stats";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const raw = Number(new URL(req.url).searchParams.get("months"));
  const n = Number.isInteger(raw) && raw >= 1 && raw <= 12 ? raw : 6;
  try {
    return NextResponse.json(await loadComplianceStats(auth, n), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[reports.stats]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
