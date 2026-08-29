import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getPolicySnapshot } from "@/lib/server/commercial-policy";
import { computePolicyPrice } from "@/lib/server/pricing-engine-policy";
import { landedCostCny, type ProductSupplierLinkRow } from "@/lib/products-admin";

/* ---------------------------------------------------------------------------
   /api/products/fob-prices — Global FOB (USD) for a LIST of products.

   WHY A SEPARATE ROUTE
   --------------------
   The catalogue card shows a price, and there was no safe way to get one:

     · /api/products/signals carries the SUPPLIER COST and is deliberately
       Product Data only — sending it to a catalogue browser would leak what
       we pay our factories. That route is off-limits here by design.
     · /api/products/price-preview computes exactly one cost and additionally
       demands Commercial Policy admin access, so it can neither serve a
       browsing employee nor 271 cards without 271 round-trips.

   So this route is the narrow middle: it takes ids, does the cost→FOB maths
   SERVER-SIDE, and returns ONLY the finished USD number. Cost, extras, VAT,
   margins, levels and supplier identity never cross the boundary.

   ACCESS (owner decision, 2026-08-29)
   -----------------------------------
   Any Koleex Hub account may see the price — Hub accounts are issued by the
   owner personally, so authentication IS the audience gate. No extra module
   permission, and no anonymous access.

   PRICE SHAPE
   -----------
   "Global FOB" = the tier-agnostic base: landed factory cost → net internal
   → product level uplift → USD at the day's rate. Market bands and customer
   tiers are deliberately NOT applied — the card shows one comparable number,
   not a per-visitor price. The FX rate rides in the response so the card can
   say what it was converted at, and it moves with the daily rate because the
   engine reads it live on every call.
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

const MAX_IDS = 500;

interface LinkRow {
  product_id: string;
  is_primary: boolean | null;
  unit_cost_cny: number | string | null;
  cost_basis: string | null;
  cost_includes_tax: boolean | null;
  cost_extras: ProductSupplierLinkRow["cost_extras"];
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let ids: string[] = [];
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) {
      ids = body.ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    }
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  ids = Array.from(new Set(ids)).slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ prices: {}, fx: null });

  const ctx = await getPolicySnapshot(auth.tenant_id);
  if (!ctx.settings) {
    /* Not an error for the card — it simply has no price to show yet. */
    return NextResponse.json({ prices: {}, fx: null, reason: "policy_not_configured" });
  }

  /* Two reads, both batched over the whole id set — never per product. */
  const [linkRes, modelRes] = await Promise.all([
    supabaseServer
      .from("product_suppliers")
      .select("product_id, is_primary, unit_cost_cny, cost_basis, cost_includes_tax, cost_extras")
      .in("product_id", ids),
    supabaseServer
      .from("product_models")
      .select("product_id, cost_price, pricing_mode, \"order\"")
      .in("product_id", ids)
      .order("order", { ascending: true }),
  ]);

  /* Landed cost per product: the PRIMARY supplier link wins; any other link
     only fills a product that has no primary yet. */
  const landed = new Map<string, number>();
  for (const l of ((linkRes.data ?? []) as LinkRow[])) {
    const { landed: value } = landedCostCny(l);
    if (value == null || !Number.isFinite(value) || value <= 0) continue;
    if (l.is_primary || !landed.has(l.product_id)) landed.set(l.product_id, value);
  }

  /* Fallback + pricing mode from the primary model (rows arrive pre-sorted,
     so the first row seen for a product is its primary). */
  const mode = new Map<string, string>();
  for (const m of ((modelRes.data ?? []) as Array<{
    product_id: string; cost_price: number | string | null; pricing_mode: string | null;
  }>)) {
    if (!mode.has(m.product_id)) mode.set(m.product_id, m.pricing_mode || "fixed");
    if (landed.has(m.product_id)) continue;
    const c = m.cost_price == null ? null : Number(m.cost_price);
    if (c != null && Number.isFinite(c) && c > 0) landed.set(m.product_id, c);
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

  /* Pure CPU from here — one engine run per product, no further IO. */
  const prices: Record<string, { fobUsd: number | null; mode: string }> = {};
  let fxCnyPerUsd: number | null = null;

  for (const id of ids) {
    const pm = mode.get(id) || "fixed";
    if (pm === "on_request") {
      prices[id] = { fobUsd: null, mode: "on_request" };
      continue;
    }
    const cost = landed.get(id);
    if (cost == null) {
      prices[id] = { fobUsd: null, mode: pm };
      continue;
    }
    const run = computePolicyPrice(
      { factoryCostCny: cost, qty: 1, customerCountryCode: null, customerTierCode: null },
      engineCtx,
    );
    const b = run.breakdown;
    if (fxCnyPerUsd == null && b.fxCnyPerUsd != null) fxCnyPerUsd = b.fxCnyPerUsd;
    prices[id] = {
      fobUsd: b.globalFobUsd != null && Number.isFinite(b.globalFobUsd) ? b.globalFobUsd : null,
      mode: pm,
    };
  }

  return NextResponse.json({
    prices,
    fx: fxCnyPerUsd == null ? null : { cnyPerUsd: fxCnyPerUsd },
  });
}
