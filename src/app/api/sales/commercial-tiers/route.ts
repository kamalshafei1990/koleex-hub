import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/sales/commercial-tiers?view=commissions|discounts — RLS-5.

   Replaces the Sales app's Commissions / Discounts modules' direct anon
   reads of commercial_*_tiers (+ crm_opportunities for the MTD commission
   estimate) so those tables can be locked to service_role. Tenant-scoped,
   gated on the Sales module.

   Note: the old anon crm_opportunities read was already RLS-blocked and
   silently returned [] — routing it through the service client makes the
   Commissions MTD estimate actually work.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Sales");
  if (deny) return deny;
  const tid = auth.tenant_id;

  const view = new URL(req.url).searchParams.get("view") ?? "";

  if (view === "commissions") {
    const [tiersR, wonR] = await Promise.all([
      supabaseServer
        .from("commercial_commission_tiers")
        .select("id,code,name,rate_percent,applies_to,sort_order,is_active")
        .eq("tenant_id", tid)
        .order("sort_order", { ascending: true, nullsFirst: false }),
      supabaseServer
        .from("crm_opportunities")
        .select("id,expected_revenue,won_at")
        .eq("tenant_id", tid)
        .not("won_at", "is", null),
    ]);
    return NextResponse.json({ tiers: tiersR.data ?? [], won: wonR.data ?? [] });
  }

  if (view === "discounts") {
    const [dR, vR] = await Promise.all([
      supabaseServer
        .from("commercial_discount_tiers")
        .select("id,code,label,min_percent,max_percent,approver_role,sort_order,is_active")
        .eq("tenant_id", tid)
        .order("sort_order", { ascending: true, nullsFirst: false }),
      supabaseServer
        .from("commercial_volume_discount_tiers")
        .select("id,code,name,min_order_usd,max_order_usd,discount_min_percent,discount_max_percent,sort_order,is_active")
        .eq("tenant_id", tid)
        .order("sort_order", { ascending: true, nullsFirst: false }),
    ]);
    return NextResponse.json({ tiers: dR.data ?? [], volumes: vR.data ?? [] });
  }

  return NextResponse.json({ error: "Unknown view" }, { status: 400 });
}
