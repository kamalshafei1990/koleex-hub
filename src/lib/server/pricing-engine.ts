import "server-only";

/* ---------------------------------------------------------------------------
   pricing-engine — Koleex's deterministic server-side pricing logic.

   CRITICAL: the LLM NEVER calls into this except via calculateQuotationPricing.
   It takes structured input and returns structured output. No free-text
   reasoning, no probabilistic rounding, no "I think this customer gets
   a better rate" — every number here is produced by code, not by a model.

   Pricing resolution order for a line (product × customer × market × qty):

     1. customer_price_overrides  — explicit per-customer per-product price
     2. product_market_prices     — per-market catalog price (by country_code)
     3. price_list_items (via customer_pricing)  — named price list
     4. fallback: unresolved  → line is flagged and the whole quote gets
        approval_required status (no guessing)

   Margin + discount rules come from pricing_customer_types keyed by
   (market_id, customer_type). Hard floors: if the result falls below
   min_margin_percent OR exceeds max_discount_percent, the line gets
   `approvalRequired=true` and the caller MUST route it through an
   approver rather than auto-saving.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "./supabase-server";
import {
  computePolicyPrice,
  type PolicyEngineContext,
  type PolicyEngineBreakdown,
} from "./pricing-engine-policy";
import { getPolicySnapshot } from "./commercial-policy";

/* ─── Inputs ─────────────────────────────────────────── */

export interface PricingLineInput {
  /** The product.id (uuid). */
  productId: string;
  /** Quantity requested. */
  qty: number;
}

export interface PricingEngineInput {
  tenantId: string;
  customerId: string;
  lines: PricingLineInput[];
  /** Optional currency override ('USD', 'CNY', 'EUR', ...). Default: market currency. */
  currencyOverride?: string;
  /** Optional header discount % (0..100). */
  headerDiscountPercent?: number;
}

/* ─── Outputs ────────────────────────────────────────── */

export type PricingLineStatus = "priced" | "no_price" | "out_of_policy";

export interface PricingLineResult {
  productId: string;
  productName: string | null;
  qty: number;
  /** Resolved unit price before header discount / line discount. */
  unitPrice: number | null;
  /** Line-level discount % (from pricing_customer_types). */
  lineDiscountPercent: number;
  /** qty × unitPrice × (1 - lineDiscountPercent/100) — null if unpriced. */
  lineTotal: number | null;
  /** Source the price came from. */
  priceSource:
    | "customer_override"
    | "market_price"
    | "price_list"
    | "policy_engine"
    | "unresolved";
  /** Full 12-step breakdown when priceSource="policy_engine". Surface
   *  for the UI to render "Base → Band → Channel → Discount → Final". */
  policyBreakdown?: PolicyEngineBreakdown;
  /** True if margin below min_margin_percent or discount above max. */
  approvalRequired: boolean;
  /** Pricing-engine-friendly status. */
  status: PricingLineStatus;
  /** Human-facing explanation of the number (safe for the LLM to echo). */
  explanation: string;
}

export interface PricingEngineResult {
  currency: string;
  customerType: string | null;
  marketId: string | null;
  lines: PricingLineResult[];
  subtotal: number;
  headerDiscountPercent: number;
  headerDiscount: number;
  total: number;
  /** Any line with approvalRequired OR any unresolved price → true. */
  approvalRequired: boolean;
  /** Ordered list of sources consulted. */
  sources: string[];
  /** Any line's issue bubbles up here for the caller to surface. */
  warnings: string[];
}

/* ─── Engine ─────────────────────────────────────────── */

