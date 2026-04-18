/**
 * KOLEEX Pricing Engine — Master Configuration
 * All confirmed business rules per pricing specification.
 * Future: replace with Supabase/API data.
 */

// ─── Product Levels ──────────────────────────────────────
export interface ProductLevel {
  id: number;
  name: string;
  minCost: number;
  maxCost: number | null; // null = unlimited
  margin: number;
  currency: string;
}

export const PRODUCT_LEVELS: ProductLevel[] = [
  { id: 1, name: 'Standard', minCost: 100, maxCost: 5000, margin: 0.05, currency: 'CNY' },
  { id: 2, name: 'Professional', minCost: 5001, maxCost: 20000, margin: 0.10, currency: 'CNY' },
  { id: 3, name: 'Advanced', minCost: 20001, maxCost: 50000, margin: 0.15, currency: 'CNY' },
  { id: 4, name: 'Enterprise', minCost: 50001, maxCost: null, margin: 0.25, currency: 'CNY' },
];

// ─── Customer Tiers ──────────────────────────────────────
export interface CustomerTier {
  id: string;
  tier: string;
  realName: string;
  multiplier: number;
  order: number;
  color: string;       // primary metallic color
  colorLight: string;  // light bg variant (10% opacity feel)
  colorDark: string;   // darker accent
}

export const CUSTOMER_TIERS: CustomerTier[] = [
  { id: 'platinum', tier: 'Platinum', realName: 'Agent', multiplier: 0.97, order: 1, color: '#7BA1C2', colorLight: '#EDF3F8', colorDark: '#5A85AB' },
  { id: 'gold', tier: 'Gold', realName: 'Distributor', multiplier: 1.08, order: 2, color: '#C9973F', colorLight: '#FBF4E6', colorDark: '#A67B2E' },
  { id: 'silver', tier: 'Silver', realName: 'Dealer', multiplier: 1.08, order: 3, color: '#A8A9AD', colorLight: '#F2F2F3', colorDark: '#808185' },
  { id: 'retail', tier: 'Retail Global', realName: 'End User', multiplier: 1.20, order: 4, color: '#6B8F71', colorLight: '#EEF4EF', colorDark: '#4A6E50' },
];

/** Helper to get tier color config by id */
export function getTierColor(tierId: string) {
  const tier = CUSTOMER_TIERS.find(t => t.id === tierId);
  return tier ? { color: tier.color, light: tier.colorLight, dark: tier.colorDark } : { color: '#86868B', light: '#F5F5F7', dark: '#666' };
}

// ─── Market Bands ────────────────────────────────────────
export interface MarketBand {
  id: string;
  name: string;
  label: string;
  adjustment: number; // e.g. -0.03, 0, 0.08
  description: string;
  sampleCountries: string[];
}

export const MARKET_BANDS: MarketBand[] = [
  {
    id: 'A', name: 'Band A', label: 'Price Sensitive Markets',
    adjustment: -0.03, description: 'Highly price sensitive, strong competition, lower margins, volume-driven.',
    sampleCountries: ['Egypt', 'Nigeria', 'Vietnam', 'Bangladesh', 'Pakistan'],
  },
  {
    id: 'B', name: 'Band B', label: 'Balanced Markets',
    adjustment: 0, description: 'Balanced markets with normal margins and standard pricing.',
    sampleCountries: ['Turkey', 'Brazil', 'Mexico', 'Thailand', 'Malaysia'],
  },
  {
    id: 'C', name: 'Band C', label: 'Premium Markets',
    adjustment: 0.08, description: 'Premium markets where customers value quality and brand. Higher margins possible.',
    sampleCountries: ['Germany', 'United States', 'Japan', 'Australia', 'UAE'],
  },
  {
    id: 'D', name: 'Band D', label: 'Special / Project Markets',
    adjustment: 0, description: 'Special projects, government tenders, OEM, and strategic deals. Custom pricing.',
    sampleCountries: [],
  },
];

/** Band adjustment ranges for reference */
export const BAND_ADJUSTMENT_RANGES: Record<string, { min: number; max: number; default: number; color: string; colorLight: string }> = {
  A: { min: -0.05, max: -0.03, default: -0.03, color: '#34C759', colorLight: '#EEFBF1' },
  B: { min: 0, max: 0, default: 0, color: '#007AFF', colorLight: '#EDF4FF' },
  C: { min: 0.05, max: 0.08, default: 0.08, color: '#FF9500', colorLight: '#FFF5E6' },
  D: { min: -0.10, max: 0.15, default: 0, color: '#AF52DE', colorLight: '#F5EEFB' },
};

