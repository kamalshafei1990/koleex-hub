import "server-only";

/* ---------------------------------------------------------------------------
   pricing-engine-policy — the Commercial-Policy-driven pricing path.

   Pure computation. No DB calls here. The caller loads the policy
   snapshot + customer/product inputs and hands them over; this
   module returns a structured breakdown.

   Implements the 12-step flow documented in the reference portal
   (https://koleex-commercial-system.vercel.app/admin/pricing-algorithm):

     1. Factory Cost (CNY)
     2. Net Internal Cost  = Factory × (1 + cost_uplift_percent)
     3. Product Level      — detect L1-L4 from factory cost CNY
     4. Base Margin        — level.margin_percent (default in range)
     5. Global FOB (USD)   = Net Internal Cost USD × (1 + Base Margin)
     6. Regional FOB       = Global FOB × (1 + Band Adjustment)
     7. Channel Price      = Regional FOB × channel.multiplier
                             (keyed on customer tier -> applies_to_tier)
     8. Volume Discount    = auto-picked by total order USD
     9. Header Discount    = admin-entered (optional)
    10. Final Price        = Channel Price × (1 − total discount)
    11. Margin Check       — effective margin >= level.min_margin_percent
    12. Approval Required  — if discount exceeds tier cap OR effective
                             margin below floor

   Returns a breakdown rich enough to render the full "Base → Band →
   Channel → Discount → Final" story in the UI, plus the single
   `finalPriceUsd` for downstream callers that only need the number.

   This module is consumed by pricing-engine.ts (the main engine).
   Legacy override / market_price paths still win when present — the
   policy engine is the FALLBACK when no explicit price matches.
   --------------------------------------------------------------------------- */

import type {
  CommercialSettingsRow,
  ProductLevelRow,
  MarketBandRow,
  BandCountryRow,
  ChannelMultiplierRow,
  CustomerTierRow,
  VolumeDiscountTierRow,
  DiscountTierRow,
  CommissionTierRow,
} from "./commercial-policy";

export interface PolicyEngineInput {
  /** Factory cost in CNY (from product_suppliers.unit_cost_cny on the
   *  primary supplier). Required — the policy engine can't compute
   *  without a cost. */
  factoryCostCny: number;
  /** Line quantity — multiplied against the final unit price to get
   *  the line total which drives the volume-discount tier. */
  qty: number;
  /** ISO-2 country code the customer ships to. Used to resolve the
   *  market band. When missing / unmapped the engine falls back to
   *  Band B (Balanced) so pricing still yields a number. */
  customerCountryCode: string | null;
  /** Customer tier code (end_user, silver, gold, platinum, diamond).
   *  Drives which channel multiplier applies. */
  customerTierCode: string | null;
  /** Caller-provided header discount (0..100). Independent from the
   *  auto volume discount; they stack. */
  headerDiscountPercent?: number;
}

export interface PolicyEngineContext {
  settings: CommercialSettingsRow;
  productLevels: ProductLevelRow[];
  marketBands: MarketBandRow[];
  bandCountries: BandCountryRow[];
  channelMultipliers: ChannelMultiplierRow[];
  customerTiers: CustomerTierRow[];
  volumeDiscountTiers: VolumeDiscountTierRow[];
  discountTiers: DiscountTierRow[];
  commissionTiers: CommissionTierRow[];
}