export async function calculatePricing(
  input: PricingEngineInput,
): Promise<PricingEngineResult> {
  const { tenantId, customerId, lines } = input;
  const sources: string[] = [];
  const warnings: string[] = [];

  /* 1. Customer → market + customer_type */
  const { data: customer } = await supabaseServer
    .from("customers")
    .select("id, name, customer_type, market_id, currency_code")
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) {
    return emptyResult(
      input.currencyOverride ?? "USD",
      lines,
      "Customer not found — can't price.",
    );
  }
  sources.push(`customers(${customer.id.slice(0, 8)})`);

  const marketId = customer.market_id ?? null;
  const customerType = customer.customer_type ?? null;

  /* 2. Market rules (currency, duty, adjustments) */
  const market = marketId
    ? await supabaseServer
        .from("pricing_markets")
        .select("currency_code, market_adjustment_percent, is_active")
        .eq("market_id", marketId)
        .maybeSingle()
        .then((r) => r.data ?? null)
    : null;
  if (market) sources.push(`pricing_markets(market=${marketId?.slice(0, 8)})`);

  /* 3. Customer-type rules (margin + discount limits) */
  const typeRules = marketId && customerType
    ? await supabaseServer
        .from("pricing_customer_types")
        .select(
          "margin_percent, discount_percent, min_margin_percent, max_discount_percent, is_active",
        )
        .eq("market_id", marketId)
        .eq("customer_type", customerType)
        .maybeSingle()
        .then((r) => r.data ?? null)
    : null;
  if (typeRules) {
    sources.push(
      `pricing_customer_types(${customerType}/${marketId?.slice(0, 8)})`,
    );
  }

  /* Default discount for this line. Falls back to 0 if no rule row. */
  const lineDiscountPercent = Number(typeRules?.discount_percent ?? 0);

  /* 4. Customer country (for product_market_prices fallback). */
  const country = await resolveCountry(customer.id);
  if (country) sources.push(`customer_country(${country})`);

  /* 4b. Policy snapshot — loaded once per call when the tenant has
     `use_policy_engine` enabled. When disabled, we skip the load to
     keep legacy callers at their existing perf cost. The snapshot
     flows into priceOneLine and is used as the last resort before
     returning "unresolved" — so override / market_price / price_list
     still win when present, matching the original layered behaviour. */
  const snapshot = await getPolicySnapshot(tenantId);
  const policyContext: PolicyEngineContext | null =
    snapshot.settings?.use_policy_engine && snapshot.settings
      ? {
          settings: snapshot.settings,
          productLevels: snapshot.productLevels,
          marketBands: snapshot.marketBands,
          bandCountries: snapshot.bandCountries,
          channelMultipliers: snapshot.channelMultipliers,
          customerTiers: snapshot.customerTiers,
          volumeDiscountTiers: snapshot.volumeDiscountTiers,
          discountTiers: snapshot.discountTiers,
          commissionTiers: snapshot.commissionTiers,
        }
      : null;
  if (policyContext) sources.push("commercial_policy(engine)");

  /* 5. Build per-line results. */
  const priced: PricingLineResult[] = [];
  for (const line of lines) {
    const result = await priceOneLine({
      tenantId,
      customerId: customer.id,
      country,
      customerType,
      line,
      lineDiscountPercent,
      minMarginPercent: typeRules?.min_margin_percent ?? null,
      maxDiscountPercent: typeRules?.max_discount_percent ?? null,
      policyContext,
      headerDiscountPercent: input.headerDiscountPercent ?? 0,
    });
    if (result.status !== "priced") {
      warnings.push(`Line "${result.productName ?? result.productId}" — ${result.explanation}`);
    }
    if (result.approvalRequired && result.status === "priced") {
      warnings.push(
        `Line "${result.productName ?? result.productId}" flagged for approval (${result.explanation}).`,
      );
    }
    priced.push(result);
  }

  /* 6. Totals. */
  const subtotal = priced.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
  const headerDiscountPercent = Math.max(
    0,
    Math.min(100, input.headerDiscountPercent ?? 0),
  );
  const headerDiscount = (subtotal * headerDiscountPercent) / 100;
  const total = round2(subtotal - headerDiscount);

  const anyUnresolved = priced.some((l) => l.status !== "priced");
  const anyOutOfPolicy = priced.some((l) => l.approvalRequired);

  /* market_adjustment_percent is intentionally NOT applied here — it's
     reserved for landed-cost calculations (how much the price needs to
     stretch to absorb duty/shipping). Quotation pricing stays at the
     customer-facing tier so what the rep sees is what the customer pays. */

  return {
    currency: input.currencyOverride
      ?? market?.currency_code
      ?? customer.currency_code
      ?? "USD",
    customerType,
    marketId,
    lines: priced,
    subtotal: round2(subtotal),
    headerDiscountPercent,
    headerDiscount: round2(headerDiscount),
    total,
    approvalRequired: anyUnresolved || anyOutOfPolicy,
    sources,
    warnings,
  };
}

