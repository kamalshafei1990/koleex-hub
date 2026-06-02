import "server-only";

/* /api/visual-registry/health → per-division registry health (coverage + intelligence) + global rollup. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { gatherScope } from "@/lib/visual-library/registry-coverage";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const tid = auth.tenant_id;

  const { data: divisions } = await supabaseServer.from("visual_divisions")
    .select("id, name, slug").eq("tenant_id", tid).eq("active", true).order("sort_order");

  const rows = await Promise.all((divisions ?? []).map(async (d) => {
    const r = await gatherScope(tid, "division", d.id as string);
    return {
      id: d.id, name: d.name, slug: d.slug,
      coverage_score: r?.coverage.coverage_score ?? 0,
      total_assets: r?.coverage.total_assets ?? 0,
      health: r?.intelligence.health ?? 0,
      ui_readiness: r?.intelligence.ui_readiness ?? 0,
      erp_readiness: r?.intelligence.erp_readiness ?? 0,
      website_readiness: r?.intelligence.website_readiness ?? 0,
      product_page_readiness: r?.intelligence.product_page_readiness ?? 0,
      dna_purity: r?.intelligence.dna_purity ?? 0,
      visual_consistency: r?.intelligence.visual_consistency ?? 0,
      missing_systems: r?.intelligence.missing_systems ?? 0,
    };
  }));

  const n = rows.length || 1;
  const sum = (k: keyof (typeof rows)[number]) => Math.round(rows.reduce((a, r) => a + (r[k] as number), 0) / n);
  const global = {
    divisions: rows.length,
    total_assets: rows.reduce((a, r) => a + r.total_assets, 0),
    health: sum("health"), coverage_score: sum("coverage_score"),
    ui_readiness: sum("ui_readiness"), erp_readiness: sum("erp_readiness"),
    website_readiness: sum("website_readiness"), product_page_readiness: sum("product_page_readiness"),
    design_consistency: sum("visual_consistency"),
  };
  return NextResponse.json({ divisions: rows, global });
}