export interface PolicyEngineBreakdown {
  /* Step 1-2. */
  factoryCostCny: number;
  netInternalCostCny: number;
  costUpliftPercent: number;
  /* FX. */
  fxCnyPerUsd: number;
  netInternalCostUsd: number;
  /* Step 3-4. */
  productLevelCode: string | null;
  productLevelName: string | null;
  baseMarginPercent: number | null;
  /* Step 5. */
  globalFobUsd: number | null;
  /* Step 6. */
  marketBandCode: string | null;
  marketBandAdjustmentPercent: number;
  regionalFobUsd: number | null;
  /* Step 7. */
  channelCode: string | null;
  channelMultiplier: number;
  channelPriceUsd: number | null;
  /* Step 8-9. */
  volumeTierCode: string | null;
  volumeDiscountPercent: number;
  headerDiscountPercent: number;
  totalDiscountPercent: number;
  /* Step 10. */
  unitPriceUsd: number | null;
  lineTotalUsd: number | null;
  /* Step 11-12. */
  effectiveMarginPercent: number | null;
  minMarginFloorPercent: number | null;
  discountCapPercent: number | null;
  approvalRequired: boolean;
  approvalReasons: string[];
  /* Extra: the commission estimate. */
  commissionPercent: number;
  commissionUsd: number | null;
  /* Trace. */
  notes: string[];
}

export interface PolicyEngineResult {
  /** Human-facing explanation safe to echo to the user. */
  explanation: string;
  /** Null when we couldn't produce a number (e.g. cost missing). */
  unitPriceUsd: number | null;
  lineTotalUsd: number | null;
  approvalRequired: boolean;
  breakdown: PolicyEngineBreakdown;
}

/* ─── Main entry point ──────────────────────────────────────── */

