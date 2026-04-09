/* ---------------------------------------------------------------------------
   Landed Cost Simulator — Calculation Engine

   Price basis logic:
   - EXW: all costs apply (export + shipping + import + inland)
   - FOB: export costs already included in price, skip export block
   - CFR: export + freight included, skip export + freight
   - CIF: export + freight + insurance included, skip export + freight + insurance
   --------------------------------------------------------------------------- */

import type {
  ExportCosts, ShippingCosts, ImportCosts, InlandDelivery,
  FinancialSettings, SimulationResults, ProductInfo,
} from "./landed-cost-types";

/* ── Sum helpers ── */

export function sumExportCosts(e: ExportCosts): number {
  return e.factoryToPort + e.localTrucking + e.exportCustomsFee + e.portCharges
    + e.terminalHandling + e.documentationFee + e.inspectionFee + e.fumigationFee
    + e.palletizationFee + e.extraPackingCost + e.loadingFee + e.exportAgentFee
    + e.bankCharges + e.certificateOfOriginFee + e.formCertificateFee + e.otherExportCharges;
}

export function sumShippingCosts(s: ShippingCosts): number {
  return s.freightCost + s.insuranceCost + s.baf + s.caf + s.gri
    + s.peakSeasonSurcharge + s.amsEnsIsf + s.blAwbFee + s.telexReleaseFee;
}

export function sumImportFixed(i: ImportCosts): number {
  return i.antiDumpingDuty + i.portCharges + i.terminalHandling + i.customsClearanceFee
    + i.customsBrokerFee + i.inspectionFee + i.certificateVerificationFee + i.storageFee
    + i.demurrage + i.detention + i.deliveryOrderFee + i.portSecurityFee
    + i.scanningFee + i.municipalityFee + i.translationLegalizationFee + i.otherImportCharges;
}

export function sumInlandCosts(d: InlandDelivery): number {
  return d.localTruckingToWarehouse + d.unloadingFee + d.craneForkliftFee
    + d.warehouseReceivingCharges + d.lastMileHandling + d.remoteAreaSurcharge
    + d.restrictedAreaSurcharge + d.appointmentDeliveryFee + d.nightDeliveryFee
    + d.otherLocalDeliveryCharges;
}

export function sumFinancialCosts(f: FinancialSettings): number {
  return f.bankTransferCost + f.financingCost + f.creditInsurance + f.unexpectedReserve
    + (f.includeCommissionInFinal ? f.agentCommission + f.salesCommission : 0);
}

/* ── Main calculation ── */

