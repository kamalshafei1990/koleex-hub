import "server-only";

/* GET /api/commercial-policy/pricing-model

   The live pricing MODEL the Price Calculator needs to reproduce the exact
   commercial-policy engine client-side: product levels (cost bands +
   margin), the sequential channel ladder, customer-tier labels, and the
   FX / cost-uplift settings. Country band adjustments come from the sibling
   /market-adjustments endpoint.

   Auth-only (not policy-admin gated) — the Price Calculator is an internal
   what-if tool already used beyond admins, and this exposes the same level/
   channel structure it has always shown. If the tenant has no levels/
   channels configured, the arrays are empty so callers keep their defaults. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const [lvl, chan, tiers, settings] = await Promise.all([
    supabaseServer.from("commercial_product_levels")
      .select("code, name, min_cost_cny, max_cost_cny, margin_percent, min_margin_percent, is_active, sort_order")
      .eq("tenant_id", auth.tenant_id).eq("is_active", true).order("sort_order", { ascending: true }),
    supabaseServer.from("commercial_channel_multipliers")
      .select("code, applies_to_tier, multiplier, is_active, sort_order")
      .eq("tenant_id", auth.tenant_id).eq("is_active", true).order("sort_order", { ascending: true }),
    supabaseServer.from("commercial_customer_tiers")
      .select("code, name, level_number, is_active, sort_order")
      .eq("tenant_id", auth.tenant_id).eq("is_active", true).order("level_number", { ascending: true }),
    supabaseServer.from("commercial_settings")
      .select("fx_cny_per_usd, cost_uplift_percent, fx_safety_buffer_percent")
      .eq("tenant_id", auth.tenant_id).maybeSingle(),
  ]);

  return NextResponse.json(
    {
      levels: (lvl.data ?? []).map((l) => ({
        code: l.code,
        name: l.name,
        minCostCny: Number(l.min_cost_cny),
        maxCostCny: l.max_cost_cny == null ? null : Number(l.max_cost_cny),
        marginPercent: Number(l.margin_percent),
        minMarginPercent: Number(l.min_margin_percent),
      })),
      channels: (chan.data ?? []).map((c) => ({
        tier: c.applies_to_tier as string | null,
        code: c.code as string,
        multiplier: Number(c.multiplier),
        isRetail: c.applies_to_tier === "end_user" || /retail/i.test(c.code),
      })),
      tiers: (tiers.data ?? []).map((t) => ({ code: t.code, name: t.name, level: t.level_number })),
      settings: {
        fxCnyPerUsd: settings.data ? Number(settings.data.fx_cny_per_usd) : null,
        costUpliftPercent: settings.data ? Number(settings.data.cost_uplift_percent ?? 0) : 0,
        fxSafetyBufferPercent: settings.data ? Number(settings.data.fx_safety_buffer_percent ?? 0) : 0,
      },
    },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}
