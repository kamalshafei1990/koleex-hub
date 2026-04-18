/**
 * KOLEEX Pricing Engine — Core Calculation Functions
 * All formulas follow the confirmed pricing specification exactly.
 */

import { PRODUCT_LEVELS, MARKET_BANDS, type ProductLevel, type MarketBand } from './pricing-config';

// ─── Types ───────────────────────────────────────────────

export interface PricingInput {
  koleexCost: number;          // CNY
  exchangeRate: number;        // CNY per 1 USD
  targetCurrency: string;
  targetCountry: string;
  marketBandId: string;
  quantity: number;
  chineseCompetitorPrice?: number;
  marketCompetitorPrice?: number;
}

export interface PriceLadder {
  koleexCost: number;
  basePrice: number;
  platinumPrice: number;
  goldPrice: number;
  silverPrice: number;
  retailGlobalPrice: number;
  retailMarketPrice: number;
}

export interface PricingResult {
  input: PricingInput;
  productLevel: ProductLevel;
  marketBand: MarketBand;
  ladder: PriceLadder;
  ladderUSD: PriceLadder;
  margins: MarginAnalysis;
  chineseComparison?: CompetitorComparison;
  marketComparison?: CompetitorComparison;
}

export interface MarginAnalysis {
  basePriceMargin: number;
  platinumMargin: number;
  goldMargin: number;
  silverMargin: number;
  retailGlobalMargin: number;
  retailMarketMargin: number;
}

export interface CompetitorComparison {
  competitorPrice: number;
  koleexPrice: number;
  difference: number;
  percentageDiff: number;
  isLower: boolean;
}

export interface LandedCostResult {
  fobValue: number;
  freight: number;
  insurance: number;
  cifValue: number;
  importDuty: number;
  vat: number;
  bankCharges: number;
  clearance: number;
  trucking: number;
  totalLandedCost: number;
  landedMultiplier: number;
  currency: string;
}

// ─── Core Functions ──────────────────────────────────────

/** Detect product level from KOLEEX COST (CNY) */
export function detectProductLevel(costCNY: number): ProductLevel {
  for (const level of PRODUCT_LEVELS) {
    if (level.maxCost === null && costCNY >= level.minCost) return level;
    if (costCNY >= level.minCost && level.maxCost !== null && costCNY <= level.maxCost) return level;
  }
  return PRODUCT_LEVELS[0]; // fallback
}

/** Get market band by ID */
export function getMarketBand(bandId: string): MarketBand {
  return MARKET_BANDS.find(b => b.id === bandId) || MARKET_BANDS[1]; // default Band B
}

/** Calculate the full price ladder in CNY. countryAdjustment overrides band default if set. */
export function calculatePriceLadder(koleexCost: number, productLevel: ProductLevel, marketBand: MarketBand, countryAdjustment?: number): PriceLadder {
  const basePrice = koleexCost * (1 + productLevel.margin);
  const platinumPrice = basePrice * 0.97;
  const goldPrice = platinumPrice * 1.08;
  const silverPrice = goldPrice * 1.08;
  const retailGlobalPrice = silverPrice * 1.20;
  // Use country-specific adjustment if provided, otherwise use band default
  const adjustment = countryAdjustment !== undefined ? countryAdjustment : marketBand.adjustment;
  const retailMarketPrice = retailGlobalPrice * (1 + adjustment);

  return {
    koleexCost: round2(koleexCost),
    basePrice: round2(basePrice),
    platinumPrice: round2(platinumPrice),
    goldPrice: round2(goldPrice),
    silverPrice: round2(silverPrice),
    retailGlobalPrice: round2(retailGlobalPrice),
    retailMarketPrice: round2(retailMarketPrice),
  };
}

/** Convert a CNY price ladder to USD */
export function convertLadderToUSD(ladder: PriceLadder, exchangeRate: number): PriceLadder {
  const rate = exchangeRate || 7.25;
  return {
    koleexCost: round2(ladder.koleexCost / rate),
    basePrice: round2(ladder.basePrice / rate),
    platinumPrice: round2(ladder.platinumPrice / rate),
    goldPrice: round2(ladder.goldPrice / rate),
    silverPrice: round2(ladder.silverPrice / rate),
    retailGlobalPrice: round2(ladder.retailGlobalPrice / rate),
    retailMarketPrice: round2(ladder.retailMarketPrice / rate),
  };
}

