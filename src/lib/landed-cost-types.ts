/* ---------------------------------------------------------------------------
   Landed Cost Simulator — Type definitions
   --------------------------------------------------------------------------- */

export interface ProductInfo {
  packingType: string;
  numCartons: number;
  netWeightPerUnit: number;
  grossWeightPerUnit: number;
  totalGrossWeight: number;
  cbmPerUnit: number;
  totalCbm: number;
  loadingType: string; // LCL | FCL 20GP | FCL 40GP | FCL 40HQ | Air | Courier
}

export interface ExportCosts {
  factoryToPort: number;
  localTrucking: number;
  exportCustomsFee: number;
  portCharges: number;
  terminalHandling: number;
  documentationFee: number;
  inspectionFee: number;
  fumigationFee: number;
  palletizationFee: number;
  extraPackingCost: number;
  loadingFee: number;
  exportAgentFee: number;
  bankCharges: number;
  certificateOfOriginFee: number;
  formCertificateFee: number;
  otherExportCharges: number;
  notes: string;
}

export interface ShippingCosts {
  shippingMode: string; // Sea | Air | Courier | Land
  portOfLoading: string;
  portOfDestination: string;
  freightCost: number;
  insuranceCost: number;
  baf: number;
  caf: number;
  gri: number;
  peakSeasonSurcharge: number;
  amsEnsIsf: number;
  blAwbFee: number;
  telexReleaseFee: number;
  chargeableWeight: number;
  actualWeight: number;
  volumetricWeight: number;
  transitTime: string;
  freightCurrency: string;
  freightExchangeRate: number;
  notes: string;
}

export interface ImportCosts {
  customsDutyPct: number;
  importVatPct: number;
  additionalTaxPct: number;
  antiDumpingDuty: number;
  portCharges: number;
  terminalHandling: number;
  customsClearanceFee: number;
  customsBrokerFee: number;
  inspectionFee: number;
  certificateVerificationFee: number;
  storageFee: number;
  demurrage: number;
  detention: number;
  deliveryOrderFee: number;
  portSecurityFee: number;
  scanningFee: number;
  municipalityFee: number;
  translationLegalizationFee: number;
  otherImportCharges: number;
  calculationBasis: string; // FOB | CIF | custom_value
  customValue: number;
  notes: string;
}

export interface InlandDelivery {
  finalDeliveryCity: string;
  finalWarehouseAddress: string;
  distanceFromPort: string;
  localTruckingToWarehouse: number;
  unloadingFee: number;
  craneForkliftFee: number;
  warehouseReceivingCharges: number;
  lastMileHandling: number;
  remoteAreaSurcharge: number;
  restrictedAreaSurcharge: number;
  appointmentDeliveryFee: number;
  nightDeliveryFee: number;
  otherLocalDeliveryCharges: number;
  notes: string;
}

export interface FinancialSettings {
  exchangeRate: number;
  paymentTerm: string; // TT | LC | DP | OA
  bankTransferCost: number;
  financingCost: number;
  creditInsurance: number;
  agentCommission: number;
  salesCommission: number;
  discount: number;
  margin: number;
  contingencyPct: number;
  unexpectedReserve: number;
  includeTaxInFinal: boolean;
  includeCommissionInFinal: boolean;
  notes: string;
}

export interface SimulationResults {
  productTotal: number;
  exportTotal: number;
  shippingTotal: number;
  importTotal: number;
  inlandTotal: number;
  financialTotal: number;
  totalLandedCost: number;
  landedCostPerUnit: number;
  landedCostPerCarton: number;
  landedCostPerCbm: number;
  landedCostPerKg: number;
  finalWarehouseCost: number;
  finalWarehouseCostLocal: number;
  pctProduct: number;
  pctExport: number;
  pctShipping: number;
  pctImport: number;
  pctInland: number;
  pctFinancial: number;
}

