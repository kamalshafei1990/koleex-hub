/* ---------------------------------------------------------------------------
   Pricing Configuration — Stores pricing rules for the Price Calculator.
   Stored as JSON in Supabase Storage (config/pricing-config.json).
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";

const BUCKET = "media";
const CONFIG_PATH = "config/pricing-config.json";

/* ── Types ── */

export interface CustomerChannel {
  id: string;
  name: string;
  visible: boolean;
  markupPct: number;
  rel: string;       // "base" or another channel id
  relLabel: string;   // Display: "from Base", "over Agent", etc.
}

export interface CountryEntry {
  code: string;
  name: string;
  currency: string;
  adjustmentPct: number;
  band: "A" | "B" | "C";
}

export interface PricingCategory {
  id: string;
  name: string;
  min: number;
  max: number;
  marginPct: number;
}

export interface PricingConfig {
  ui: {
    showOverride: boolean;
    showFxRisk: boolean;
    showTaxRefund: boolean;
  };
  maxDiscount: number;
  defaultTaxRefund: number;
  bands: { A: number; B: number; C: number };
  customers: CustomerChannel[];
  countries: CountryEntry[];
  categories: PricingCategory[];
}

/* ── Defaults ── */

export const DEFAULT_CUSTOMERS: CustomerChannel[] = [
  { id: "oem", name: "OEM", visible: true, markupPct: -0.05, rel: "agent", relLabel: "from Agent" },
  { id: "agent", name: "Agent", visible: true, markupPct: -0.03, rel: "base", relLabel: "from Base" },
  { id: "distributor", name: "Distributor", visible: true, markupPct: 0.08, rel: "agent", relLabel: "over Agent" },
  { id: "vip", name: "VIP", visible: true, markupPct: 0.04, rel: "distributor", relLabel: "over Dist" },
  { id: "dealer", name: "Dealer", visible: true, markupPct: 0.08, rel: "distributor", relLabel: "over Dist" },
  { id: "enduser", name: "End-User", visible: true, markupPct: 0.20, rel: "dealer", relLabel: "over Dealer" },
];

export const DEFAULT_CATEGORIES: PricingCategory[] = [
  { id: "level1", name: "Level 1 – Entry / Volume Basic", min: 0, max: 5000, marginPct: 0.05 },
  { id: "level2", name: "Level 2 – Standard Commercial", min: 5000, max: 20000, marginPct: 0.10 },
  { id: "level3", name: "Level 3 – Advanced / Semi-Industrial", min: 20000, max: 50000, marginPct: 0.15 },
  { id: "level4", name: "Level 4 – High-End / Strategic", min: 50000, max: 999999999, marginPct: 0.25 },
];

