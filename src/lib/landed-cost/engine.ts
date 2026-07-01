/* ---------------------------------------------------------------------------
   Landed Cost — Engine v2 (additive, backward compatible)

   This module is the new financial core for the Landed Cost platform. It is
   ADDITIVE: the legacy `calculate()` in ../landed-cost-calc.ts is untouched and
   still works, so existing simulations and the current form keep running while
   the redesigned UI migrates onto these functions.

   The single most important change (spec §1): TRUE LANDED COST and COMMERCIAL
   PRICING are now two independent calculations.

     • calculateLandedCost()      → real cost to bring goods to the warehouse.
                                     NO margin, discount, or sales commission.
     • calculateCommercialPricing()→ selling price / profit, computed FROM the
                                     landed cost. This is where margin, discount,
                                     and commissions live.

   All inputs come from the EXISTING jsonb sections (financial already holds
   margin/discount/commission), so no schema change is needed for the engine.
   --------------------------------------------------------------------------- */

import type {
  ExportCosts, ShippingCosts, ImportCosts, InlandDelivery,
  FinancialSettings, ProductInfo,
} from "../landed-cost-types";
import {
  sumExportCosts, sumShippingCosts, sumImportFixed, sumInlandCosts,
  calculateDutyBreakdown,
} from "../landed-cost-calc";

/* ═══════════════════════════════════════════════════════════════════════════
   INCOTERM INTELLIGENCE (spec §2)
   Who covers what. Destination charges (import/customs/VAT/THC/broker/delivery)
   are ALWAYS the customer's — they never disappear automatically.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PriceBasis = "EXW" | "FOB" | "CFR" | "CIF";

export interface IncotermSummary {
  basis: PriceBasis;
  /** Cost categories the supplier's price already includes. */
  includedBySupplier: string[];
  /** Categories still to be added on the origin/freight side. */
  excluded: string[];
  /** Destination categories that are always the customer's cost. */
  customerResponsibility: string[];
}

/* Category keys used by the summary + responsibility matrix. */
export const COST_CATEGORY = {
  product: "product",
  export: "export",
  freight: "freight",
  insurance: "insurance",
  import: "import",
  inland: "inland",
} as const;

const DESTINATION_ALWAYS_CUSTOMER = ["Customs duty", "Import VAT", "Port / THC", "Customs broker", "Inland delivery"];

export function incotermSummary(basis: string): IncotermSummary {
  const b = (["EXW", "FOB", "CFR", "CIF"].includes(basis) ? basis : "EXW") as PriceBasis;
  const included: string[] = [];
  const excluded: string[] = [];

  // Origin export handling
  if (b === "EXW") excluded.push("Origin export handling");
  else included.push("Origin export handling");

  // Ocean/air freight
  if (b === "EXW" || b === "FOB") excluded.push("Main freight");
  else included.push("Main freight");

  // Cargo insurance
  if (b === "CIF") included.push("Cargo insurance");
  else excluded.push("Cargo insurance");

  return {
    basis: b,
    includedBySupplier: included,
    excluded,
    customerResponsibility: [...DESTINATION_ALWAYS_CUSTOMER],
  };
}

/* Shipping cost that the CUSTOMER still pays, given the basis. Freight and
   insurance already in the supplier's price are dropped to avoid double-count;
   surcharges (BAF/CAF/GRI/…) are always added. Mirrors the legacy logic so
   numbers stay consistent. */
