import "server-only";

/* /api/visual-registry/missing-assets → deterministic gaps: product systems with
   no visual asset, plus subcategories with zero linked assets. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Database");
  if (deny) return deny;
  const tid = auth.tenant_id;

  const [{ data: systems }, { data: links }, { data: subs }] = await Promise.all([
    supabaseServer.from("visual_product_systems")
      .select("id, name, system_type, subcategory:visual_subcategories(name)").eq("tenant_id", tid).eq("active", true),
    supabaseServer.from("visual_asset_registry_links").select("product_system_id, subcategory_id").eq("tenant_id", tid),
    supabaseServer.from("visual_subcategories")
      .select("id, name, category:visual_categories(name)").eq("tenant_id", tid).eq("active", true),
  ]);

  const linkedSystems = new Set((links ?? []).map((l) => l.product_system_id).filter(Boolean) as string[]);
  const linkedSubs = new Set((links ?? []).map((l) => l.subcategory_id).filter(Boolean) as string[]);

  const missing_systems = (systems ?? [])
    .filter((s) => !linkedSystems.has(s.id as string))
    .map((s) => ({ id: s.id, name: s.name, system_type: s.system_type, subcategory: (s.subcategory as { name?: string } | null)?.name ?? null }));

  const empty_subcategories = (subs ?? [])
    .filter((s) => !linkedSubs.has(s.id as string))
    .map((s) => ({ id: s.id, name: s.name, category: (s.category as { name?: string } | null)?.name ?? null }));

  return NextResponse.json({
    missing_systems, empty_subcategories,
    counts: { missing_systems: missing_systems.length, empty_subcategories: empty_subcategories.length,
      systems_total: (systems ?? []).length, subcategories_total: (subs ?? []).length },
  });
}
