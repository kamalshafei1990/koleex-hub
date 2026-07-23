import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { behaviorLevel } from "@/lib/behavior/scoring";

/* GET /api/hr/behavior/reports — tenant-wide behavior reporting, computed from
   the LATEST FINALIZED assessment per employee (drafts don't count toward
   published numbers) plus a count of drafts awaiting finalization.
   HR module read; tenant-scoped. No private comments are ever returned here. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "HR");
  if (deny) return deny;

  const { data: rows } = await supabaseServer
    .from("employee_behavior_assessments")
    .select("employee_id, status, overall_behavior_score, position_behavior_match, critical_gap_count, finalized_at, created_at")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });
  const all = rows ?? [];

  /* Latest finalized per employee (rows are newest-first). */
  const latest = new Map<string, typeof all[number]>();
  let awaitingReview = 0;
  for (const r of all) {
    if (r.status !== "finalized") { if (r.status === "draft") awaitingReview++; continue; }
    if (!latest.has(r.employee_id)) latest.set(r.employee_id, r);
  }
  const finals = [...latest.values()];

  const scored = finals.filter((f) => f.overall_behavior_score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, f) => a + Number(f.overall_behavior_score), 0) / scored.length) : null;
  const avgMatch = (() => {
    const m = finals.filter((f) => f.position_behavior_match != null);
    return m.length ? Math.round(m.reduce((a, f) => a + Number(f.position_behavior_match), 0) / m.length) : null;
  })();
  const withCriticalGaps = finals.filter((f) => (f.critical_gap_count ?? 0) > 0).length;
  const belowAcceptable = scored.filter((f) => Number(f.overall_behavior_score) < 60).length;

  /* Distribution by behavior level. */
  const dist: Record<string, number> = { Unacceptable: 0, Poor: 0, "Needs Improvement": 0, Acceptable: 0, Strong: 0, Exemplary: 0 };
  for (const f of scored) dist[behaviorLevel(Number(f.overall_behavior_score))]++;

  return NextResponse.json({
    assessedEmployees: finals.length,
    averageBehaviorScore: avg,
    averagePositionMatch: avgMatch,
    withCriticalGaps,
    belowAcceptable,
    awaitingReview,
    distribution: dist,
  });
}