// ─── Price Ladder Steps ──────────────────────────────────
export const PRICE_LADDER_STEPS = [
  'KOLEEX Cost',
  'Base Price',
  'Platinum Price (Agent)',
  'Gold Price (Distributor)',
  'Silver Price (Dealer)',
  'Retail Global Price',
  'Retail Market Price',
] as const;

// ─── Landed Cost Default Structure ──────────────────────
export interface LandedCostItem {
  id: string;
  label: string;
  type: 'percentage' | 'fixed';
  defaultValue: number;
  basis?: string; // what it's a percentage of
  description: string;
}

export const LANDED_COST_STRUCTURE: LandedCostItem[] = [
  { id: 'fob', label: 'Machine / FOB Value', type: 'fixed', defaultValue: 0, description: 'The base FOB price of the equipment' },
  { id: 'freight', label: 'Freight', type: 'fixed', defaultValue: 0, description: 'Shipping cost from origin to destination port' },
  { id: 'insurance', label: 'Insurance', type: 'percentage', defaultValue: 0.5, basis: 'fob', description: 'Marine insurance as % of FOB value' },
  { id: 'duty', label: 'Import Duty', type: 'percentage', defaultValue: 5, basis: 'cif', description: 'Customs duty as % of CIF value' },
  { id: 'vat', label: 'VAT / Tax', type: 'percentage', defaultValue: 14, basis: 'cif_duty', description: 'VAT on CIF + Duty value' },
  { id: 'bank', label: 'Bank Charges', type: 'percentage', defaultValue: 1.5, basis: 'fob', description: 'LC / banking fees as % of FOB' },
  { id: 'clearance', label: 'Clearance & Handling', type: 'fixed', defaultValue: 500, description: 'Customs clearance and port handling (local currency)' },
  { id: 'trucking', label: 'Local Transport', type: 'fixed', defaultValue: 300, description: 'Domestic trucking/delivery (local currency)' },
];

// ─── Currencies ──────────────────────────────────────────
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  defaultRate: number; // vs USD
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', defaultRate: 1 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', defaultRate: 7.25 },
  { code: 'EUR', name: 'Euro', symbol: '€', defaultRate: 0.92 },
  { code: 'GBP', name: 'British Pound', symbol: '£', defaultRate: 0.79 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', defaultRate: 3.67 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', defaultRate: 50.5 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', defaultRate: 3.75 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', defaultRate: 32.2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', defaultRate: 5.05 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', defaultRate: 83.5 },
];

// ─── Sample Countries for Market Band mapping ────────────
export interface CountryMarket {
  country: string;
  band: string;
  region: string;
}

export const COUNTRY_MARKETS: CountryMarket[] = [
  { country: 'Egypt', band: 'A', region: 'Middle East & Africa' },
  { country: 'Nigeria', band: 'A', region: 'Middle East & Africa' },
  { country: 'Vietnam', band: 'A', region: 'Asia Pacific' },
  { country: 'Bangladesh', band: 'A', region: 'Asia Pacific' },
  { country: 'Pakistan', band: 'A', region: 'Asia Pacific' },
  { country: 'Turkey', band: 'B', region: 'Middle East & Africa' },
  { country: 'Brazil', band: 'B', region: 'Americas' },
  { country: 'Mexico', band: 'B', region: 'Americas' },
  { country: 'Thailand', band: 'B', region: 'Asia Pacific' },
  { country: 'Malaysia', band: 'B', region: 'Asia Pacific' },
  { country: 'India', band: 'B', region: 'Asia Pacific' },
  { country: 'Saudi Arabia', band: 'B', region: 'Middle East & Africa' },
  { country: 'Germany', band: 'C', region: 'Europe' },
  { country: 'United States', band: 'C', region: 'Americas' },
  { country: 'Japan', band: 'C', region: 'Asia Pacific' },
  { country: 'Australia', band: 'C', region: 'Asia Pacific' },
  { country: 'UAE', band: 'C', region: 'Middle East & Africa' },
  { country: 'United Kingdom', band: 'C', region: 'Europe' },
  { country: 'France', band: 'C', region: 'Europe' },
  { country: 'South Korea', band: 'C', region: 'Asia Pacific' },
];
