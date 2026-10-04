/* ---------------------------------------------------------------------------
   Shipping — volumetric and chargeable weight, with the convention NAMED.

   ⚠️ THE DIVISOR IS NOT A CONSTANT, IT IS A CONTRACT.
   Air freight charges the greater of actual and volumetric weight, and the
   divisor that turns volume into weight is a term of the carrier's tariff:

     IATA air cargo        6000 cm³/kg   → 1 CBM = 166.67 kg
     express couriers      5000 cm³/kg   → 1 CBM = 200 kg

   The same shipment costs 20% more under the courier rule. So this module
   never picks one silently — every function takes a named rule, and every
   result carries the rule back so the screen can say which one it used.

   ── The Hub already disagrees with itself about this ───────────────────────
   Two existing helpers use two different divisors, neither labelled:
     · src/lib/landed-cost-defaults.ts  calcVolumetricWeight() → /5000 for Air
     · src/lib/logistics.ts            sumPackages()          → /6000
   Both are LEFT EXACTLY AS THEY ARE. Their numbers feed saved simulations and
   packing lists, and changing a divisor under stored data would silently
   restate history. This module is additive: Shipping states its rule, and a
   future reconciliation can be a deliberate decision rather than a side effect.
   --------------------------------------------------------------------------- */

import type { VolumetricRule } from "./types";

/** cm³ per kg. The number the carrier's tariff names. */
export const VOLUMETRIC_DIVISOR: Record<VolumetricRule, number> = {
  iata_air: 6000,
  express_courier: 5000,
};

/** kg per cubic metre, which is how the same rule reads on an LCL screen. */
export const KG_PER_CBM: Record<VolumetricRule, number> = {
  iata_air: 1_000_000 / 6000,      // 166.67
  express_courier: 1_000_000 / 5000, // 200
};

export const DEFAULT_AIR_RULE: VolumetricRule = "iata_air";

export interface Dimension { l: number; w: number; h: number; qty?: number }

export interface ChargeableWeight {
  /** What the scale says. */
  grossKg: number;
  /** What the volume converts to under `rule`. */
  volumetricKg: number;
  /** The greater of the two — what is actually billed. */
  chargeableKg: number;
  /** Which of the two won, so the screen can say why. */
  basis: "gross" | "volumetric" | "equal";
  rule: VolumetricRule;
  divisor: number;
  /** Total volume of the dimensions given, m³. */
  cbm: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Total volume in m³ of a set of pieces given in centimetres. */
export function cbmOf(dims: Dimension[]): number {
  let cm3 = 0;
  for (const d of dims) {
    const l = Number(d.l) || 0, w = Number(d.w) || 0, h = Number(d.h) || 0;
    const qty = Number(d.qty ?? 1) || 0;
    if (l <= 0 || w <= 0 || h <= 0 || qty <= 0) continue;
    cm3 += l * w * h * qty;
  }
  return round2(cm3 / 1_000_000 * 1000) / 1000;
}

/** Volumetric weight in kg for a volume in m³, under a named rule. */
export function volumetricFromCbm(cbm: number, rule: VolumetricRule = DEFAULT_AIR_RULE): number {
  if (!(cbm > 0)) return 0;
  return round2(cbm * KG_PER_CBM[rule]);
}

/** Volumetric weight in kg for pieces measured in centimetres. */
export function volumetricFromDimensions(dims: Dimension[], rule: VolumetricRule = DEFAULT_AIR_RULE): number {
  let cm3 = 0;
  for (const d of dims) {
    const l = Number(d.l) || 0, w = Number(d.w) || 0, h = Number(d.h) || 0;
    const qty = Number(d.qty ?? 1) || 0;
    if (l <= 0 || w <= 0 || h <= 0 || qty <= 0) continue;
    cm3 += l * w * h * qty;
  }
  return round2(cm3 / VOLUMETRIC_DIVISOR[rule]);
}

/**
 * Chargeable weight = max(gross, volumetric), with everything the screen needs
 * to explain the answer.
 *
 * Pass EITHER dimensions OR a cbm figure. Dimensions win when both are given,
 * because they are the more specific statement.
 */
export function chargeableWeight(input: {
  grossKg?: number;
  cbm?: number;
  dimensionsCm?: Dimension[];
  rule?: VolumetricRule;
}): ChargeableWeight {
  const rule = input.rule ?? DEFAULT_AIR_RULE;
  const gross = Math.max(0, Number(input.grossKg) || 0);

  const dims = input.dimensionsCm?.filter((d) => d && d.l > 0 && d.w > 0 && d.h > 0) ?? [];
  const cbm = dims.length ? cbmOf(dims) : Math.max(0, Number(input.cbm) || 0);
  const volumetric = dims.length
    ? volumetricFromDimensions(dims, rule)
    : volumetricFromCbm(cbm, rule);

  const chargeable = Math.max(gross, volumetric);
  const basis: ChargeableWeight["basis"] =
    gross === volumetric ? "equal" : volumetric > gross ? "volumetric" : "gross";

  return {
    grossKg: round2(gross),
    volumetricKg: round2(volumetric),
    chargeableKg: round2(chargeable),
    basis,
    rule,
    divisor: VOLUMETRIC_DIVISOR[rule],
    cbm: round2(cbm),
  };
}

/**
 * LCL is billed on weight-or-measure: whichever of the volume (m³) and the
 * weight (tonnes) is greater, at the same per-unit rate. The trade writes it
 * "W/M" and the ratio is usually 1 tonne : 1 m³.
 *
 * Returns the number of REVENUE TONS to charge, and which side won — a 4.5 CBM
 * shipment weighing 6 tonnes is billed as 6, and an operator who only sees
 * "4.5 CBM × rate" will under-quote it.
 */
export function revenueTons(input: { cbm?: number; grossKg?: number; ratioKgPerCbm?: number }): {
  cbm: number;
  tonnes: number;
  revenueTons: number;
  basis: "measure" | "weight" | "equal";
  ratioKgPerCbm: number;
} {
  const ratio = Number(input.ratioKgPerCbm) || 1000;   // 1 t : 1 m³, the default W/M
  const cbm = Math.max(0, Number(input.cbm) || 0);
  const kg = Math.max(0, Number(input.grossKg) || 0);
  const tonnes = kg / ratio;
  const rt = Math.max(cbm, tonnes);
  return {
    cbm: round2(cbm),
    tonnes: round2(tonnes),
    revenueTons: round2(rt),
    basis: cbm === tonnes ? "equal" : tonnes > cbm ? "weight" : "measure",
    ratioKgPerCbm: ratio,
  };
}