export function calculate(
  unitPrice: number,
  quantity: number,
  priceBasis: string,
  productInfo: ProductInfo,
  exportCosts: ExportCosts,
  shipping: ShippingCosts,
  importCosts: ImportCosts,
  inlandDelivery: InlandDelivery,
  financial: FinancialSettings,
): SimulationResults {
  const qty = quantity || 1;

  // 1. Product total
  const productTotal = unitPrice * qty;

  // 2. Export total — only if price basis is EXW
  const exportTotal = priceBasis === "EXW" ? sumExportCosts(exportCosts) : 0;

  // 3. Shipping total — basis logic
  let shippingTotal = 0;
  if (priceBasis === "EXW" || priceBasis === "FOB") {
    shippingTotal = sumShippingCosts(shipping);
  } else if (priceBasis === "CFR") {
    // Freight included, but insurance and surcharges not
    shippingTotal = shipping.insuranceCost + shipping.baf + shipping.caf + shipping.gri
      + shipping.peakSeasonSurcharge + shipping.amsEnsIsf + shipping.blAwbFee + shipping.telexReleaseFee;
  } else if (priceBasis === "CIF") {
    // Freight + insurance included, only surcharges apply
    shippingTotal = shipping.baf + shipping.caf + shipping.gri
      + shipping.peakSeasonSurcharge + shipping.amsEnsIsf + shipping.blAwbFee + shipping.telexReleaseFee;
  }

  // Convert freight if different currency
  if (shipping.freightExchangeRate && shipping.freightExchangeRate !== 1) {
    shippingTotal = shippingTotal * shipping.freightExchangeRate;
  }

  // 4. Import total — duty/VAT calculated on basis value
  let dutyBase = productTotal; // default
  if (importCosts.calculationBasis === "CIF") {
    dutyBase = productTotal + shippingTotal + (priceBasis === "EXW" ? exportTotal : 0);
  } else if (importCosts.calculationBasis === "FOB") {
    dutyBase = productTotal + (priceBasis === "EXW" ? exportTotal : 0);
  } else if (importCosts.calculationBasis === "custom_value" && importCosts.customValue > 0) {
    dutyBase = importCosts.customValue;
  }

  const dutyAmount = dutyBase * (importCosts.customsDutyPct / 100);
  const vatBase = dutyBase + dutyAmount;
  const vatAmount = vatBase * (importCosts.importVatPct / 100);
  const addTaxAmount = dutyBase * (importCosts.additionalTaxPct / 100);
  const importFixed = sumImportFixed(importCosts);
  const importTotal = dutyAmount + vatAmount + addTaxAmount + importFixed;

  // 5. Inland delivery total
  const inlandTotal = sumInlandCosts(inlandDelivery);

  // 6. Financial adjustments
  const financialBase = sumFinancialCosts(financial);
  const contingency = (productTotal + exportTotal + shippingTotal + importTotal + inlandTotal) * (financial.contingencyPct / 100);
  const discountAmount = productTotal * (financial.discount / 100);
  const marginAmount = productTotal * (financial.margin / 100);
  const financialTotal = financialBase + contingency + marginAmount - discountAmount;

  // 7. Total landed cost
  const totalLandedCost = productTotal + exportTotal + shippingTotal + importTotal + inlandTotal + financialTotal;

  // 8. Per-unit metrics
  const numCartons = productInfo.numCartons || 1;
  const totalCbm = productInfo.totalCbm || 1;
  const totalWeight = productInfo.totalGrossWeight || 1;

  const landedCostPerUnit = qty > 0 ? totalLandedCost / qty : 0;
  const landedCostPerCarton = numCartons > 0 ? totalLandedCost / numCartons : 0;
  const landedCostPerCbm = totalCbm > 0 ? totalLandedCost / totalCbm : 0;
  const landedCostPerKg = totalWeight > 0 ? totalLandedCost / totalWeight : 0;

  // 9. Final warehouse cost
  const finalWarehouseCost = totalLandedCost;
  const finalWarehouseCostLocal = financial.exchangeRate > 0
    ? totalLandedCost * financial.exchangeRate : totalLandedCost;

  // 10. Percentage breakdown
  const safe = totalLandedCost || 1;
  const pctProduct = (productTotal / safe) * 100;
  const pctExport = (exportTotal / safe) * 100;
  const pctShipping = (shippingTotal / safe) * 100;
  const pctImport = (importTotal / safe) * 100;
  const pctInland = (inlandTotal / safe) * 100;
  const pctFinancial = (financialTotal / safe) * 100;

  return {
    productTotal, exportTotal, shippingTotal, importTotal, inlandTotal, financialTotal,
    totalLandedCost, landedCostPerUnit, landedCostPerCarton, landedCostPerCbm, landedCostPerKg,
    finalWarehouseCost, finalWarehouseCostLocal,
    pctProduct, pctExport, pctShipping, pctImport, pctInland, pctFinancial,
  };
}

/* ── Import duty/tax breakdown (for calculation transparency) ── */

export interface DutyBreakdown {
  dutyBase: number;
  dutyBasisLabel: string;
  dutyAmount: number;
  vatBase: number;
  vatAmount: number;
  additionalTaxAmount: number;
  fixedCharges: number;
  importTotal: number;
}

export function calculateDutyBreakdown(
  productTotal: number,
  exportTotal: number,
  shippingTotal: number,
  priceBasis: string,
  importCosts: ImportCosts,
): DutyBreakdown {
  let dutyBase = productTotal;
  let dutyBasisLabel = "Product Total";

  if (importCosts.calculationBasis === "CIF") {
    dutyBase = productTotal + shippingTotal + (priceBasis === "EXW" ? exportTotal : 0);
    dutyBasisLabel = "CIF Value (Product + Shipping" + (priceBasis === "EXW" ? " + Export" : "") + ")";
  } else if (importCosts.calculationBasis === "FOB") {
    dutyBase = productTotal + (priceBasis === "EXW" ? exportTotal : 0);
    dutyBasisLabel = "FOB Value (Product" + (priceBasis === "EXW" ? " + Export" : "") + ")";
  } else if (importCosts.calculationBasis === "custom_value" && importCosts.customValue > 0) {
    dutyBase = importCosts.customValue;
    dutyBasisLabel = "Custom Declared Value";
  }

  const dutyAmount = dutyBase * (importCosts.customsDutyPct / 100);
  const vatBase = dutyBase + dutyAmount;
  const vatAmount = vatBase * (importCosts.importVatPct / 100);
  const additionalTaxAmount = dutyBase * (importCosts.additionalTaxPct / 100);
  const fixedCharges = sumImportFixed(importCosts);
  const importTotal = dutyAmount + vatAmount + additionalTaxAmount + fixedCharges;

  return { dutyBase, dutyBasisLabel, dutyAmount, vatBase, vatAmount, additionalTaxAmount, fixedCharges, importTotal };
}