export function shippingLandedTotal(basis: string, s: ShippingCosts): number {
  const surcharges = s.baf + s.caf + s.gri + s.peakSeasonSurcharge + s.amsEnsIsf + s.blAwbFee + s.telexReleaseFee;
  let total: number;
  if (basis === "EXW" || basis === "FOB") total = s.freightCost + s.insuranceCost + surcharges;
  else if (basis === "CFR") total = s.insuranceCost + surcharges;          // freight included
  else if (basis === "CIF") total = surcharges;                             // freight + insurance included
  else total = s.freightCost + s.insuranceCost + surcharges;
  if (s.freightExchangeRate && s.freightExchangeRate !== 1) total *= s.freightExchangeRate;
  return total;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION A — TRUE LANDED COST (spec §1A)
   Real costs only. No commercial decisions.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface LandedCostBreakdown {
  productTotal: number;
  exportTotal: number;
  shippingTotal: number;
  importTotal: number;
  inlandTotal: number;
  /** Finance & Risk that are genuine COSTS (bank/LC/financing/credit-insurance/
      contingency/reserve). Excludes margin, discount and sales commissions. */
  financeRiskTotal: number;

  totalLandedCost: number;

  landedCostPerUnit: number;
  landedCostPerCarton: number;
  landedCostPerCbm: number;
  landedCostPerKg: number;

  /** Duty/VAT transparency (reuses the existing breakdown helper). */
  duty: ReturnType<typeof calculateDutyBreakdown>;

  /** Percentage each block is of the total landed cost. */
  pct: {
    product: number; export: number; shipping: number;
    import: number; inland: number; financeRisk: number;
  };
}

/** Finance & Risk COSTS only (spec §9 grouping) — never margin/discount/commission. */
export function sumFinanceRiskCosts(f: FinancialSettings, baseForContingency: number): {
  paymentCosts: number; financeCosts: number; riskCosts: number; total: number;
} {
  const paymentCosts = f.bankTransferCost;                                  // TT/LC/bank
  const financeCosts = f.financingCost + f.creditInsurance;
  const contingency = baseForContingency * ((f.contingencyPct || 0) / 100);
  const riskCosts = contingency + f.unexpectedReserve;
  return { paymentCosts, financeCosts, riskCosts, total: paymentCosts + financeCosts + riskCosts };
}

export function calculateLandedCost(
  unitPrice: number,
  quantity: number,
  priceBasis: string,
  productInfo: ProductInfo,
  exportCosts: ExportCosts,
  shipping: ShippingCosts,
  importCosts: ImportCosts,
  inland: InlandDelivery,
  financial: FinancialSettings,
): LandedCostBreakdown {
  const qty = quantity || 1;

  const productTotal = unitPrice * qty;
  const exportTotal = priceBasis === "EXW" ? sumExportCosts(exportCosts) : 0;
  const shippingTotal = shippingLandedTotal(priceBasis, shipping);

  const duty = calculateDutyBreakdown(productTotal, exportTotal, shippingTotal, priceBasis, importCosts);
  const importTotal = duty.importTotal;
  const inlandTotal = sumInlandCosts(inland);

  const baseForContingency = productTotal + exportTotal + shippingTotal + importTotal + inlandTotal;
  const financeRiskTotal = sumFinanceRiskCosts(financial, baseForContingency).total;

  const totalLandedCost = baseForContingency + financeRiskTotal;

  const numCartons = productInfo.numCartons || 1;
  const totalCbm = productInfo.totalCbm || 1;
  const totalWeight = productInfo.totalGrossWeight || 1;
  const safe = totalLandedCost || 1;

  return {
    productTotal, exportTotal, shippingTotal, importTotal, inlandTotal, financeRiskTotal,
    totalLandedCost,
    landedCostPerUnit: qty > 0 ? totalLandedCost / qty : 0,
    landedCostPerCarton: numCartons > 0 ? totalLandedCost / numCartons : 0,
    landedCostPerCbm: totalCbm > 0 ? totalLandedCost / totalCbm : 0,
    landedCostPerKg: totalWeight > 0 ? totalLandedCost / totalWeight : 0,
    duty,
    pct: {
      product: (productTotal / safe) * 100,
      export: (exportTotal / safe) * 100,
      shipping: (shippingTotal / safe) * 100,
      import: (importTotal / safe) * 100,
      inland: (inlandTotal / safe) * 100,
      financeRisk: (financeRiskTotal / safe) * 100,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION B — COMMERCIAL PRICING (spec §1B)
   Starts FROM the true landed cost. Never mixed into landed cost.

   Model (documented so the UI can explain it):
     basePrice     = landedCost × (1 + margin%)            // markup over cost
     discountAmount= basePrice × (discount% / 100)
     sellingPrice  = basePrice − discountAmount
     commissions   = agent + sales + distributor           // sale-side costs
     grossProfit   = sellingPrice − landedCost − commissions
     marginPct     = grossProfit / sellingPrice × 100
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CommercialInputs {
  marginPct: number;        // markup over landed cost
  discountPct: number;      // discount off base price
  agentCommission: number;  // absolute, per the order (same units as price)
  salesCommission: number;
  distributorCommission?: number; // future-ready
}

export interface CommercialPricing {
  landedCost: number;
  basePrice: number;
  discountAmount: number;
  sellingPrice: number;
  totalCommission: number;
  grossProfit: number;
  profitAmount: number;      // alias of grossProfit for the dashboard
  marginPct: number;         // realised margin on selling price
  markupPct: number;         // profit over cost
  sellingPricePerUnit: number;
}

export function calculateCommercialPricing(
  landedCost: number,
  c: CommercialInputs,
  quantity: number,
): CommercialPricing {
  const qty = quantity || 1;
  const basePrice = landedCost * (1 + (c.marginPct || 0) / 100);
  const discountAmount = basePrice * ((c.discountPct || 0) / 100);
  const sellingPrice = basePrice - discountAmount;
  const totalCommission = (c.agentCommission || 0) + (c.salesCommission || 0) + (c.distributorCommission || 0);
  const grossProfit = sellingPrice - landedCost - totalCommission;
  const marginPct = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;
  const markupPct = landedCost > 0 ? (grossProfit / landedCost) * 100 : 0;
  return {
    landedCost, basePrice, discountAmount, sellingPrice, totalCommission,
    grossProfit, profitAmount: grossProfit, marginPct, markupPct,
    sellingPricePerUnit: qty > 0 ? sellingPrice / qty : 0,
  };
}

/** Read the commercial inputs out of the existing `financial` jsonb so callers
 *  don't need new storage in Phase 1. */
export function commercialInputsFromFinancial(f: FinancialSettings): CommercialInputs {
  return {
    marginPct: f.margin || 0,
    discountPct: f.discount || 0,
    agentCommission: f.agentCommission || 0,
    salesCommission: f.salesCommission || 0,
    distributorCommission: 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   VALIDATION (spec §10) — friendly warnings, never blocks editing.
   ═══════════════════════════════════════════════════════════════════════════ */

export type IssueLevel = "error" | "warning";
export interface ValidationIssue { level: IssueLevel; field: string; message: string; }

export function validateSimulation(inp: {
  quantity: number; unitPrice: number; priceBasis: string;
  shipping: ShippingCosts; importCosts: ImportCosts; financial: FinancialSettings;
}): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const warn = (field: string, message: string) => out.push({ level: "warning", field, message });

  if (!inp.quantity || inp.quantity <= 0) warn("quantity", "Quantity is missing or zero — per-unit costs can't be calculated.");
  if (!inp.unitPrice || inp.unitPrice <= 0) warn("unitPrice", "Unit price is zero — the product cost will be 0.");

  if (inp.importCosts.customsDutyPct < 0) warn("customsDutyPct", "Customs duty can't be negative.");
  if (inp.importCosts.customsDutyPct > 100) warn("customsDutyPct", "Customs duty over 100% is unusual — please double-check.");
  if (inp.importCosts.importVatPct < 0 || inp.importCosts.importVatPct > 100) warn("importVatPct", "Import VAT should be between 0% and 100%.");

  if ((inp.priceBasis === "EXW" || inp.priceBasis === "FOB") && inp.shipping.freightCost <= 0)
    warn("freightCost", `On ${inp.priceBasis} the buyer pays freight — freight cost looks empty.`);
  if (inp.shipping.freightCurrency && inp.shipping.freightCurrency !== "USD" && (!inp.shipping.freightExchangeRate || inp.shipping.freightExchangeRate <= 0))
    warn("freightExchangeRate", "Freight is in a non-USD currency but no exchange rate is set.");
  if ((inp.priceBasis === "CFR" || inp.priceBasis === "CIF") && inp.shipping.freightCost > 0)
    warn("freightCost", `On ${inp.priceBasis} the supplier already includes freight — this freight input is ignored to avoid double-counting.`);

  if (inp.financial.exchangeRate <= 0) warn("exchangeRate", "Local exchange rate is zero — the local-currency total will be wrong.");
  if (inp.financial.margin < 0) warn("margin", "A negative margin means you'd sell below cost.");
  if (inp.financial.discount > 100) warn("discount", "Discount over 100% isn't possible.");

  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FUTURE-READY DATA MODEL (spec §3,4,5,7,8) — types + defaults only.
   These are persisted in Phase 2 via additive nullable jsonb columns; defining
   them here lets the UI and engine reference them safely now.
   ═══════════════════════════════════════════════════════════════════════════ */

/* §4 — Confidence level of the whole simulation (or per line, future). */
export type ConfidenceLevel =
  | "estimate" | "supplier_confirmed" | "forwarder_confirmed" | "broker_confirmed" | "final_actual";

export const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; tone: "neutral" | "info" | "success" | "warning"; estimated: boolean }> = {
  estimate:            { label: "Estimate",            tone: "warning", estimated: true  },
  supplier_confirmed:  { label: "Supplier Confirmed",  tone: "info",    estimated: true  },
  forwarder_confirmed: { label: "Forwarder Confirmed", tone: "info",    estimated: true  },
  broker_confirmed:    { label: "Broker Confirmed",    tone: "info",    estimated: true  },
  final_actual:        { label: "Final Actual Cost",   tone: "success", estimated: false },
};

/* §3 — Responsibility matrix. Which party bears each cost line/category. */
export type ResponsibleParty = "supplier" | "koleex" | "customer" | "freight_forwarder" | "customs_broker";
export const RESPONSIBLE_PARTY_META: Record<ResponsibleParty, { label: string }> = {
  supplier: { label: "Supplier" }, koleex: { label: "Koleex" }, customer: { label: "Customer" },
  freight_forwarder: { label: "Freight Forwarder" }, customs_broker: { label: "Customs Broker" },
};

/* §5 — Country-specific customs profile (manual now, DB-backed later). Never
   hardcode rates; this just carries them + the trade context. */
export interface CustomsProfile {
  destinationCountry: string;
  hsCode: string;
  countryOfOrigin: string;
  tradeAgreement: string;      // e.g. "None" | "GAFTA" | "GCC" | ...
  dutyPct: number;
  vatPct: number;
  additionalTaxPct: number;
  valuationMethod: string;     // "transaction_value" | "CIF" | "FOB" | "custom"
}

/* §7 — Independent FX rates. Report currency is what the dashboard totals in. */
export interface CurrencyModel {
  productCurrency: string;
  freightCurrency: string;
  customsCurrency: string;
  localCurrency: string;
  reportCurrency: string;
  rates: Record<string, number>; // currency → rate to reportCurrency
}

/* §8 — Actual vs Estimated for post-shipment audit. */
export interface ActualVsEstimated {
  stage: "estimated" | "actual";
  actualLandedCost: number;
  variance: number;            // actual − estimated
  variancePct: number;
  reason: string;              // "Freight increased" | "Customs adjustment" | ...
}

export const DEFAULT_CONFIDENCE: ConfidenceLevel = "estimate";
export const DEFAULT_CUSTOMS_PROFILE: CustomsProfile = {
  destinationCountry: "", hsCode: "", countryOfOrigin: "", tradeAgreement: "None",
  dutyPct: 0, vatPct: 0, additionalTaxPct: 0, valuationMethod: "transaction_value",
};
export const DEFAULT_CURRENCY_MODEL: CurrencyModel = {
  productCurrency: "USD", freightCurrency: "USD", customsCurrency: "USD",
  localCurrency: "USD", reportCurrency: "USD", rates: {},
};
