/* ---------------------------------------------------------------------------
   Shipping — how much to trust a rate.

   Confidence here is ARITHMETIC, not judgement. Every point is earned by a
   fact that is present or absent in the data, the weights are constants you
   can read, and the function hands back the reasons so the screen can show an
   operator exactly why a number scored what it scored. No model, no heuristic
   "feel", and nothing an AI decides.

   That matters because the alternative is worse than no badge at all: a
   confident-looking label on a guess is how someone quotes a customer a price
   that does not exist.

   ── The scale ─────────────────────────────────────────────────────────────
     100  everything known: fresh, exact lane, exact equipment, still valid,
          surcharges itemised, more than one source agreeing
      ≥75 high     — quote it, state the validity
      ≥45 medium   — usable as a working figure, check before committing
      < 45 low     — indicative only
   A rate with no amount has no confidence at all: it is an absence, not a
   low-quality presence, and it returns null.
   --------------------------------------------------------------------------- */

import type { ConfidenceLevel, ConfidenceReason, FreightRate, RateKind, RateQuery } from "./types";

/* ⚠️ A REASON IS A CODE, NOT A SENTENCE.
   These strings used to be English prose assembled here — "retrieved today",
   "valid to 2026-09-29", "2 surcharges itemised". They are rendered in the one
   panel that explains WHY a price scored what it scored, which is the last
   place an Arabic or Chinese operator should meet untranslated English; and
   the raw ISO date broke the Hub's standing D/M/Y rule the moment a rate
   finally drew on screen. So the scorer emits a CODE plus its slots, and the
   screen owns both the wording and the date format. The arithmetic below is
   untouched — this changes what the reasons are called, never what they cost. */
const reason = (code: ConfidenceReason["code"], slots: Omit<ConfidenceReason, "code"> = {}): ConfidenceReason =>
  ({ code, ...slots });

/* ── weights ────────────────────────────────────────────────────────────────
   They sum to 100. Change one and the others still mean what they say. */
export const WEIGHTS = {
  /** How old our copy is. The single biggest factor — freight moves weekly. */
  freshness: 28,
  /** Is the carrier's own validity window still open? */
  validity: 18,
  /** Did we price the lane asked for, or a neighbouring port? */
  routeMatch: 16,
  /** Did we price the equipment asked for? */
  equipmentMatch: 10,
  /** Are the surcharges itemised, or is the freight figure naked? */
  surchargesKnown: 12,
  /** Does more than one independent source say roughly the same thing? */
  corroboration: 10,
  /** How the source itself rates — a live provider beats a recovered history. */
  sourceClass: 6,
} as const;

/** Ceiling per kind. A market band can never read as "high confidence". */
export const KIND_CEILING: Record<RateKind, number> = {
  provider: 100,
  forwarder: 100,
  koleex: 70,   // real money, but on a past date
  market: 55,   // a band, never a quotation
};

/** Base credit for what the source IS. */
const SOURCE_CLASS: Record<RateKind, number> = {
  forwarder: 1, provider: 0.9, koleex: 0.55, market: 0.35,
};

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const DAY = 86_400_000;

/** Age in days, or null when the timestamp is unusable. */
export function ageDays(iso: string | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (now - t) / DAY;
}

/**
 * Freshness credit. Full marks for the same day, nothing left after 30.
 * Deliberately steep in the first week: an ocean rate a fortnight old has
 * usually been superseded by a GRI.
 */
export function freshnessFactor(days: number | null): number {
  if (days == null) return 0;
  if (days <= 1) return 1;
  if (days >= 30) return 0;
  return clamp01(1 - Math.log10(days) / Math.log10(30));
}

export interface ConfidenceInput {
  rate: FreightRate;
  query?: RateQuery;
  /** Other rates for the same lane, used only for the corroboration term. */
  peers?: FreightRate[];
  now?: number;
}

export interface ConfidenceVerdict {
  score: number;
  level: ConfidenceLevel;
  /** One short sentence per factor, positive or negative. Shown on demand. */
  reasons: ConfidenceReason[];
  /** The raw 0-1 factors, for tests and for the diagnostics panel. */
  factors: Record<keyof typeof WEIGHTS, number>;
  cappedByKind: boolean;
}

