import "server-only";

/* /api/design-dna/health — global brand-design-health metrics (backend ready;
   dashboard UI later). Aggregates over cached asset_dna_analysis + quality. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

async function count(tid: string, build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) {
  const r = await build(base(tid)); return r.count ?? 0;
}
function base(tid: string) {
  return supabaseServer.from("asset_dna_analysis").select("id", { count: "exact", head: true }).eq("tenant_id", tid);
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const tid = auth.tenant_id;

  const [analyzed, offBrand, weakReadability, drift] = await Promise.all([
    count(tid, (q) => q),
    count(tid, (q) => q.eq("violates_brand_language", true)),
    count(tid, (q) => q.lt("readability_score", 55)),
    count(tid, (q) => q.eq("inconsistent_stroke", true)),
  ]);
  // Average overall (brand consistency) over analyzed rows.
  const { data: avgRows } = await supabaseServer.from("asset_dna_analysis").select("overall_score").eq("tenant_id", tid).limit(5000);
  const brandConsistency = (avgRows && avgRows.length)
    ? Math.round(avgRows.reduce((s, r) => s + (r.overall_score as number), 0) / avgRows.length) : null;

  // Duplicate style count (from quality engine, if computed).
  const { count: dupCount } = await supabaseServer.from("visual_asset_quality")
    .select("id", { count: "exact", head: true }).eq("tenant_id", tid).gte("duplicate_risk_score", 55);

  return NextResponse.json({
    analyzed,
    brand_consistency_pct: brandConsistency,
    off_brand_assets: offBrand,
    visual_drift_count: drift,
    weak_readability_assets: weakReadability,
    duplicate_style_count: dupCount ?? 0,
    note: "Metrics cover assets whose DNA has been computed (lazy, on workspace open).",
  });
}
