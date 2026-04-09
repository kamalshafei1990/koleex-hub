/* ---------------------------------------------------------------------------
   Landed Cost Simulator — Smart Defaults & Auto-Calculation Helpers
   --------------------------------------------------------------------------- */

/* ── Country defaults for duty/VAT (approximate — user should verify) ── */

export const COUNTRY_DEFAULTS: Record<string, { dutyPct: number; vatPct: number }> = {
  // Middle East & North Africa
  Egypt: { dutyPct: 5, vatPct: 14 },
  "Saudi Arabia": { dutyPct: 5, vatPct: 15 },
  UAE: { dutyPct: 5, vatPct: 5 },
  Kuwait: { dutyPct: 5, vatPct: 0 },
  Qatar: { dutyPct: 5, vatPct: 0 },
  Bahrain: { dutyPct: 5, vatPct: 10 },
  Oman: { dutyPct: 5, vatPct: 5 },
  Jordan: { dutyPct: 10, vatPct: 16 },
  Lebanon: { dutyPct: 5, vatPct: 11 },
  Iraq: { dutyPct: 5, vatPct: 0 },
  Morocco: { dutyPct: 10, vatPct: 20 },
  Tunisia: { dutyPct: 10, vatPct: 19 },
  Algeria: { dutyPct: 15, vatPct: 19 },
  Libya: { dutyPct: 5, vatPct: 0 },
  Turkey: { dutyPct: 10, vatPct: 20 },

  // Europe
  UK: { dutyPct: 0, vatPct: 20 },
  Germany: { dutyPct: 0, vatPct: 19 },
  France: { dutyPct: 0, vatPct: 20 },
  Italy: { dutyPct: 0, vatPct: 22 },
  Spain: { dutyPct: 0, vatPct: 21 },
  Netherlands: { dutyPct: 0, vatPct: 21 },
  Belgium: { dutyPct: 0, vatPct: 21 },
  Poland: { dutyPct: 0, vatPct: 23 },
  Sweden: { dutyPct: 0, vatPct: 25 },
  Russia: { dutyPct: 10, vatPct: 20 },

  // Americas
  USA: { dutyPct: 0, vatPct: 0 },
  Canada: { dutyPct: 0, vatPct: 5 },
  Mexico: { dutyPct: 5, vatPct: 16 },
  Brazil: { dutyPct: 14, vatPct: 17 },

  // Asia Pacific
  China: { dutyPct: 8, vatPct: 13 },
  Japan: { dutyPct: 0, vatPct: 10 },
  "South Korea": { dutyPct: 8, vatPct: 10 },
  India: { dutyPct: 10, vatPct: 18 },
  Pakistan: { dutyPct: 10, vatPct: 18 },
  Bangladesh: { dutyPct: 10, vatPct: 15 },
  Indonesia: { dutyPct: 10, vatPct: 11 },
  Malaysia: { dutyPct: 5, vatPct: 8 },
  Thailand: { dutyPct: 10, vatPct: 7 },
  Vietnam: { dutyPct: 10, vatPct: 10 },
  Philippines: { dutyPct: 5, vatPct: 12 },
  Singapore: { dutyPct: 0, vatPct: 9 },
  Australia: { dutyPct: 5, vatPct: 10 },

  // Africa
  Nigeria: { dutyPct: 10, vatPct: 7.5 },
  "South Africa": { dutyPct: 10, vatPct: 15 },
  Kenya: { dutyPct: 25, vatPct: 16 },
  Ghana: { dutyPct: 10, vatPct: 15 },
};

/** Fuzzy-match a country name to its defaults */
export function findCountryDefaults(country: string): { dutyPct: number; vatPct: number } | null {
  if (!country) return null;
  const lower = country.toLowerCase().trim();
  // Exact match
  for (const [key, val] of Object.entries(COUNTRY_DEFAULTS)) {
    if (key.toLowerCase() === lower) return val;
  }
  // Partial match
  for (const [key, val] of Object.entries(COUNTRY_DEFAULTS)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) return val;
  }
  return null;
}

/* ── Auto-calculation helpers ── */

/** Calculate volumetric weight from total CBM based on shipping mode */
export function calcVolumetricWeight(totalCbm: number, mode: string): number {
  if (totalCbm <= 0) return 0;
  if (mode === "Air" || mode === "Courier") return Math.round(totalCbm * 1000000 / 5000 * 100) / 100;
  return Math.round(totalCbm * 1000 * 100) / 100; // Sea/Land: 1 CBM ≈ 1000 kg
}

/** Chargeable weight = whichever is higher */
export function calcChargeableWeight(actual: number, volumetric: number): number {
  return Math.max(actual, volumetric);
}

/** Estimate number of cartons from quantity (if units per carton known) */
export function estimateCartons(quantity: number, unitsPerCarton: number): number {
  if (unitsPerCarton <= 0) return quantity; // default: 1 unit = 1 carton
  return Math.ceil(quantity / unitsPerCarton);
}
