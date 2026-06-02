import "server-only";

/* Review Board dashboard — counts + distributions (review/quality/dna). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

function band(n: number) { return n >= 80 ? "high" : n >= 55 ? "mid" : "low"; }

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const tid = auth.tenant_id;

  const head = (t: string, f: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => f(base(t)).then((r) => r.count ?? 0);
  function base(table: string) { return supabaseServer.from(table).select("id", { count: "exact", head: true }).eq("tenant_id", tid); }

  const [totalAssets, reviewed, pending, approved, approvedNotes, needsRevision, rejected, deprecated, replaceRec, productionReady, highRisk, criticalRisk] = await Promise.all([
    head("visual_assets", (q) => q),
    head("visual_asset_reviews", (q) => q),
    head("visual_asset_reviews", (q) => q.eq("review_status", "pending")),
    head("visual_asset_reviews", (q) => q.eq("review_status", "approved")),
    head("visual_asset_reviews", (q) => q.eq("review_status", "approved_with_notes")),
    head("visual_asset_reviews", (q) => q.eq("review_status", "needs_revision")),
    head("visual_asset_reviews", (q) => q.eq("review_status", "rejected")),
    head("visual_asset_reviews", (q) => q.eq("review_status", "deprecated")),
    head("visual_asset_reviews", (q) => q.eq("review_status", "replace_recommended")),
    head("visual_asset_reviews", (q) => q.eq("production_ready", true)),
    head("visual_asset_reviews", (q) => q.eq("risk_level", "high")),
    head("visual_asset_reviews", (q) => q.eq("risk_level", "critical")),
  ]);

  // Distributions over computed engines (sampled to 5000 for safety).
  const [{ data: quality }, { data: dna }] = await Promise.all([
    supabaseServer.from("visual_asset_quality").select("quality_score, duplicate_risk_score").eq("tenant_id", tid).limit(5000),
    supabaseServer.from("asset_dna_analysis").select("overall_score").eq("tenant_id", tid).limit(5000),
  ]);
  const qDist = { high: 0, mid: 0, low: 0 }, dDist = { high: 0, mid: 0, low: 0 };
  let dupRisk = 0;
  for (const r of quality ?? []) { qDist[band(r.quality_score as number) as keyof typeof qDist]++; if ((r.duplicate_risk_score as number) >= 55) dupRisk++; }
  for (const r of dna ?? []) dDist[band(r.overall_score as number) as keyof typeof dDist]++;

  return NextResponse.json({
    cards: {
      total_assets: totalAssets, reviewed, pending, approved: approved + approvedNotes,
      needs_revision: needsRevision, rejected, deprecated, replace_recommended: replaceRec,
      production_ready: productionReady, high_risk: highRisk + criticalRisk,
    },
    distributions: { quality: qDist, dna: dDist, duplicate_risk_high: dupRisk },
  });
}