export const DEFAULT_COUNTRIES: CountryEntry[] = [
  { code: "EG", name: "Egypt", currency: "EGP", adjustmentPct: -0.03, band: "A" },
  { code: "US", name: "United States", currency: "USD", adjustmentPct: 0.08, band: "C" },
  { code: "DE", name: "Germany", currency: "EUR", adjustmentPct: 0.08, band: "C" },
  { code: "TR", name: "Turkey", currency: "TRY", adjustmentPct: 0.00, band: "B" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", adjustmentPct: 0.00, band: "B" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", adjustmentPct: 0.00, band: "B" },
  { code: "IN", name: "India", currency: "INR", adjustmentPct: -0.03, band: "A" },
  { code: "CN", name: "China", currency: "CNY", adjustmentPct: 0.00, band: "B" },
  { code: "BR", name: "Brazil", currency: "BRL", adjustmentPct: 0.00, band: "B" },
  { code: "ZA", name: "South Africa", currency: "ZAR", adjustmentPct: -0.03, band: "A" },
  { code: "GB", name: "United Kingdom", currency: "GBP", adjustmentPct: 0.08, band: "C" },
  { code: "FR", name: "France", currency: "EUR", adjustmentPct: 0.08, band: "C" },
  { code: "JP", name: "Japan", currency: "JPY", adjustmentPct: 0.08, band: "C" },
  { code: "KR", name: "South Korea", currency: "KRW", adjustmentPct: 0.08, band: "C" },
  { code: "AU", name: "Australia", currency: "AUD", adjustmentPct: 0.08, band: "C" },
  { code: "IT", name: "Italy", currency: "EUR", adjustmentPct: 0.08, band: "C" },
  { code: "ES", name: "Spain", currency: "EUR", adjustmentPct: 0.08, band: "C" },
  { code: "MX", name: "Mexico", currency: "MXN", adjustmentPct: 0.00, band: "B" },
  { code: "ID", name: "Indonesia", currency: "IDR", adjustmentPct: 0.00, band: "B" },
  { code: "TH", name: "Thailand", currency: "THB", adjustmentPct: 0.00, band: "B" },
  { code: "PH", name: "Philippines", currency: "PHP", adjustmentPct: 0.00, band: "B" },
  { code: "MY", name: "Malaysia", currency: "MYR", adjustmentPct: 0.00, band: "B" },
  { code: "NG", name: "Nigeria", currency: "NGN", adjustmentPct: -0.03, band: "A" },
  { code: "KE", name: "Kenya", currency: "KES", adjustmentPct: -0.03, band: "A" },
  { code: "PK", name: "Pakistan", currency: "PKR", adjustmentPct: -0.03, band: "A" },
  { code: "BD", name: "Bangladesh", currency: "BDT", adjustmentPct: -0.03, band: "A" },
  { code: "VN", name: "Vietnam", currency: "VND", adjustmentPct: 0.00, band: "B" },
  { code: "CL", name: "Chile", currency: "CLP", adjustmentPct: 0.00, band: "B" },
  { code: "CO", name: "Colombia", currency: "COP", adjustmentPct: 0.00, band: "B" },
  { code: "AR", name: "Argentina", currency: "ARS", adjustmentPct: 0.00, band: "B" },
  { code: "PE", name: "Peru", currency: "PEN", adjustmentPct: 0.00, band: "B" },
  { code: "IQ", name: "Iraq", currency: "IQD", adjustmentPct: 0.00, band: "B" },
  { code: "KW", name: "Kuwait", currency: "KWD", adjustmentPct: 0.00, band: "B" },
  { code: "QA", name: "Qatar", currency: "QAR", adjustmentPct: 0.00, band: "B" },
  { code: "BH", name: "Bahrain", currency: "BHD", adjustmentPct: 0.00, band: "B" },
  { code: "OM", name: "Oman", currency: "OMR", adjustmentPct: 0.00, band: "B" },
  { code: "JO", name: "Jordan", currency: "JOD", adjustmentPct: 0.00, band: "B" },
  { code: "LB", name: "Lebanon", currency: "LBP", adjustmentPct: 0.00, band: "B" },
  { code: "RU", name: "Russia", currency: "RUB", adjustmentPct: 0.00, band: "B" },
  { code: "UA", name: "Ukraine", currency: "UAH", adjustmentPct: 0.00, band: "B" },
  { code: "PL", name: "Poland", currency: "PLN", adjustmentPct: 0.00, band: "B" },
  { code: "SE", name: "Sweden", currency: "SEK", adjustmentPct: 0.08, band: "C" },
  { code: "NO", name: "Norway", currency: "NOK", adjustmentPct: 0.08, band: "C" },
  { code: "DK", name: "Denmark", currency: "DKK", adjustmentPct: 0.08, band: "C" },
  { code: "FI", name: "Finland", currency: "EUR", adjustmentPct: 0.08, band: "C" },
  { code: "NL", name: "Netherlands", currency: "EUR", adjustmentPct: 0.08, band: "C" },
  { code: "BE", name: "Belgium", currency: "EUR", adjustmentPct: 0.08, band: "C" },
  { code: "CH", name: "Switzerland", currency: "CHF", adjustmentPct: 0.08, band: "C" },
  { code: "AT", name: "Austria", currency: "EUR", adjustmentPct: 0.08, band: "C" },
  { code: "SG", name: "Singapore", currency: "SGD", adjustmentPct: 0.08, band: "C" },
  { code: "NZ", name: "New Zealand", currency: "NZD", adjustmentPct: 0.08, band: "C" },
  { code: "GH", name: "Ghana", currency: "GHS", adjustmentPct: -0.03, band: "A" },
  { code: "ET", name: "Ethiopia", currency: "ETB", adjustmentPct: -0.03, band: "A" },
  { code: "TZ", name: "Tanzania", currency: "TZS", adjustmentPct: -0.03, band: "A" },
  { code: "DZ", name: "Algeria", currency: "DZD", adjustmentPct: -0.03, band: "A" },
  { code: "MA", name: "Morocco", currency: "MAD", adjustmentPct: -0.03, band: "A" },
  { code: "TN", name: "Tunisia", currency: "TND", adjustmentPct: -0.03, band: "A" },
  { code: "LY", name: "Libya", currency: "LYD", adjustmentPct: -0.03, band: "A" },
];

export const DEFAULT_CONFIG: PricingConfig = {
  ui: { showOverride: true, showFxRisk: true, showTaxRefund: true },
  maxDiscount: 10,
  defaultTaxRefund: 10,
  bands: { A: -3, B: 0, C: 8 },
  customers: DEFAULT_CUSTOMERS,
  countries: DEFAULT_COUNTRIES,
  categories: DEFAULT_CATEGORIES,
};

/* ── Config CRUD ── */

export async function fetchPricingConfig(): Promise<PricingConfig> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(CONFIG_PATH);
    if (error || !data) return { ...DEFAULT_CONFIG };
    const text = await data.text();
    const raw = JSON.parse(text) as PricingConfig;
    return {
      ui: raw.ui || DEFAULT_CONFIG.ui,
      maxDiscount: raw.maxDiscount ?? DEFAULT_CONFIG.maxDiscount,
      defaultTaxRefund: raw.defaultTaxRefund ?? DEFAULT_CONFIG.defaultTaxRefund,
      bands: raw.bands || DEFAULT_CONFIG.bands,
      customers: raw.customers || DEFAULT_CONFIG.customers,
      countries: raw.countries || DEFAULT_CONFIG.countries,
      categories: raw.categories || DEFAULT_CONFIG.categories,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function savePricingConfig(config: PricingConfig): Promise<boolean> {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const { error } = await supabase.storage.from(BUCKET).upload(CONFIG_PATH, blob, {
    cacheControl: "0",
    upsert: true,
  });
  if (error) { console.error("[PricingConfig] Save:", error.message); return false; }
  return true;
}