/** Calculate margins relative to KOLEEX Cost */
export function calculateMargins(ladder: PriceLadder): MarginAnalysis {
  const cost = ladder.koleexCost;
  return {
    basePriceMargin: marginPct(cost, ladder.basePrice),
    platinumMargin: marginPct(cost, ladder.platinumPrice),
    goldMargin: marginPct(cost, ladder.goldPrice),
    silverMargin: marginPct(cost, ladder.silverPrice),
    retailGlobalMargin: marginPct(cost, ladder.retailGlobalPrice),
    retailMarketMargin: marginPct(cost, ladder.retailMarketPrice),
  };
}

/** Calculate full pricing result */
export function calculatePricing(input: PricingInput): PricingResult {
  const productLevel = detectProductLevel(input.koleexCost);
  const marketBand = getMarketBand(input.marketBandId);
  const ladder = calculatePriceLadder(input.koleexCost, productLevel, marketBand);
  const ladderUSD = convertLadderToUSD(ladder, input.exchangeRate);
  const margins = calculateMargins(ladder);

  let chineseComparison: CompetitorComparison | undefined;
  if (input.chineseCompetitorPrice && input.chineseCompetitorPrice > 0) {
    chineseComparison = {
      competitorPrice: input.chineseCompetitorPrice,
      koleexPrice: ladderUSD.platinumPrice,
      difference: round2(ladderUSD.platinumPrice - input.chineseCompetitorPrice),
      percentageDiff: round2(((ladderUSD.platinumPrice - input.chineseCompetitorPrice) / input.chineseCompetitorPrice) * 100),
      isLower: ladderUSD.platinumPrice <= input.chineseCompetitorPrice,
    };
  }

  let marketComparison: CompetitorComparison | undefined;
  if (input.marketCompetitorPrice && input.marketCompetitorPrice > 0) {
    marketComparison = {
      competitorPrice: input.marketCompetitorPrice,
      koleexPrice: ladderUSD.retailMarketPrice,
      difference: round2(ladderUSD.retailMarketPrice - input.marketCompetitorPrice),
      percentageDiff: round2(((ladderUSD.retailMarketPrice - input.marketCompetitorPrice) / input.marketCompetitorPrice) * 100),
      isLower: ladderUSD.retailMarketPrice <= input.marketCompetitorPrice,
    };
  }

  return { input, productLevel, marketBand, ladder, ladderUSD, margins, chineseComparison, marketComparison };
}

/** Calculate landed cost */
export function calculateLandedCost(params: {
  fobValueUSD: number;
  freightUSD: number;
  insurancePct: number;
  dutyPct: number;
  vatPct: number;
  bankChargesPct: number;
  clearanceLocal: number;
  truckingLocal: number;
  localCurrencyRate: number;
  localCurrency: string;
}): LandedCostResult {
  const fobLocal = params.fobValueUSD * params.localCurrencyRate;
  const freightLocal = params.freightUSD * params.localCurrencyRate;
  const insurance = fobLocal * (params.insurancePct / 100);
  const cifValue = fobLocal + freightLocal + insurance;
  const importDuty = cifValue * (params.dutyPct / 100);
  const vat = (cifValue + importDuty) * (params.vatPct / 100);
  const bankCharges = fobLocal * (params.bankChargesPct / 100);

  const totalLandedCost = cifValue + importDuty + vat + bankCharges + params.clearanceLocal + params.truckingLocal;
  const landedMultiplier = params.fobValueUSD > 0 ? totalLandedCost / fobLocal : 0;

  return {
    fobValue: round2(fobLocal),
    freight: round2(freightLocal),
    insurance: round2(insurance),
    cifValue: round2(cifValue),
    importDuty: round2(importDuty),
    vat: round2(vat),
    bankCharges: round2(bankCharges),
    clearance: params.clearanceLocal,
    trucking: params.truckingLocal,
    totalLandedCost: round2(totalLandedCost),
    landedMultiplier: round2(landedMultiplier * 100) / 100,
    currency: params.localCurrency,
  };
}

// ─── Helpers ─────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function marginPct(cost: number, price: number): number {
  if (cost === 0) return 0;
  return round2(((price - cost) / cost) * 100);
}

/** Format number with commas */
export function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Format currency */
export function formatCurrency(n: number, symbol = '$', decimals = 2): string {
  return `${symbol}${formatNumber(n, decimals)}`;
}

// ─── Example Scenarios (for visual teaching) ─────────────

export interface PricingScenario {
  id: string;
  name: string;
  description: string;
  koleexCost: number;
  country: string;
  bandId: string;
  exchangeRate: number;
  productCategory: string;
  chineseCompetitorPrice?: number;
  marketCompetitorPrice?: number;
}

