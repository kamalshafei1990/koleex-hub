import "server-only";

/* GET /api/products/price-preview?cost_cny=75000&country=EG&qty=1

   Live pricing breakdown for the Product Data → Price tab. Runs the same
   canonical policy engine the rest of the system uses (computePolicyPrice)
   against the LIVE Commercial-Setup snapshot, so the numbers shown on a
   product always reflect the current commercial configuration. Change a
   level margin / market band / channel multiplier in Commercial Setup and
   this recomputes — no duplicated math.

   Returns:
     - base:    cost → net internal → level → margin → Global FOB (USD)
     - market:  the selected country's band + adjustment → Regional FOB
     - channels[]: one row per customer tier (channel) → unit price + margin
     - markets[]: a compact set of key markets → regional FOB (for context)

   Gated to the same roles as the commercial policy (it exposes margins).
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

/* A handful of representative markets so the tab can show "what this costs
   into the main regions" without the operator picking each one. */
const KEY_MARKETS = ["EG", "SA", "AE", "US", "DE", "CN", "NG", "IN", "BR", "TR"];

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const allowed = await callerHasPolicyAccess(auth.role_id, auth.is_super_admin);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", reason: "Commercial Policy access required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const costCny = Number(url.searchParams.get("cost_cny"));
  const country = (url.searchParams.get("country") || "").toUpperCase() || null;
  const qty = Math.max(1, Number(url.searchParams.get("qty")) || 1);

  if (!Number.isFinite(costCny) || costCny <= 0) {
    return NextResponse.json({ error: "cost_cny must be a positive number" }, { status: 400 });
  }

  const ctx = await getPolicySnapshot(auth.tenant_id);

  if (!ctx.settings) {
    return NextResponse.json({ error: "Commercial policy not configured for this tenant." }, { status: 409 });
  }

  // Engine ctx shape (the snapshot already matches PolicyEngineContext keys).
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

  const tiers = [...ctx.customerTiers]
    .filter((t) => t.is_active)
    .sort((a, b) => a.level_number - b.level_number || a.sort_order - b.sort_order);

  // Base + market come from a single run (tier-agnostic up to step 6).
  const ref = computePolicyPrice(
    { factoryCostCny: costCny, qty, customerCountryCode: country, customerTierCode: tiers[0]?.code ?? null },
    engineCtx,
  );
  const b = ref.breakdown;

  if (b.globalFobUsd == null) {
    return NextResponse.json({ error: ref.explanation, base: b }, { status: 200 });
  }

  // Channel ladder: one engine run per customer tier (qty=1 = unit list price).
  const channels = tiers.map((t) => {
    const r = computePolicyPrice(
      { factoryCostCny: costCny, qty: 1, customerCountryCode: country, customerTierCode: t.code },
      engineCtx,
    );
    const price = r.breakdown.channelPriceUsd;
    const cost = r.breakdown.netInternalCostUsd;
    const refund = r.breakdown.taxRefundUsd;
    // PURE margin = commercial margin only, never blended with the VAT refund —
    // this is the governed number. EFFECTIVE margin adds the refund as a
    // separate, clearly-labelled line on top.
    const pureProfitUsd = price != null ? price - cost : null;
    const profitWithRefundUsd = pureProfitUsd != null ? pureProfitUsd + refund : null;
    return {
      tierCode: t.code,
      tierName: t.name,
      channelCode: r.breakdown.channelCode,
      multiplier: r.breakdown.channelMultiplier,
      // Channel LIST price = pre-discount (per spec: "discounts are applied
      // after the channel price is determined"). Volume / header discounts
      // belong to the quotation, not the catalog list — this keeps the list
      // identical to the Price Calculator.
      unitPriceUsd: price,
      // Pure commercial margin (no tax refund) — the number the floor/approval
      // governs against.
      pureProfitUsd: pureProfitUsd != null ? Math.round(pureProfitUsd * 100) / 100 : null,
      pureMarginPercent:
        price && price > 0 ? Math.round((pureProfitUsd! / price) * 1000) / 10 : null,
      // Tax refund as a separate line + the refund-inclusive total.
      taxRefundUsd: Math.round(refund * 100) / 100,
      profitWithRefundUsd: profitWithRefundUsd != null ? Math.round(profitWithRefundUsd * 100) / 100 : null,
      marginWithRefundPercent:
        price && price > 0 ? Math.round((profitWithRefundUsd! / price) * 1000) / 10 : null,
      // Back-compat alias (was the pre-refund margin all along).
      effectiveMarginPercent:
        price && price > 0 ? Math.round((pureProfitUsd! / price) * 1000) / 10 : null,
      approvalRequired: r.breakdown.approvalRequired,
    };
  });

  // Key markets: regional FOB per market (cheap — pure multiply off globalFob).
  const markets = KEY_MARKETS.map((code) => {
    const r = computePolicyPrice(
      { factoryCostCny: costCny, qty: 1, customerCountryCode: code, customerTierCode: tiers[0]?.code ?? null },
      engineCtx,
    );
    return {
      code,
      bandCode: r.breakdown.marketBandCode,
      adjustmentPercent: r.breakdown.marketBandAdjustmentPercent,
      regionalFobUsd: r.breakdown.regionalFobUsd,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      country,
      fxCnyPerUsd: b.fxCnyPerUsd,
      fxEffectiveCnyPerUsd: b.fxEffectiveCnyPerUsd,
      fxSafetyBufferPercent: b.fxSafetyBufferPercent,
      fxUpdatedAt: (ctx.settings as { updated_at?: string | null }).updated_at ?? null,
      costUpliftPercent: b.costUpliftPercent,
      taxRefundRatePercent: b.taxRefundRatePercent,
      taxRefundUsd: b.taxRefundUsd,
      base: {
        factoryCostCny: b.factoryCostCny,
        netInternalCostCny: b.netInternalCostCny,
        netInternalCostUsd: b.netInternalCostUsd,
        productLevelCode: b.productLevelCode,
        productLevelName: b.productLevelName,
        baseMarginPercent: b.baseMarginPercent,
        minMarginFloorPercent: b.minMarginFloorPercent,
        globalFobUsd: b.globalFobUsd,
      },
      market: {
        countryCode: country,
        bandCode: b.marketBandCode,
        adjustmentPercent: b.marketBandAdjustmentPercent,
        regionalFobUsd: b.regionalFobUsd,
      },
      channels,
      markets,
    },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}
