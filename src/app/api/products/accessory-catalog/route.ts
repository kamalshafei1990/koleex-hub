import "server-only";

/* GET /api/products/accessory-catalog

   ST-3: the Stands & Tables catalog for the complete-set configurator. Returns
   every Stand / Table product (subcategory stands/tables) with its base cost
   (CNY, from the primary supplier link) and its configurable option values
   (axis · value · price delta). The client builds the configurator from this,
   computes configured cost = base + Σ selected deltas, then prices each through
   the engine (via /api/products/price-preview) and sums with the head.

   Returns: { tables: AccessoryProduct[], stands: AccessoryProduct[] }
   Policy-admin gated (exposes cost). Tenant-scoped.
*/

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

const POLICY_ADMIN_ROLES = new Set<string>(["super_admin", "admin", "general_manager"]);

async function callerHasPolicyAccess(roleId: string | null, isSuperAdmin: boolean): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (!roleId) return false;
  const { data } = await supabaseServer.from("roles").select("slug").eq("id", roleId).maybeSingle();
  const slug = (data as { slug?: string } | null)?.slug;
  return !!slug && POLICY_ADMIN_ROLES.has(slug);
}

interface OptionValue { axis: string; value: string; priceDelta: number; affectsPrice: boolean; isDefault: boolean; sortOrder: number; }
interface AccessoryProduct { productId: string; name: string; baseCostCny: number | null; options: OptionValue[]; }

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await callerHasPolicyAccess(auth.role_id, auth.is_super_admin))) {
    return NextResponse.json({ error: "forbidden", reason: "Commercial Policy access required" }, { status: 403 });
  }

  // Stand / Table products in this tenant.
  const { data: prods } = await supabaseServer
    .from("products")
    .select("id, product_name, slug, subcategory_slug")
    .eq("tenant_id", auth.tenant_id)
    .in("subcategory_slug", ["tables", "stands"]);

  const list = (prods ?? []) as { id: string; product_name?: string; slug?: string; subcategory_slug: string }[];
  if (!list.length) return NextResponse.json({ tables: [], stands: [] });

  const ids = list.map((p) => p.id);
  const [{ data: links }, { data: opts }] = await Promise.all([
    supabaseServer.from("product_suppliers").select("product_id, unit_cost_cny, is_primary").in("product_id", ids),
    supabaseServer.from("accessory_option_values").select("product_id, axis, value, price_delta_cny, affects_price, is_default, sort_order").in("product_id", ids),
  ]);

  const costOf = new Map<string, number>();
  for (const l of links ?? []) {
    const row = l as { product_id: string; unit_cost_cny: number | null; is_primary: boolean };
    const c = Number(row.unit_cost_cny);
    if (!Number.isFinite(c) || c <= 0) continue;
    if (row.is_primary || !costOf.has(row.product_id)) costOf.set(row.product_id, c);
  }
  const optsOf = new Map<string, OptionValue[]>();
  for (const o of opts ?? []) {
    const r = o as { product_id: string; axis: string; value: string; price_delta_cny: number; affects_price: boolean; is_default: boolean; sort_order: number };
    if (!optsOf.has(r.product_id)) optsOf.set(r.product_id, []);
    optsOf.get(r.product_id)!.push({ axis: r.axis, value: r.value, priceDelta: Number(r.price_delta_cny) || 0, affectsPrice: !!r.affects_price, isDefault: !!r.is_default, sortOrder: r.sort_order });
  }

  const build = (p: typeof list[number]): AccessoryProduct => ({
    productId: p.id,
    name: p.product_name || p.slug || "Accessory",
    baseCostCny: costOf.get(p.id) ?? null,
    options: (optsOf.get(p.id) ?? []).sort((a, b) => a.axis.localeCompare(b.axis) || a.sortOrder - b.sortOrder),
  });

  return NextResponse.json(
    {
      tables: list.filter((p) => p.subcategory_slug === "tables").map(build),
      stands: list.filter((p) => p.subcategory_slug === "stands").map(build),
    },
    { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=120" } },
  );
}
