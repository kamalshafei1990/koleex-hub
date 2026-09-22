import "server-only";

/* products-fob — Global FOB (USD) for products AND their models, server-side.
 *
 * Extracted from /api/products/fob-prices (19/09/2026) so the product page
 * can price its hero and its family table during the server render — one
 * source for the catalogue card, the page, the AI and (never) the print.
 * The route is now a thin HTTP wrapper over this.
 *
 * WHAT "GLOBAL FOB" IS
 *   landed factory cost → net internal → product level uplift → USD at the
 *   day's rate. No market band, no customer tier: one comparable number.
 *   The engine reads the FX rate live, so it moves with the day.
 *
 * WHAT NEVER LEAVES THIS MODULE
 *   cost, extras, VAT, margins, levels, supplier identity. Callers get a
 *   finished USD figure or null — nothing a customer could work back from.
 *
 * PER-PRODUCT vs PER-MODEL
 *   The product figure uses the PRIMARY supplier link's landed cost, else
 *   the first model's cost. A model figure exists only when that model
 *   carries its OWN cost_price — a family whose members share one supplier
 *   cost shows one price, not the same number repeated with false precision.
 */
import { supabaseServer } from "@/lib/server/supabase-server";
import { inChunks } from "@/lib/server/in-chunks";
import { getPolicySnapshot } from "@/lib/server/commercial-policy";
import { computePolicyPrice } from "@/lib/server/pricing-engine-policy";
import { landedCostCny, type ProductSupplierLinkRow } from "@/lib/products-admin";

export interface FobFigure { fobUsd: number | null; mode: string }
export interface FobResult {
  /** keyed by product id */
  prices: Record<string, FobFigure>;
  /** keyed by model id — only models with their own cost */
  models: Record<string, FobFigure>;
  /** keyed by the caller's delta key — the USD the Global FOB moves by when
   *  a buyer option adds `cny` to the product's landed cost. Absent when the
   *  product has no cost to add to. Only the finished difference leaves. */
  deltasUsd: Record<string, number>;
  fx: { cnyPerUsd: number } | null;
  reason?: "policy_not_configured";
}

interface LinkRow {
  product_id: string;
  is_primary: boolean | null;
  unit_cost_cny: number | string | null;
  cost_basis: string | null;
  cost_includes_tax: boolean | null;
  cost_extras: ProductSupplierLinkRow["cost_extras"];
}
interface ModelCostRow {
  id: string;
  product_id: string;
  cost_price: number | string | null;
  pricing_mode: string | null;
}

const EMPTY: FobResult = { prices: {}, models: {}, deltasUsd: {}, fx: null };

export async function globalFobForProducts(
  tenantId: string,
  ids: string[],
  deltas: Array<{ key: string; productId: string; cny: number }> = [],
): Promise<FobResult> {
  if (ids.length === 0) return EMPTY;

  const ctx = await getPolicySnapshot(tenantId);
  if (!ctx.settings) return { ...EMPTY, reason: "policy_not_configured" };

  /* Two reads, both batched over the whole id set — never per product.
     Through inChunks: the catalogue now asks for every unpriced product in
     ONE call after the first screen, and 500 ids in a single `.in()` URL
     is past what the HTTP client will send (see in-chunks.ts). */
  const [linkRes, modelRes] = await Promise.all([
    inChunks<LinkRow>(ids, (chunk) =>
      supabaseServer
        .from("product_suppliers")
        .select("product_id, is_primary, unit_cost_cny, cost_basis, cost_includes_tax, cost_extras")
        .in("product_id", chunk)),
    inChunks<ModelCostRow>(ids, (chunk) =>
      supabaseServer
        .from("product_models")
        .select('id, product_id, cost_price, pricing_mode, "order"')
        .in("product_id", chunk)
        .order("order", { ascending: true })),
  ]);

  /* Landed cost per product: the PRIMARY supplier link wins; any other link
     only fills a product that has no primary yet. */
  const landed = new Map<string, number>();
  for (const l of (linkRes.data ?? []) as LinkRow[]) {
    const { landed: value } = landedCostCny(l);
    if (value == null || !Number.isFinite(value) || value <= 0) continue;
    if (l.is_primary || !landed.has(l.product_id)) landed.set(l.product_id, value);
  }

  /* Pricing mode = the first model's (rows are ordered, so the first row seen
     for a product is its primary). A model's own cost fills a product with
     no supplier link, and always prices that model individually. */
  const mode = new Map<string, string>();
  const modelCost = new Map<string, { productId: string; cost: number; mode: string }>();
  for (const m of (modelRes.data ?? []) as ModelCostRow[]) {
    const pm = m.pricing_mode || "fixed";
    if (!mode.has(m.product_id)) mode.set(m.product_id, pm);
    const c = m.cost_price == null ? null : Number(m.cost_price);
    const own = c != null && Number.isFinite(c) && c > 0;
    if (own) modelCost.set(m.id, { productId: m.product_id, cost: c as number, mode: pm });
    if (own && !landed.has(m.product_id)) landed.set(m.product_id, c as number);
  }

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

  let fxCnyPerUsd: number | null = null;
  const price = (cost: number): number | null => {
    const run = computePolicyPrice(
      { factoryCostCny: cost, qty: 1, customerCountryCode: null, customerTierCode: null },
      engineCtx,
    );
    const b = run.breakdown;
    if (fxCnyPerUsd == null && b.fxCnyPerUsd != null) fxCnyPerUsd = b.fxCnyPerUsd;
    return b.globalFobUsd != null && Number.isFinite(b.globalFobUsd) ? b.globalFobUsd : null;
  };

  const prices: Record<string, FobFigure> = {};
  for (const id of ids) {
    const pm = mode.get(id) || "fixed";
    if (pm === "on_request") { prices[id] = { fobUsd: null, mode: "on_request" }; continue; }
    const cost = landed.get(id);
    prices[id] = { fobUsd: cost == null ? null : price(cost), mode: pm };
  }

  const models: Record<string, FobFigure> = {};
  for (const [mid, m] of modelCost) {
    if (!ids.includes(m.productId)) continue;
    models[mid] = m.mode === "on_request" ? { fobUsd: null, mode: "on_request" } : { fobUsd: price(m.cost), mode: m.mode };
  }

  /* A buyer option's cost delta priced the same way the product is — the
     difference between the product at (cost + delta) and at cost. Margins
     and levels apply to the delta exactly as to the base, so a customer's
     option price is never a raw factory difference. */
  const deltasUsd: Record<string, number> = {};
  for (const d of deltas) {
    const cost = landed.get(d.productId);
    if (cost == null || !Number.isFinite(d.cny) || d.cny === 0) continue;
    const base = price(cost);
    const withDelta = price(cost + d.cny);
    if (base == null || withDelta == null) continue;
    deltasUsd[d.key] = withDelta - base;
  }

  return { prices, models, deltasUsd, fx: fxCnyPerUsd == null ? null : { cnyPerUsd: fxCnyPerUsd } };
}
