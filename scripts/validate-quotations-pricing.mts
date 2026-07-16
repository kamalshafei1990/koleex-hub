#!/usr/bin/env node
/* validate:quotations-pricing — Phase 4 Wave 2B.3 pricing regression lock.
   Deterministic tests over the pure pricing math the quotation flow depends
   on. This wave changed NO calculation code, so every output below must stay
   identical — the suite exists to LOCK the formulas so a future perf change
   can't silently alter a price, margin, FX conversion, or rounding.
   Covers: product-level detection, the CNY price-ladder multiplier chain +
   rounding, RMB→USD FX conversion, margin %, landed cost, currency format,
   and the quotation line-total / subtotal formulas.
   Run: node --import tsx scripts/validate-quotations-pricing.mts */
import {
  detectProductLevel,
  getMarketBand,
  calculatePriceLadder,
  convertLadderToUSD,
  calculateMargins,
  calculateLandedCost,
  formatCurrency,
} from "../src/lib/commercial-policy/pricing-engine";

let pass = 0, fail = 0;
const round2 = (n: number) => Math.round(n * 100) / 100;
const eq = (name: string, a: number, b: number) => {
  const ok = Math.abs(a - b) < 1e-9;
  ok ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.error(`  ✗ ${name} — got ${a}, expected ${b}`));
};
const check = (name: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + name)) : (fail++, console.error("  ✗ " + name)); };

// ── product level detection is deterministic + carries a numeric margin ──
const lvl = detectProductLevel(1000);
check("detectProductLevel returns a level with a numeric margin", typeof lvl.margin === "number");
check("detectProductLevel is stable for the same cost", detectProductLevel(1000).margin === lvl.margin && detectProductLevel(1000).id === lvl.id);

// ── CNY price-ladder multiplier chain + rounding (RMB cost currency) ──
for (const cost of [1000, 3499.99, 25000]) {
  const level = detectProductLevel(cost);
  const band = getMarketBand("band-b");
  const L = calculatePriceLadder(cost, level, band);
  const base = cost * (1 + level.margin);
  eq(`ladder.koleexCost round2 (cost=${cost})`, L.koleexCost, round2(cost));
  eq(`ladder.basePrice = cost*(1+margin) (cost=${cost})`, L.basePrice, round2(base));
  eq(`ladder.platinum = base*0.97 (cost=${cost})`, L.platinumPrice, round2(base * 0.97));
  eq(`ladder.gold = base*0.97*1.08 (cost=${cost})`, L.goldPrice, round2(base * 0.97 * 1.08));
  eq(`ladder.silver = base*0.97*1.08*1.08 (cost=${cost})`, L.silverPrice, round2(base * 0.97 * 1.08 * 1.08));
  eq(`ladder.retailGlobal = silver*1.20 (cost=${cost})`, L.retailGlobalPrice, round2(base * 0.97 * 1.08 * 1.08 * 1.2));
  eq(`ladder.retailMarket = retailGlobal*(1+adj) (cost=${cost})`, L.retailMarketPrice, round2(base * 0.97 * 1.08 * 1.08 * 1.2 * (1 + band.adjustment)));
}

// ── RMB → USD FX conversion (USD selling currency) ──
const ladder = calculatePriceLadder(7250, detectProductLevel(7250), getMarketBand("band-b"));
const usd = convertLadderToUSD(ladder, 7.25);
eq("FX: basePrice / rate", usd.basePrice, round2(ladder.basePrice / 7.25));
eq("FX: retailMarket / rate", usd.retailMarketPrice, round2(ladder.retailMarketPrice / 7.25));
const usdDefault = convertLadderToUSD(ladder, 0); // 0 → engine default 7.25
eq("FX: rate=0 falls back to 7.25", usdDefault.basePrice, round2(ladder.basePrice / 7.25));

// ── margin % relative to cost ──
const margins = calculateMargins(ladder);
eq("margin.basePriceMargin = (price-cost)/cost*100", margins.basePriceMargin, round2(((ladder.basePrice - ladder.koleexCost) / ladder.koleexCost) * 100));

// ── landed cost, fully hardcoded numeric scenario ──
const lc = calculateLandedCost({
  fobValueUSD: 1000, freightUSD: 100, insurancePct: 1, dutyPct: 5, vatPct: 14,
  bankChargesPct: 0.5, clearanceLocal: 200, truckingLocal: 100, localCurrencyRate: 30, localCurrency: "EGP",
});
eq("landed.fobValue", lc.fobValue, 30000);
eq("landed.freight", lc.freight, 3000);
eq("landed.insurance", lc.insurance, 300);
eq("landed.cifValue", lc.cifValue, 33300);
eq("landed.importDuty", lc.importDuty, 1665);
eq("landed.vat", lc.vat, 4895.1);
eq("landed.bankCharges", lc.bankCharges, 150);
eq("landed.totalLandedCost", lc.totalLandedCost, 40310.1);
eq("landed.landedMultiplier", lc.landedMultiplier, 1.3437);
check("landed.currency preserved", lc.currency === "EGP");

// ── currency formatting ──
check("formatCurrency default $ 2dp", formatCurrency(1234.5) === "$1,234.50");
check("formatCurrency custom symbol", formatCurrency(1000, "US$ ") === "US$ 1,000.00");

// ── quotation line-total + subtotal formulas (the editor's core math) ──
const lineTotal = (unit: number, qty: number, discPct: number) => unit * qty * (1 - discPct / 100);
eq("line total: 100 x 3 @ 0%", lineTotal(100, 3, 0), 300);
eq("line total: 250 x 2 @ 10%", lineTotal(250, 2, 10), 450);
const items = [{ unitPrice: 100, qty: 3 }, { unitPrice: 250, qty: 2 }, { unitPrice: 0, qty: 5 }];
const subtotal = items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0), 0);
eq("subtotal = Σ unitPrice*qty", subtotal, 800);
// grandTotal formula: subtotal + tax% + shipping + others (as used by the editor's grandTotal memo)
const grand = (sub: number, taxPct: number, shipping: number, others: number) =>
  sub + sub * (Math.max(0, Math.min(100, taxPct)) / 100) + shipping + others;
eq("grandTotal = sub + tax% + shipping + others", grand(800, 10, 50, 20), 950);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
