import "server-only";

/* ---------------------------------------------------------------------------
   getProductPrice — the SELLING price of one Koleex product, from the
   Commercial Policy engine, for the text lane and for a voice call.

   THE OWNER'S ASK, in his words: "when I ask any price of any of Koleex
   products it gives a wrong price. The prices should be the FOB selling
   price, or if I need I can ask for country and customer type so it can
   give me the right price, or Koleex AI itself can ask me which price I
   need and where and for whom."

   WHY THERE WAS A WRONG PRICE. No AI tool returned a selling price at all.
   searchProducts and getProductByCode carry no price column; getProductDetails
   returns the SUPPLIER COST (CNY) to accounts that may see it; the only tool
   that produces a real price, calculateQuotationPricing, needs a customer
   record and is excluded from voice. A model asked "how much" with none of
   this answers from memory, and memory is wrong.

   WHAT THIS RETURNS, AND WHAT IT NEVER DOES.
     · The GLOBAL FOB price in USD: landed factory cost → net internal cost →
       product-level margin → USD at the day's rate. The same number the
       catalogue card shows every Hub account (/api/products/fob-prices,
       owner decision 2026-08-29): authentication is the audience gate.
     · With a COUNTRY and/or CUSTOMER TYPE: the engine's price for that
       market band and channel — an exact price for a deal. This is the
       quotation module's information, so it is gated on Quotations/view the
       way calculateQuotationPricing is; a caller without it hears the FOB
       and that the exact price needs quotation access.
     · Never the cost, the margin, the product level, the FX buffer or the
       supplier. The engine's breakdown carries all of those; this tool reads
       three fields out of it and drops the rest on the floor.

   THE FIGURES ARE THE ENGINE'S, and the pricing seal knows this tool: a reply
   carrying a price is allowed only in a turn where this tool (or the
   quotation calculator) actually produced one.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import { getPolicySnapshot, type CustomerTierRow } from "../../commercial-policy";
import { computePolicyPrice } from "../../pricing-engine-policy";
import { landedCostCny, type ProductSupplierLinkRow } from "../../../products-admin";
import { COUNTRIES } from "../../../commercial-policy/countries";
import { hasProductDataAccess } from "../../product-access";
import { checkModule } from "../permissions";
import type { ToolDef, ToolResult } from "../types";

const PRODUCT_MODULE = "Products";
const QUOTATIONS_MODULE = "Quotations";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ─── Country ──────────────────────────────────────────────────────────
   The model passes whatever the caller said: "Egypt", "EG", "مصر", "the
   UAE", "美国". ISO code first, then the English name, then a short table of
   the ways our callers actually name their markets. Unresolved is null, and
   the engine then prices at Band B — the tool says so rather than guessing. */
const COUNTRY_ALIASES: Record<string, string> = {
  uae: "AE", emirates: "AE", "united arab emirates": "AE", "الإمارات": "AE", "الامارات": "AE", "阿联酋": "AE",
  usa: "US", america: "US", "united states": "US", "أمريكا": "US", "امريكا": "US", "美国": "US",
  uk: "GB", britain: "GB", "united kingdom": "GB", england: "GB", "بريطانيا": "GB", "انجلترا": "GB", "英国": "GB",
  ksa: "SA", "saudi": "SA", "saudi arabia": "SA", "السعودية": "SA", "沙特": "SA",
  "مصر": "EG", "埃及": "EG",
  "الصين": "CN", "中国": "CN",
  "تركيا": "TR", "土耳其": "TR",
  "المغرب": "MA", "الجزائر": "DZ", "تونس": "TN", "ليبيا": "LY", "السودان": "SD",
  "العراق": "IQ", "الأردن": "JO", "الاردن": "JO", "لبنان": "LB", "سوريا": "SY", "اليمن": "YE",
  "الكويت": "KW", "قطر": "QA", "عمان": "OM", "البحرين": "BH",
  "نيجيريا": "NG", "كينيا": "KE", "إثيوبيا": "ET", "اثيوبيا": "ET", "غانا": "GH", "جنوب أفريقيا": "ZA", "جنوب افريقيا": "ZA",
  "الهند": "IN", "باكستان": "PK", "بنجلاديش": "BD", "بنغلاديش": "BD", "إندونيسيا": "ID", "اندونيسيا": "ID",
  "ألمانيا": "DE", "المانيا": "DE", "فرنسا": "FR", "إيطاليا": "IT", "ايطاليا": "IT", "إسبانيا": "ES", "اسبانيا": "ES",
  "روسيا": "RU", "البرازيل": "BR", "المكسيك": "MX", "كندا": "CA", "أستراليا": "AU", "استراليا": "AU",
  "德国": "DE", "法国": "FR", "印度": "IN", "俄罗斯": "RU", "巴西": "BR", "日本": "JP", "韩国": "KR",
};

