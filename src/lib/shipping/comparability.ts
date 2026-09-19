/* ---------------------------------------------------------------------------
   Shipping — when two rates may be put side by side, and when they may not.

   This module exists to say NO. Freight prices are only comparable when they
   describe the same product, and the ways they quietly do not are the ways a
   buyer gets misled:

     · port-to-port beside door-to-door — the second is not "more expensive",
       it is a different job
     · a figure that includes destination charges beside one that does not —
       at Alexandria that gap is most of the difference
     · 40GP beside 40HQ — same money, more cubic metres
     · USD beside CNY — obvious, and still the easiest mistake to ship
     · an LCL per-CBM rate beside an LCL all-in — one of them has a minimum
       charge hiding under it

   So nothing here averages anything. `compare()` returns groups of genuinely
   equivalent rates plus an explicit list of what it refused to group and why,
   and the UI shows that refusal rather than hiding it.
   --------------------------------------------------------------------------- */

import type { FreightRate, RateKind } from "./types";

/** The fields that must agree before two rates are alternatives. */
export interface ComparisonKey {
  mode: string;
  originCode: string;
  destinationCode: string;
  equipment: string;
  unit: string;
  currency: string;
  scope: string;
  inclusions: string;
}

/** undefined ("the source did not say") is its own bucket, never folded into false. */
const flag = (v: boolean | undefined) => (v === undefined ? "?" : v ? "y" : "n");

export function comparisonKey(r: FreightRate): ComparisonKey {
  return {
    mode: r.mode,
    originCode: r.originCode,
    destinationCode: r.destinationCode,
    equipment: r.equipment ?? "-",
    unit: r.unit,
    currency: r.currency,
    scope: r.scope,
    inclusions: `${flag(r.includesOriginCharges)}${flag(r.includesDestinationCharges)}${flag(r.includesCustoms)}`,
  };
}

export const keyString = (k: ComparisonKey) =>
  [k.mode, k.originCode, k.destinationCode, k.equipment, k.unit, k.currency, k.scope, k.inclusions].join("|");

/** True when the two rates describe the same product. */
export function areComparable(a: FreightRate, b: FreightRate): boolean {
  return keyString(comparisonKey(a)) === keyString(comparisonKey(b));
}

/** Why a pair is not comparable, in words an operator can act on. */
export function differences(a: FreightRate, b: FreightRate): string[] {
  const out: string[] = [];
  const ka = comparisonKey(a), kb = comparisonKey(b);
  if (ka.mode !== kb.mode) out.push("different shipping mode");
  if (ka.originCode !== kb.originCode || ka.destinationCode !== kb.destinationCode) out.push("different lane");
  if (ka.equipment !== kb.equipment) out.push("different container type");
  if (ka.unit !== kb.unit) out.push("priced per a different unit");
  if (ka.currency !== kb.currency) out.push("different currency");
  if (ka.scope !== kb.scope) out.push("different service scope");
  if (ka.inclusions !== kb.inclusions) out.push("different charges included");
  return out;
}

export interface ComparisonGroup {
  key: ComparisonKey;
  /** Every rate in the group is genuinely an alternative to the others. */
  rates: FreightRate[];
  /** Kept apart INSIDE the group too — a market band is not a quotation. */
  byKind: Record<RateKind, FreightRate[]>;
  /** Cheapest bookable-shaped rate, when the group has one. Never across kinds. */
  best?: { rate: FreightRate; amount: number };
  /** Spread across the group, when at least two rates carry a number. */
  spread?: { low: number; high: number; currency: string };
}

const EMPTY_BY_KIND = (): Record<RateKind, FreightRate[]> =>
  ({ provider: [], market: [], koleex: [], forwarder: [] });

/**
 * Groups rates into sets that may legitimately be compared.
 *
 * `best` is chosen only among provider and forwarder rates — the two kinds
 * that represent a price someone will actually honour. A Koleex historical
 * figure or a market band can be cheaper on paper and cannot be bought, so
 * naming either "best" would be the exact misdirection this module prevents.
 */
export function compare(rates: FreightRate[]): {
  groups: ComparisonGroup[];
  /** Pairs the engine refused to group, with the reason. For the UI's note. */
  refusals: { a: string; b: string; reasons: string[] }[];
} {
  const groups = new Map<string, ComparisonGroup>();
  for (const r of rates) {
    const key = comparisonKey(r);
    const ks = keyString(key);
    let g = groups.get(ks);
    if (!g) { g = { key, rates: [], byKind: EMPTY_BY_KIND() }; groups.set(ks, g); }
    g.rates.push(r);
    g.byKind[r.kind].push(r);
  }

  for (const g of groups.values()) {
    const bookable = [...g.byKind.provider, ...g.byKind.forwarder]
      .filter((r): r is FreightRate & { amount: number } => r.amount != null);
    if (bookable.length) {
      const cheapest = bookable.reduce((m, r) => (r.amount < m.amount ? r : m));
      g.best = { rate: cheapest, amount: cheapest.amount };
    }
    const nums = g.rates.map((r) => r.amount).filter((n): n is number => n != null);
    if (nums.length >= 2) {
      g.spread = { low: Math.min(...nums), high: Math.max(...nums), currency: g.key.currency };
    }
  }

  /* Report the first refusal per distinct reason set — enough for the UI to
     say "these two are not alternatives", without an N² wall of text. */
  const list = [...groups.values()];
  const refusals: { a: string; b: string; reasons: string[] }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i].rates[0], b = list[j].rates[0];
      const reasons = differences(a, b);
      if (!reasons.length) continue;
      const sig = reasons.join(",");
      if (seen.has(sig)) continue;
      seen.add(sig);
      refusals.push({ a: label(a), b: label(b), reasons });
    }
  }
  return { groups: list, refusals };
}

function label(r: FreightRate): string {
  const bits = [r.sourceLabel, r.equipment, r.scope.replace(/_/g, "-")].filter(Boolean);
  return bits.join(" · ");
}

/**
 * The all-in figure, when every piece is known. Returns null the moment one
 * is not — a "total" that quietly omits an unknown surcharge is worse than no
 * total, because it will be pasted into a quotation.
 */
export function allInTotal(r: FreightRate, quantity = 1): { amount: number; currency: string } | null {
  if (r.amount == null) return null;
  let total = r.amount * (r.unit === "shipment" ? 1 : quantity);
  if (r.minCharge != null && total < r.minCharge) total = r.minCharge;
  for (const s of r.surcharges) {
    if (s.currency !== r.currency) return null;      // no silent FX inside a total
    total += s.amount * (s.per === "shipment" ? 1 : quantity);
  }
  return { amount: Math.round(total * 100) / 100, currency: r.currency };
}