export function computePolicyPrice(
  input: PolicyEngineInput,
  ctx: PolicyEngineContext,
): PolicyEngineResult {
  const notes: string[] = [];
  const reasons: string[] = [];

  /* Step 1: Factory cost. */
  const factoryCostCny = Number(input.factoryCostCny);
  if (!Number.isFinite(factoryCostCny) || factoryCostCny <= 0) {
    return buildEmpty(
      input,
      ctx,
      `No factory cost available — can't compute a policy price.`,
    );
  }

  /* Step 2: Net Internal Cost. */
  const costUpliftPercent = Number(ctx.settings.cost_uplift_percent ?? 0);
  const netInternalCostCny = factoryCostCny * (1 + costUpliftPercent / 100);

  const fxCnyPerUsd = Number(ctx.settings.fx_cny_per_usd);
  if (!Number.isFinite(fxCnyPerUsd) || fxCnyPerUsd <= 0) {
    return buildEmpty(
      input,
      ctx,
      `FX rate (CNY per USD) is not configured on commercial_settings.`,
    );
  }
  const netInternalCostUsd = netInternalCostCny / fxCnyPerUsd;
  notes.push(
    `Factory ${fmt(factoryCostCny)} CNY → Net Internal ${fmt(netInternalCostCny)} CNY (uplift ${costUpliftPercent}%) → ${fmt(netInternalCostUsd, 2)} USD (fx ${fxCnyPerUsd}).`,
  );

  /* Step 3: Product Level (detect from factory cost CNY). */
  const level = ctx.productLevels
    .filter((l) => l.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .find(
      (l) =>
        factoryCostCny >= Number(l.min_cost_cny) &&
        (l.max_cost_cny === null || factoryCostCny <= Number(l.max_cost_cny)),
    );

  if (!level) {
    return buildEmpty(
      input,
      ctx,
      `No product level matches cost ${fmt(factoryCostCny)} CNY — check cost band coverage.`,
    );
  }
  notes.push(`Level ${level.code} (${level.name}): default margin ${level.margin_percent}%, floor ${level.min_margin_percent}%.`);

  /* Step 4-5: Global FOB. */
  const baseMarginPercent = Number(level.margin_percent);
  const globalFobUsd = netInternalCostUsd * (1 + baseMarginPercent / 100);

  /* Step 6: Regional Adjustment. */
  const band = resolveCountryBand(
    ctx.marketBands,
    ctx.bandCountries,
    input.customerCountryCode,
  );
  const bandAdjPct = band ? Number(band.adjustment_percent) : 0;
  const regionalFobUsd = globalFobUsd * (1 + bandAdjPct / 100);
  if (!band && input.customerCountryCode) {
    notes.push(`Country ${input.customerCountryCode} not mapped; defaulting to Band B (0%).`);
  }

  /* Step 7: Channel Price. */
  const channel = ctx.channelMultipliers
    .filter((c) => c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .find((c) => c.applies_to_tier === input.customerTierCode);

  // When no channel maps to this tier (e.g. customer is Diamond but
  // tenant doesn't have a Diamond channel row), the retail channel
  // is the pragmatic default. Falls further back to multiplier=1 so
  // the number stays sensible rather than going 0.
  const effectiveChannel =
    channel ??
    ctx.channelMultipliers.find((c) => c.applies_to_tier === "end_user") ??
    null;
  const channelMultiplier = effectiveChannel ? Number(effectiveChannel.multiplier) : 1;
  const channelPriceUsd = regionalFobUsd * channelMultiplier;
  if (!channel) {
    notes.push(
      `No channel row matches tier "${input.customerTierCode ?? "?"}"; used ${effectiveChannel?.code ?? "multiplier=1"} as fallback.`,
    );
  }

  /* Step 8: Volume discount — use line total (unit × qty) to pick the bucket. */
  const preDiscountLineUsd = channelPriceUsd * input.qty;
  const volumeTier = ctx.volumeDiscountTiers
    .filter((v) => v.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .find(
      (v) =>
        preDiscountLineUsd >= Number(v.min_order_usd) &&
        (v.max_order_usd === null || preDiscountLineUsd <= Number(v.max_order_usd)),
    );
  // Use the LOW end of the tier's discount range as the automatic
  // amount — a conservative default; admins can bump manually via
  // header discount if they want more.
  const volumeDiscountPercent = volumeTier
    ? Number(volumeTier.discount_min_percent)
    : 0;

  /* Step 9: Header discount (caller supplied). */
  const headerDiscountPercent = clampPercent(
    input.headerDiscountPercent ?? 0,
  );
  const totalDiscountPercent = clampPercent(volumeDiscountPercent + headerDiscountPercent);

  /* Step 10: Final Price. */
  const unitPriceUsd = round2(channelPriceUsd * (1 - totalDiscountPercent / 100));
  const lineTotalUsd = round2(unitPriceUsd * input.qty);

  /* Step 11: Margin check. */
  const effectiveMarginPercent = unitPriceUsd > 0
    ? ((unitPriceUsd - netInternalCostUsd) / unitPriceUsd) * 100
    : 0;
  const minMarginFloorPercent = Number(level.min_margin_percent);
  if (effectiveMarginPercent < minMarginFloorPercent) {
    reasons.push(
      `Effective margin ${round2(effectiveMarginPercent)}% < floor ${minMarginFloorPercent}%.`,
    );
  }

  /* Step 12: Approval check on discount cap by customer tier. */
  const tier = ctx.customerTiers.find((t) => t.code === input.customerTierCode);
  const discountCapPercent = tier ? Number(tier.discount_cap_percent) : null;
  if (
    discountCapPercent !== null &&
    totalDiscountPercent > discountCapPercent
  ) {
    reasons.push(
      `Total discount ${totalDiscountPercent}% exceeds ${tier?.name ?? "tier"} cap of ${discountCapPercent}%.`,
    );
  }

  /* Bonus: commission estimate (assumes the base "standard" tier;
     the real commission is assigned to a salesperson and computed
     after the invoice is paid). Surface it here for transparency. */
  const standardCommission =
    ctx.commissionTiers.find((c) => c.code === "standard") ??
    ctx.commissionTiers[0] ??
    null;
  const commissionPercent = standardCommission ? Number(standardCommission.rate_percent) : 0;
  const commissionUsd = round2((lineTotalUsd ?? 0) * commissionPercent / 100);

  const approvalRequired = reasons.length > 0;

  const explanation = buildExplanation({
    productLevelCode: level.code,
    marketBandCode: band?.code ?? null,
    channelCode: effectiveChannel?.code ?? null,
    totalDiscountPercent,
    unitPriceUsd,
    approvalRequired,
    reasons,
  });

  return {
    explanation,
    unitPriceUsd,
    lineTotalUsd,
    approvalRequired,
    breakdown: {
      factoryCostCny,
      netInternalCostCny: round2(netInternalCostCny),
      costUpliftPercent,
      fxCnyPerUsd,
      netInternalCostUsd: round2(netInternalCostUsd),
      productLevelCode: level.code,
      productLevelName: level.name,
      baseMarginPercent,
      globalFobUsd: round2(globalFobUsd),
      marketBandCode: band?.code ?? null,
      marketBandAdjustmentPercent: bandAdjPct,
      regionalFobUsd: round2(regionalFobUsd),
      channelCode: effectiveChannel?.code ?? null,
      channelMultiplier,
      channelPriceUsd: round2(channelPriceUsd),
      volumeTierCode: volumeTier?.code ?? null,
      volumeDiscountPercent,
      headerDiscountPercent,
      totalDiscountPercent,
      unitPriceUsd,
      lineTotalUsd,
      effectiveMarginPercent: round2(effectiveMarginPercent),
      minMarginFloorPercent,
      discountCapPercent,
      approvalRequired,
      approvalReasons: reasons,
      commissionPercent,
      commissionUsd,
      notes,
    },
  };
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function resolveCountryBand(
  bands: MarketBandRow[],
  bandCountries: BandCountryRow[],
  countryCode: string | null,
): MarketBandRow | null {
  if (!countryCode) return null;
  const mapping = bandCountries.find((bc) => bc.country_code === countryCode);
  if (!mapping) return null;
  return bands.find((b) => b.id === mapping.band_id) ?? null;
}

function buildEmpty(
  input: PolicyEngineInput,
  ctx: PolicyEngineContext,
  message: string,
): PolicyEngineResult {
  return {
    explanation: message,
    unitPriceUsd: null,
    lineTotalUsd: null,
    approvalRequired: true,
    breakdown: {
      factoryCostCny: Number(input.factoryCostCny) || 0,
      netInternalCostCny: 0,
      costUpliftPercent: Number(ctx.settings?.cost_uplift_percent ?? 0),
      fxCnyPerUsd: Number(ctx.settings?.fx_cny_per_usd ?? 0),
      netInternalCostUsd: 0,
      productLevelCode: null,
      productLevelName: null,
      baseMarginPercent: null,
      globalFobUsd: null,
      marketBandCode: null,
      marketBandAdjustmentPercent: 0,
      regionalFobUsd: null,
      channelCode: null,
      channelMultiplier: 1,
      channelPriceUsd: null,
      volumeTierCode: null,
      volumeDiscountPercent: 0,
      headerDiscountPercent: Number(input.headerDiscountPercent ?? 0),
      totalDiscountPercent: Number(input.headerDiscountPercent ?? 0),
      unitPriceUsd: null,
      lineTotalUsd: null,
      effectiveMarginPercent: null,
      minMarginFloorPercent: null,
      discountCapPercent: null,
      approvalRequired: true,
      approvalReasons: [message],
      commissionPercent: 0,
      commissionUsd: null,
      notes: [],
    },
  };
}

function buildExplanation(args: {
  productLevelCode: string;
  marketBandCode: string | null;
  channelCode: string | null;
  totalDiscountPercent: number;
  unitPriceUsd: number | null;
  approvalRequired: boolean;
  reasons: string[];
}): string {
  const bits: string[] = [];
  bits.push(`Level ${args.productLevelCode}`);
  if (args.marketBandCode) bits.push(`Band ${args.marketBandCode}`);
  if (args.channelCode) bits.push(`channel ${args.channelCode}`);
  if (args.totalDiscountPercent > 0) bits.push(`-${args.totalDiscountPercent}% discount`);
  bits.push(`unit ${fmt(args.unitPriceUsd ?? 0, 2)} USD`);
  if (args.approvalRequired) {
    return `${bits.join(" · ")} — ${args.reasons.join(" ")}`;
  }
  return bits.join(" · ");
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function fmt(n: number, digits = 0): string {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
}