export interface SimulationRow {
  id: string;
  name: string;
  status: string;
  customer_name: string | null;
  customer_company: string | null;
  customer_country: string | null;
  customer_city: string | null;
  warehouse_destination: string | null;
  product_id: string | null;
  product_name: string | null;
  model_id: string | null;
  model_name: string | null;
  sku: string | null;
  hs_code: string | null;
  brand: string | null;
  country_of_origin: string | null;
  quantity: number;
  unit_price: number;
  currency: string;
  price_basis: string;
  product_info: ProductInfo;
  export_costs: ExportCosts;
  shipping: ShippingCosts;
  import_costs: ImportCosts;
  inland_delivery: InlandDelivery;
  financial: FinancialSettings;
  results: SimulationResults;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Defaults ── */

export const DEFAULT_PRODUCT_INFO: ProductInfo = {
  packingType: "", numCartons: 0, netWeightPerUnit: 0, grossWeightPerUnit: 0,
  totalGrossWeight: 0, cbmPerUnit: 0, totalCbm: 0, loadingType: "FCL 20GP",
};

export const DEFAULT_EXPORT_COSTS: ExportCosts = {
  factoryToPort: 0, localTrucking: 0, exportCustomsFee: 0, portCharges: 0,
  terminalHandling: 0, documentationFee: 0, inspectionFee: 0, fumigationFee: 0,
  palletizationFee: 0, extraPackingCost: 0, loadingFee: 0, exportAgentFee: 0,
  bankCharges: 0, certificateOfOriginFee: 0, formCertificateFee: 0,
  otherExportCharges: 0, notes: "",
};

export const DEFAULT_SHIPPING: ShippingCosts = {
  shippingMode: "Sea", portOfLoading: "", portOfDestination: "",
  freightCost: 0, insuranceCost: 0, baf: 0, caf: 0, gri: 0,
  peakSeasonSurcharge: 0, amsEnsIsf: 0, blAwbFee: 0, telexReleaseFee: 0,
  chargeableWeight: 0, actualWeight: 0, volumetricWeight: 0,
  transitTime: "", freightCurrency: "USD", freightExchangeRate: 1, notes: "",
};

export const DEFAULT_IMPORT_COSTS: ImportCosts = {
  customsDutyPct: 0, importVatPct: 0, additionalTaxPct: 0, antiDumpingDuty: 0,
  portCharges: 0, terminalHandling: 0, customsClearanceFee: 0, customsBrokerFee: 0,
  inspectionFee: 0, certificateVerificationFee: 0, storageFee: 0,
  demurrage: 0, detention: 0, deliveryOrderFee: 0, portSecurityFee: 0,
  scanningFee: 0, municipalityFee: 0, translationLegalizationFee: 0,
  otherImportCharges: 0, calculationBasis: "CIF", customValue: 0, notes: "",
};

export const DEFAULT_INLAND: InlandDelivery = {
  finalDeliveryCity: "", finalWarehouseAddress: "", distanceFromPort: "",
  localTruckingToWarehouse: 0, unloadingFee: 0, craneForkliftFee: 0,
  warehouseReceivingCharges: 0, lastMileHandling: 0, remoteAreaSurcharge: 0,
  restrictedAreaSurcharge: 0, appointmentDeliveryFee: 0, nightDeliveryFee: 0,
  otherLocalDeliveryCharges: 0, notes: "",
};

export const DEFAULT_FINANCIAL: FinancialSettings = {
  exchangeRate: 1, paymentTerm: "TT", bankTransferCost: 0, financingCost: 0,
  creditInsurance: 0, agentCommission: 0, salesCommission: 0, discount: 0,
  margin: 0, contingencyPct: 0, unexpectedReserve: 0,
  includeTaxInFinal: false, includeCommissionInFinal: false, notes: "",
};

export const DEFAULT_RESULTS: SimulationResults = {
  productTotal: 0, exportTotal: 0, shippingTotal: 0, importTotal: 0,
  inlandTotal: 0, financialTotal: 0, totalLandedCost: 0, landedCostPerUnit: 0,
  landedCostPerCarton: 0, landedCostPerCbm: 0, landedCostPerKg: 0,
  finalWarehouseCost: 0, finalWarehouseCostLocal: 0,
  pctProduct: 0, pctExport: 0, pctShipping: 0, pctImport: 0, pctInland: 0, pctFinancial: 0,
};
