import "server-only";

/* GET /api/products/accessory-pricing?subcategory=<slug>&country=EG

   Complete-set helper: for a machine class (subcategory_slug), return the
   compatible accessory PRODUCTS (stands / tables) each already priced through
   the canonical engine (computePolicyPrice) on its own primary-supplier cost.

   The Price tab sums the head's Base FOB + the chosen accessories' Base FOB to
   show the complete-set price. Each accessory is a normal product priced on its
   own cost → no price-bearing variants (deferred to PD-V2).

   Returns: { accessories: [{ productId, name, role, costCny, baseFobUsd }] }
   Policy-admin gated (it exposes margins/cost-derived prices).
*/

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getPolicySnapshot } from "@/lib/server/commercial-policy";
import { computePolicyPrice } from "@/lib/server/pricing-engine-policy";

const POLICY_ADMIN_ROLES = new Set<string>(["super_admin", "admin", "general_manager"]);

async function callerHasPolicyAccess(roleId: string | null, isSuperAdmin: boolean): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (!roleId) return false;
  const { data } = await supabaseServer.from("roles").select("slug").eq("id", roleId).maybeSingle();
  const slug = (data as { slug?: string } | null)?.slug;
  return !!slug && POLICY_ADMIN_ROLES.has(slug);
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await callerHasPolicyAccess(auth.role_id, auth.is_super_admin))) {
    return NextResponse.json({ error: "forbidden", reason: "Commercial Policy access required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const subcategory = (url.searchParams.get("subcategory") || "").trim();
  const country = (url.searchParams.get("country") || "").toUpperCase() || null;
  if (!subcategory) return NextResponse.json({ accessories: [] });

  // 1. Mapped accessory products for this class.
  const { data: opts } = await supabaseServer
    .from("product_accessory_options")
    .select("accessory_product_id, role, is_default, sort_order")
    .eq("tenant_id", auth.tenant_id)
    .eq("subcategory_slug", subcategory)
    .order("role", { ascending: true })
    .order("sort_order", { ascending: true });

  const rows = opts ?? [];
  if (!rows.length) return NextResponse.json({ accessories: [] });

  const ids = [...new Set(rows.map((r) => (r as { accessory_product_id: string }).accessory_product_id))];

  // 2. Names (tenant-scoped) + primary-supplier cost for each accessory.
  const [{ data: prods }, { data: links }] = await Promise.all([
    supabaseServer.from("products").select("id, product_name, slug").eq("tenant_id", auth.tenant_id).in("id", ids),
    supabaseServer.from("product_suppliers").select("product_id, unit_cost_cny, is_primary").in("product_id", ids),
  ]);
  const nameOf = new Map((prods ?? []).map((p) => [(p as { id: string }).id, p as { product_name?: string; slug?: string }]));
  // Prefer the primary link's cost; fall back to any link with a cost.
  const costOf = new Map<string, number>();
  for (const l of links ?? []) {
    const row = l as { product_id: string; unit_cost_cny: number | null; is_primary: boolean };
    const c = Number(row.unit_cost_cny);
    if (!Number.isFinite(c) || c <= 0) continue;
    if (row.is_primary || !costOf.has(row.product_id)) costOf.set(row.product_id, c);
  }

  // 3. Price each accessory through the engine (Base FOB = its Global FOB
  //    carried to the market band, tier-agnostic — same basis as the head's
  //    "Base FOB" hero).
  const ctx = await getPolicySnapshot(auth.tenant_id);
  if (!ctx.settings) return NextResponse.json({ accessories: [] });
  const engineCtx = {
    settings: ctx.settings,
    productLevels: ctx.productLevels,
    marketBands: ctx.marketBands,
    bandCountries: ctx.bandCountries,
    channelMultipliers: ctx.channelMultipliers,
    customerTiers: ctx.customerTiers,
    volumeDiscountTiers: ctx.volumeDiscountTiers,
    discountTiers: ctx.discountTiers,
    commissionTiers: ctx.commissionTiers,
  };
  const tier0 = [...ctx.customerTiers].filter((t) => t.is_active).sort((a, b) => a.level_number - b.level_number)[0]?.code ?? null;

  const accessories = rows.map((r0) => {
    const r = r0 as { accessory_product_id: string; role: string };
    const costCny = costOf.get(r.accessory_product_id) ?? null;
    let baseFobUsd: number | null = null;
    if (costCny != null) {
      const res = computePolicyPrice(
        { factoryCostCny: costCny, qty: 1, customerCountryCode: country, customerTierCode: tier0 },
        engineCtx,
      );
      baseFobUsd = res.breakdown.regionalFobUsd ?? res.breakdown.globalFobUsd ?? null;
    }
    const p = nameOf.get(r.accessory_product_id);
    return {
      productId: r.accessory_product_id,
      name: p?.product_name || p?.slug || "Accessory",
      role: r.role,
      costCny,
      baseFobUsd: baseFobUsd != null ? Math.round(baseFobUsd * 100) / 100 : null,
    };
  });

  return NextResponse.json(
    { accessories },
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } },
  );
}