/* ─── Helpers ────────────────────────────────────────── */

async function priceOneLine(args: {
  tenantId: string;
  customerId: string;
  country: string | null;
  customerType: string | null;
  line: PricingLineInput;
  lineDiscountPercent: number;
  minMarginPercent: number | null;
  maxDiscountPercent: number | null;
  /** Policy-engine context, only present when the tenant has the
   *  Commercial Policy engine enabled. When null, the legacy
   *  "unresolved" fallback applies. */
  policyContext: PolicyEngineContext | null;
  headerDiscountPercent: number;
}): Promise<PricingLineResult> {
  const { productId, qty } = args.line;

  /* Product (for name + for joining to product_market_prices via model). */
  const { data: product } = await supabaseServer
    .from("products")
    .select("id, product_name")
    .eq("id", productId)
    .maybeSingle();

  const productName = product?.product_name ?? null;

  /* 1. customer_price_overrides — explicit override wins. */
  const { data: override } = await supabaseServer
    .from("customer_price_overrides")
    .select("price")
    .eq("customer_id", args.customerId)
    .eq("product_id", productId)
    .maybeSingle();

  if (override && typeof override.price === "number") {
    return finalizeLine({
      productId, productName, qty,
      unitPrice: Number(override.price),
      lineDiscountPercent: 0, // overrides are post-discount by convention
      priceSource: "customer_override",
      maxDiscountPercent: args.maxDiscountPercent,
      minMarginPercent: args.minMarginPercent,
      note: "Using customer-specific price override.",
    });
  }

  /* 2. product_market_prices via model + country. */
  if (args.country) {
    const { data: modelPrice } = await supabaseServer
      .from("product_market_prices")
      .select("market_price, currency, model:product_models!inner(product_id)")
      .eq("country_code", args.country)
      .eq("product_models.product_id", productId)
      .maybeSingle();
    if (modelPrice && typeof modelPrice.market_price === "number") {
      return finalizeLine({
        productId, productName, qty,
        unitPrice: Number(modelPrice.market_price),
        lineDiscountPercent: args.lineDiscountPercent,
        priceSource: "market_price",
        maxDiscountPercent: args.maxDiscountPercent,
        minMarginPercent: args.minMarginPercent,
        note: `Market catalog price for ${args.country}.`,
      });
    }
  }

  /* 3. price_list_items via customer_pricing. */
  const { data: cp } = await supabaseServer
    .from("customer_pricing")
    .select("price_list_id")
    .eq("customer_id", args.customerId)
    .maybeSingle();
  if (cp?.price_list_id) {
    const { data: pli } = await supabaseServer
      .from("price_list_items")
      .select("price")
      .eq("price_list_id", cp.price_list_id)
      .eq("product_id", productId)
      .maybeSingle();
    if (pli && typeof pli.price === "number") {
      return finalizeLine({
        productId, productName, qty,
        unitPrice: Number(pli.price),
        lineDiscountPercent: args.lineDiscountPercent,
        priceSource: "price_list",
        maxDiscountPercent: args.maxDiscountPercent,
        minMarginPercent: args.minMarginPercent,
        note: "Using assigned price list.",
      });
    }
  }

  /* 4. Policy engine fallback — only when the tenant opted in via
        commercial_settings.use_policy_engine. Reads the product's
        primary-supplier cost (CNY), runs the 12-step flow against
        the policy snapshot, returns a computed price + breakdown.
        When the tenant hasn't opted in OR no supplier cost exists,
        we fall through to the legacy "unresolved" path so the
        engine's contract stays the same as today. */
  if (args.policyContext) {
    const { data: supplierCost } = await supabaseServer
      .from("product_suppliers")
      .select("unit_cost_cny")
      .eq("product_id", productId)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    const costCny = supplierCost?.unit_cost_cny;
    if (typeof costCny === "number" && costCny > 0) {
      const policyResult = computePolicyPrice(
        {
          factoryCostCny: costCny,
          qty,
          customerCountryCode: args.country,
          customerTierCode: args.customerType,
          headerDiscountPercent: 0, // header discount applied at the quote level, not per line
        },
        args.policyContext,
      );
      if (policyResult.unitPriceUsd !== null) {
        return {
          productId,
          productName,
          qty,
          unitPrice: policyResult.unitPriceUsd,
          lineDiscountPercent: policyResult.breakdown.totalDiscountPercent,
          lineTotal: policyResult.lineTotalUsd,
          priceSource: "policy_engine",
          policyBreakdown: policyResult.breakdown,
          approvalRequired: policyResult.approvalRequired,
          status: policyResult.approvalRequired ? "out_of_policy" : "priced",
          explanation: policyResult.explanation,
        };
      }
    }
  }

  /* 5. Unresolved — no guessing. */
  return {
    productId,
    productName,
    qty,
    unitPrice: null,
    lineDiscountPercent: 0,
    lineTotal: null,
    priceSource: "unresolved",
    approvalRequired: true,
    status: "no_price",
    explanation:
      "No price configured for this product in the customer's market. " +
      "Needs pricing set up before the quotation can be finalised.",
  };
}