export function scoreConfidence({ rate, query, peers = [], now = Date.now() }: ConfidenceInput): ConfidenceVerdict | null {
  /* No number means no verdict. "Rate unavailable" is its own state. */
  if (rate.amount == null && rate.amountLow == null) return null;

  const reasons: ConfidenceReason[] = [];
  const f = {} as Record<keyof typeof WEIGHTS, number>;

  /* freshness */
  const age = ageDays(rate.retrievedAt, now);
  f.freshness = freshnessFactor(age);
  if (age == null) reasons.push(reason("noRetrievalTime"));
  else if (age <= 1) reasons.push(reason("retrievedToday"));
  else if (age <= 7) reasons.push(reason("daysOld", { n: Math.round(age) }));
  else reasons.push(reason("daysOldStale", { n: Math.round(age) }));

  /* validity */
  if (rate.validUntil) {
    const end = Date.parse(rate.validUntil);
    if (Number.isFinite(end)) {
      if (end >= now) {
        const left = (end - now) / DAY;
        f.validity = left >= 7 ? 1 : 0.6 + 0.4 * clamp01(left / 7);
        reasons.push(reason("validTo", { date: rate.validUntil }));
      } else {
        f.validity = 0;
        reasons.push(reason("validityExpired", { date: rate.validUntil }));
      }
    } else f.validity = 0.3;
  } else {
    /* The source did not state a validity. That is not the same as expired,
       but it is not a commitment either. */
    f.validity = 0.4;
    reasons.push(reason("noValidity"));
  }

  /* route match */
  if (!query) f.routeMatch = 0.8;
  else if (rate.originCode === query.originCode && rate.destinationCode === query.destinationCode) {
    f.routeMatch = 1;
    reasons.push(reason("exactLane"));
  } else {
    f.routeMatch = 0;
    reasons.push(reason("otherLane", { text: `${rate.originCode}→${rate.destinationCode}` }));
  }

  /* equipment match */
  if (rate.mode !== "ocean_fcl") f.equipmentMatch = 1;
  else if (!query?.equipment?.length) f.equipmentMatch = rate.equipment ? 1 : 0.4;
  else if (rate.equipment && query.equipment.includes(rate.equipment)) f.equipmentMatch = 1;
  else { f.equipmentMatch = 0; reasons.push(reason("equipmentMismatch")); }

  /* surcharges */
  if (rate.surcharges.length > 0) {
    f.surchargesKnown = 1;
    reasons.push(reason(rate.surcharges.length === 1 ? "surchargeItemised" : "surchargesItemised", { n: rate.surcharges.length }));
  } else if (rate.includesDestinationCharges != null || rate.includesOriginCharges != null) {
    f.surchargesKnown = 0.6;
    reasons.push(reason("inclusionsOnly"));
  } else {
    f.surchargesKnown = 0;
    reasons.push(reason("freightOnly"));
  }

  /* corroboration: an independent source, on the same lane, comparable scope */
  const others = peers.filter(
    (p) => p !== rate && p.sourceId !== rate.sourceId &&
      p.originCode === rate.originCode && p.destinationCode === rate.destinationCode &&
      p.mode === rate.mode && p.equipment === rate.equipment && p.scope === rate.scope,
  );
  const mine = rate.amount ?? midpoint(rate);
  const agreeing = others.filter((p) => {
    const theirs = p.amount ?? midpoint(p);
    if (mine == null || theirs == null || p.currency !== rate.currency) return false;
    return Math.abs(theirs - mine) / Math.max(mine, 1) <= 0.15;   // within 15%
  });
  if (!others.length) { f.corroboration = 0.35; reasons.push(reason("singleSource")); }
  else if (agreeing.length) {
    f.corroboration = Math.min(1, 0.6 + 0.2 * agreeing.length);
    reasons.push(reason(agreeing.length === 1 ? "corroboratedOne" : "corroborated", { n: agreeing.length }));
  } else { f.corroboration = 0.15; reasons.push(reason("sourcesDisagree")); }

  /* what the source is */
  f.sourceClass = SOURCE_CLASS[rate.kind];
  if (rate.sourceCadence === "daily") reasons.push(reason("dailyCadence"));
  if (rate.kind === "market") reasons.push(reason("marketBand"));
  if (rate.kind === "koleex") reasons.push(reason("koleexPast"));

  let score = 0;
  for (const k of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) score += WEIGHTS[k] * f[k];
  score = Math.round(score);

  const ceiling = KIND_CEILING[rate.kind];
  const cappedByKind = score > ceiling;
  if (cappedByKind) score = ceiling;

  return { score, level: levelFor(score), reasons, factors: f, cappedByKind };
}

export function levelFor(score: number): ConfidenceLevel {
  return score >= 75 ? "high" : score >= 45 ? "medium" : "low";
}

function midpoint(r: FreightRate): number | null {
  if (r.amount != null) return r.amount;
  if (r.amountLow != null && r.amountHigh != null) return (r.amountLow + r.amountHigh) / 2;
  return r.amountLow ?? r.amountHigh ?? null;
}

/** Applies the verdict onto a rate, in place, and returns it. */
export function withConfidence(rate: FreightRate, query?: RateQuery, peers: FreightRate[] = []): FreightRate {
  const v = scoreConfidence({ rate, query, peers });
  if (!v) return rate;
  rate.confidence = v.level;
  rate.confidenceScore = v.score;
  rate.confidenceReasons = v.reasons;
  return rate;
}