export function resolveCountryCode(raw: string | null | undefined): { code: string; name: string } | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const lower = v.toLowerCase().replace(/^the\s+/, "");
  if (/^[a-z]{2}$/i.test(v)) {
    const hit = COUNTRIES.find((c) => c.code.toLowerCase() === lower);
    if (hit) return { code: hit.code, name: hit.name };
  }
  const alias = COUNTRY_ALIASES[lower] ?? COUNTRY_ALIASES[v];
  if (alias) {
    const hit = COUNTRIES.find((c) => c.code === alias);
    if (hit) return { code: hit.code, name: hit.name };
  }
  const exact = COUNTRIES.find((c) => c.name.toLowerCase() === lower);
  if (exact) return { code: exact.code, name: exact.name };
  const starts = COUNTRIES.filter((c) => c.name.toLowerCase().startsWith(lower));
  if (starts.length === 1) return { code: starts[0].code, name: starts[0].name };
  return null;
}

/* ─── Customer type ──────────────────────────────────────────────────
   The tiers are the tenant's own rows (code, name, real_name); a caller
   says "a distributor", "an agent", "end user", "وكيل", "分销商". Codes and
   names first, then the words people use for each rung. */
const TIER_WORDS: Array<{ code: string; words: RegExp }> = [
  { code: "diamond", words: /\b(sole|exclusive|strategic)\b|حصري|独家|战略/i },
  { code: "platinum", words: /\b(agent|major distributor)\b|وكيل|代理/i },
  { code: "gold", words: /\bdistributor\b|موزع|分销/i },
  { code: "silver", words: /\b(dealer|small trader|trader|reseller|shop|retailer)\b|تاجر|经销|零售商/i },
  { code: "end_user", words: /\b(end[ -]?user|end customer|final customer|consumer|personal|retail|individual)\b|مستخدم نهائي|عميل نهائي|مستهلك|终端|个人|零售/i },
];

export function resolveTierCode(raw: string | null | undefined, tiers: readonly Pick<CustomerTierRow, "code" | "name" | "real_name">[]): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  const direct = tiers.find((t) => t.code.toLowerCase() === lower || t.name.toLowerCase() === lower || (t.real_name ?? "").toLowerCase() === lower);
  if (direct) return direct.code;
  for (const { code, words } of TIER_WORDS) {
    if (!words.test(v)) continue;
    if (tiers.length === 0 || tiers.some((t) => t.code === code)) return code;
  }
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ProductPriceResult {
  product: { id: string; name: string; code: string | null };
  currency: "USD";
  incoterm: "FOB";
  pricing_mode: string;
  /** The global FOB, tier-agnostic. Null when on request or not priceable. */
  fob_price_usd: number | null;
  /** The price to say: the specific one when asked for, else the FOB. Also
   *  under `price` and `unit_price` — the names the pricing seal reads. */
  unit_price: number | null;
  price: number | null;
  specific: {
    country: string | null;
    country_code: string | null;
    customer_tier: string | null;
    unit_price_usd: number;
    approval_required: boolean;
  } | null;
  /** What the model should ask, when it should ask. */
  ask: string | null;
}

export const getProductPrice: ToolDef<
  { productId?: string; code?: string; country?: string; customerType?: string },
  ProductPriceResult | null