function finalizeLine(args: {
  productId: string;
  productName: string | null;
  qty: number;
  unitPrice: number;
  lineDiscountPercent: number;
  priceSource: PricingLineResult["priceSource"];
  maxDiscountPercent: number | null;
  minMarginPercent: number | null;
  note: string;
}): PricingLineResult {
  const discount = Math.max(0, Math.min(100, args.lineDiscountPercent));
  const maxDiscount = args.maxDiscountPercent;
  const lineTotal = round2(args.qty * args.unitPrice * (1 - discount / 100));

  /* Approval required if the customer-type rule caps discount and we're
     above it. Min-margin check needs a cost side we don't load here (cost
     lives on product_suppliers.unit_cost_cny and needs can_view_private);
     margin-vs-min is re-checked in the decision engine in Session 3. */
  const discountOutOfPolicy = maxDiscount != null && discount > maxDiscount;

  return {
    productId: args.productId,
    productName: args.productName,
    qty: args.qty,
    unitPrice: round2(args.unitPrice),
    lineDiscountPercent: discount,
    lineTotal,
    priceSource: args.priceSource,
    approvalRequired: discountOutOfPolicy,
    status: discountOutOfPolicy ? "out_of_policy" : "priced",
    explanation: discountOutOfPolicy
      ? `Discount ${discount}% exceeds cap of ${maxDiscount}% for this customer type — approval needed.`
      : args.note,
  };
}

async function resolveCountry(customerId: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("customers")
    .select("country, market:market_id(name,region)")
    .eq("id", customerId)
    .maybeSingle();
  /* Try ISO-like country code from customer row first. */
  const raw = (data?.country as string | undefined)?.trim();
  if (raw && raw.length <= 3) return raw.toUpperCase();
  if (raw) return raw; // free text — still useful for exact match
  return null;
}

function emptyResult(
  currency: string,
  lines: PricingLineInput[],
  reason: string,
): PricingEngineResult {
  return {
    currency,
    customerType: null,
    marketId: null,
    lines: lines.map((l) => ({
      productId: l.productId,
      productName: null,
      qty: l.qty,
      unitPrice: null,
      lineDiscountPercent: 0,
      lineTotal: null,
      priceSource: "unresolved",
      approvalRequired: true,
      status: "no_price",
      explanation: reason,
    })),
    subtotal: 0,
    headerDiscountPercent: 0,
    headerDiscount: 0,
    total: 0,
    approvalRequired: true,
    sources: [],
    warnings: [reason],
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