export const EXAMPLE_SCENARIOS: PricingScenario[] = [
  {
    id: 'low-cost-egypt', name: 'Compact Relay Module — Egypt',
    description: 'Low-cost product sold to a dealer in Egypt (Band A).',
    koleexCost: 2800, country: 'Egypt', bandId: 'A', exchangeRate: 7.25,
    productCategory: 'Control Components',
    chineseCompetitorPrice: 380, marketCompetitorPrice: 650,
  },
  {
    id: 'mid-range-turkey', name: 'Industrial PLC Controller — Turkey',
    description: 'Mid-range automation product for distributor in Turkey (Band B).',
    koleexCost: 12000, country: 'Turkey', bandId: 'B', exchangeRate: 7.25,
    productCategory: 'PLC Systems',
    chineseCompetitorPrice: 1800, marketCompetitorPrice: 2900,
  },
  {
    id: 'high-value-germany', name: 'CNC Motion Controller — Germany',
    description: 'High-value precision equipment for German market (Band C).',
    koleexCost: 35000, country: 'Germany', bandId: 'C', exchangeRate: 7.25,
    productCategory: 'Motion Control',
    chineseCompetitorPrice: 5200, marketCompetitorPrice: 8500,
  },
  {
    id: 'enterprise-uae', name: 'Robotic Assembly System — UAE',
    description: 'Enterprise-grade robotic system for UAE premium market (Band C).',
    koleexCost: 85000, country: 'UAE', bandId: 'C', exchangeRate: 7.25,
    productCategory: 'Robotics',
    chineseCompetitorPrice: 14000, marketCompetitorPrice: 22000,
  },
  {
    id: 'mid-brazil', name: 'Servo Drive Unit — Brazil',
    description: 'Standard servo drive for Brazilian distributor (Band B).',
    koleexCost: 8500, country: 'Brazil', bandId: 'B', exchangeRate: 7.25,
    productCategory: 'Drives & Motors',
    chineseCompetitorPrice: 1200, marketCompetitorPrice: 2100,
  },
  {
    id: 'low-vietnam', name: 'Sensor Array Kit — Vietnam',
    description: 'Budget sensor kit for emerging market dealer (Band A).',
    koleexCost: 1500, country: 'Vietnam', bandId: 'A', exchangeRate: 7.25,
    productCategory: 'Sensors',
    chineseCompetitorPrice: 190, marketCompetitorPrice: 320,
  },
  {
    id: 'discount-turkey', name: 'Discounted PLC — Turkey (10% Off)',
    description: 'Mid-range PLC with 10% approved discount for strategic distributor.',
    koleexCost: 12000, country: 'Turkey', bandId: 'B', exchangeRate: 7.25,
    productCategory: 'PLC Systems',
    chineseCompetitorPrice: 1800, marketCompetitorPrice: 2900,
  },
  {
    id: 'fx-risk-egypt', name: 'FX Risk — Sensor Kit Egypt (USD Falling)',
    description: 'Budget sensor with margin buffer due to expected USD depreciation.',
    koleexCost: 1500, country: 'Egypt', bandId: 'A', exchangeRate: 7.25,
    productCategory: 'Sensors',
    chineseCompetitorPrice: 190, marketCompetitorPrice: 320,
  },
  {
    id: 'large-project-uae', name: 'Large Project — 50 Units UAE',
    description: 'Enterprise robotic system, 50-unit project order for UAE.',
    koleexCost: 85000, country: 'UAE', bandId: 'C', exchangeRate: 7.25,
    productCategory: 'Robotics',
    chineseCompetitorPrice: 14000, marketCompetitorPrice: 22000,
  },
  {
    id: 'oem-germany', name: 'OEM Controller — Germany',
    description: 'OEM-grade motion controller for integration into German machinery.',
    koleexCost: 35000, country: 'Germany', bandId: 'C', exchangeRate: 7.25,
    productCategory: 'Motion Control',
    chineseCompetitorPrice: 5200, marketCompetitorPrice: 8500,
  },
  {
    id: 'agent-brazil', name: 'Agent Order — Servo Drive Brazil',
    description: 'Agent-tier pricing for servo drives in Brazil (Band B).',
    koleexCost: 8500, country: 'Brazil', bandId: 'B', exchangeRate: 7.25,
    productCategory: 'Drives & Motors',
    chineseCompetitorPrice: 1200, marketCompetitorPrice: 2100,
  },
];

/** Generate a full pricing result from a scenario */
export function calculateScenario(scenario: PricingScenario): PricingResult {
  return calculatePricing({
    koleexCost: scenario.koleexCost,
    exchangeRate: scenario.exchangeRate,
    targetCurrency: 'USD',
    targetCountry: scenario.country,
    marketBandId: scenario.bandId,
    quantity: 1,
    chineseCompetitorPrice: scenario.chineseCompetitorPrice,
    marketCompetitorPrice: scenario.marketCompetitorPrice,
  });
}