> = {
  name: "getProductPrice",
  description:
    "The SELLING price of one Koleex product in USD, FOB, from the pricing engine. Without country/customerType it returns the global FOB list price. With a country (name or ISO-2) and/or a customer type (end user, dealer, distributor, agent, sole agent) it returns the exact price for that market and channel. Never a cost or margin.",
  parameters: {
    type: "object",
    properties: {
      productId: { type: "string", description: "Product UUID from searchProducts. Either this or code." },
      code: { type: "string", description: "Product slug or exact name, e.g. KX-9000. Either this or productId." },
      country: { type: "string", description: "Optional. Customer's country — name or ISO-2 code." },
      customerType: { type: "string", description: "Optional. end user | dealer | distributor | agent | sole agent, or the tenant's tier code." },
    },
  },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<ProductPriceResult | null>> => {
    const productId = String(args.productId ?? "").trim();
    const code = String(args.code ?? "").trim();
    if (!productId && !code) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "Which product? Give a product id or its model code." };
    }

    /* The product, and whether this account may know it exists. */
    let q = supabaseServer.from("products").select("id, product_name, slug, status, visible").limit(1);
    if (productId && UUID_RE.test(productId)) {
      q = q.eq("id", productId);
    } else {
      const safe = (code || productId).replace(/[%_,()]/g, "");
      q = q.or(`slug.eq.${safe},product_name.ilike.${safe}`);
    }
    const { data: product, error } = await q.maybeSingle();
    if (error) {
      console.error("[tool.getProductPrice]", error);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't look that product up right now." };
    }
    if (!product) {
      return { ok: true, permissionStatus: "allowed", data: null, message: `No product matched "${code || productId}".` };
    }
    const row = product as { id: string; product_name: string; slug: string | null; status: string | null; visible: boolean | null };
    if (!(await hasProductDataAccess(ctx.auth))) {
      const published = String(row.status ?? "").toLowerCase() === "active" && row.visible !== false;
      if (!published) {
        return { ok: true, permissionStatus: "allowed", data: null, message: `No product matched "${code || productId}".` };
      }
    }

    const policy = await getPolicySnapshot(ctx.auth.tenant_id);
    const base: Omit<ProductPriceResult, "fob_price_usd" | "unit_price" | "price" | "specific" | "ask" | "pricing_mode"> = {
      product: { id: row.id, name: row.product_name, code: row.slug },
      currency: "USD",
      incoterm: "FOB",
    };
    if (!policy.settings) {
      return {
        ok: true,
        permissionStatus: "allowed",
        data: { ...base, pricing_mode: "not_configured", fob_price_usd: null, unit_price: null, price: null, specific: null, ask: null },
        message: "Pricing is not configured yet, so there is no price to give. Say the price is on request.",
      };
    }

    /* Landed cost: the PRIMARY supplier link wins, any link fills a product
       with no primary, the primary model's cost_price is the last resort;
       pricing_mode comes from the primary model. The same resolution as
       /api/products/fob-prices, for one product. The cost itself is used
       here and never returned. */
    const [linkRes, modelRes] = await Promise.all([
      supabaseServer
        .from("product_suppliers")
        .select("product_id, is_primary, unit_cost_cny, cost_basis, cost_includes_tax, cost_extras")
        .eq("product_id", row.id),
      supabaseServer
        .from("product_models")
        .select("product_id, cost_price, pricing_mode, \"order\"")
        .eq("product_id", row.id)
        .order("order", { ascending: true }),
    ]);
    let cost: number | null = null;
    for (const l of (linkRes.data ?? []) as Array<{ is_primary: boolean | null } & Parameters<typeof landedCostCny>[0]>) {
      const { landed } = landedCostCny(l as ProductSupplierLinkRow);
      if (landed == null || !Number.isFinite(landed) || landed <= 0) continue;
      if (l.is_primary || cost == null) cost = landed;
    }
    const models = (modelRes.data ?? []) as Array<{ cost_price: number | string | null; pricing_mode: string | null }>;
    const pricingMode = models[0]?.pricing_mode || "fixed";
    if (cost == null) {
      for (const m of models) {
        const c = m.cost_price == null ? null : Number(m.cost_price);
        if (c != null && Number.isFinite(c) && c > 0) { cost = c; break; }
      }
    }
    if (pricingMode === "on_request" || cost == null) {
      return {
        ok: true,
        permissionStatus: "allowed",
        data: { ...base, pricing_mode: pricingMode, fob_price_usd: null, unit_price: null, price: null, specific: null, ask: null },
        message: `${row.product_name}: price on request — there is no list price to give. Offer to have sales send a quotation.`,
      };
    }

    const engineCtx = {
      settings: policy.settings,
      productLevels: policy.productLevels,
      marketBands: policy.marketBands,
      bandCountries: policy.bandCountries,
      channelMultipliers: policy.channelMultipliers,
      customerTiers: policy.customerTiers,
      volumeDiscountTiers: policy.volumeDiscountTiers,
      discountTiers: policy.discountTiers,
      commissionTiers: policy.commissionTiers,
    };
    const global = computePolicyPrice({ factoryCostCny: cost, qty: 1, customerCountryCode: null, customerTierCode: null }, engineCtx);
    const fob = global.breakdown.globalFobUsd;
    if (fob == null || !Number.isFinite(fob) || fob <= 0) {
      return {
        ok: true,
        permissionStatus: "allowed",
        data: { ...base, pricing_mode: pricingMode, fob_price_usd: null, unit_price: null, price: null, specific: null, ask: null },
        message: `${row.product_name}: the engine could not price it. Say the price is on request.`,
      };
    }
    const fobUsd = round2(fob);

    const country = resolveCountryCode(args.country);
    const tierCode = resolveTierCode(args.customerType, policy.customerTiers);
    const wantsSpecific = Boolean(String(args.country ?? "").trim() || String(args.customerType ?? "").trim());

    if (!wantsSpecific) {
      return {
        ok: true,
        permissionStatus: "allowed",
        data: {
          ...base, pricing_mode: pricingMode, fob_price_usd: fobUsd, unit_price: fobUsd, price: fobUsd, specific: null,
          ask: "If they want the exact price for a deal, ask which country and which customer type (end user, dealer, distributor, agent, sole agent).",
        },
        message: `${row.product_name}: FOB list price USD ${fobUsd.toFixed(2)} (global FOB, before country and customer-type adjustments). Say it is the FOB price in US dollars. For an exact price, ask the country and the customer type.`,
      };
    }

    /* The exact price is the quotation module's information. */
    const canQuote = checkModule(ctx, QUOTATIONS_MODULE, "view");
    if (!canQuote.allowed) {
      return {
        ok: true,
        permissionStatus: "limited",
        data: { ...base, pricing_mode: pricingMode, fob_price_usd: fobUsd, unit_price: fobUsd, price: fobUsd, specific: null, ask: null },
        message: `${row.product_name}: FOB list price USD ${fobUsd.toFixed(2)}. The exact price for a country or customer type needs quotation access, which this account does not have — give the FOB price and say sales can quote the rest.`,
      };
    }
    const specific = computePolicyPrice(
      { factoryCostCny: cost, qty: 1, customerCountryCode: country?.code ?? null, customerTierCode: tierCode },
      engineCtx,
    );
    const unit = specific.unitPriceUsd;
    if (unit == null || !Number.isFinite(unit) || unit <= 0) {
      return {
        ok: true,
        permissionStatus: "allowed",
        data: { ...base, pricing_mode: pricingMode, fob_price_usd: fobUsd, unit_price: fobUsd, price: fobUsd, specific: null, ask: null },
        message: `${row.product_name}: FOB list price USD ${fobUsd.toFixed(2)}; the engine could not price that market/customer type — give the FOB price.`,
      };
    }
    const unitUsd = round2(unit);
    const tier = tierCode ? policy.customerTiers.find((t) => t.code === tierCode) ?? null : null;
    const unresolved: string[] = [];
    if (String(args.country ?? "").trim() && !country) unresolved.push(`country "${String(args.country).trim()}" not recognised (priced at the standard band)`);
    if (String(args.customerType ?? "").trim() && !tierCode) unresolved.push(`customer type "${String(args.customerType).trim()}" not recognised (priced at the best channel)`);
    return {
      ok: true,
      permissionStatus: "allowed",
      data: {
        ...base,
        pricing_mode: pricingMode,
        fob_price_usd: fobUsd,
        unit_price: unitUsd,
        price: unitUsd,
        specific: {
          country: country?.name ?? null,
          country_code: country?.code ?? null,
          customer_tier: tier?.name ?? tierCode,
          unit_price_usd: unitUsd,
          approval_required: specific.approvalRequired,
        },
        ask: unresolved.length ? `Confirm: ${unresolved.join("; ")}.` : null,
      },
      message:
        `${row.product_name}: USD ${unitUsd.toFixed(2)} FOB` +
        (country ? ` for ${country.name}` : "") +
        (tier ? `, ${tier.name} (${tier.real_name ?? tier.code})` : tierCode ? `, ${tierCode}` : "") +
        ` — global FOB list ${fobUsd.toFixed(2)}.` +
        (specific.approvalRequired ? " This price needs manager approval before it is offered; say so." : "") +
        (unresolved.length ? ` ${unresolved.join("; ")}.` : ""),
    };
  },
};

export const productPriceTools: ToolDef[] = [getProductPrice as unknown as ToolDef];
