/* ===========================================================================
   FX adapter — Phase S.3 single source of truth.

   Two engines used to carry their own copy of the FX table:
     · src/lib/intelligence/treasury.ts          (Phase 2.4)
     · src/lib/intelligence/treasury-forecast.ts (Phase 2.8)

   The values were identical today, but drift was inevitable. This
   module is now the canonical source for:

     · the reporting currency
     · the static FX table
     · `toReporting(amount, currency)` translation
     · `movementToReporting(movement)` — respects an operator-supplied
        `reporting_amount` on a cash movement when present

   Pure functions; no DB, no React, no fetch. The static table is a
   deterministic placeholder; future phases swap it for a live rate
   feed without touching engine callers.
   ========================================================================== */

import type { CashMovement } from "./types";

export const REPORTING_CURRENCY = "USD";

/** Deterministic FX table. Values approximate real cross rates and
 *  ship identically across every engine that reads from this module. */
export const FX_TABLE: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.26,
  CNY: 0.139,
  EGP: 0.020,
};

/** Look up a native → reporting rate. Falls back to 1.0 for unknown
 *  currencies so an exotic code doesn't silently become zero. */
export function fxRate(currency: string): number {
  return FX_TABLE[currency] ?? 1.0;
}

/** Translate a native amount into the reporting currency. */
export function toReporting(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) return 0;
  return amount * fxRate(currency);
}

/** Translate a CashMovement to reporting currency, respecting the
 *  operator-supplied `reporting_amount` when present.

 *  Operators can override the FX leg per movement (e.g. an importer
 *  who knows the cleared FX rate for a specific wire). When both
 *  `reporting_amount` and `exchange_rate` are set, `reporting_amount`
 *  wins because it's the closer-to-source-of-truth value. */
export function movementToReporting(movement: CashMovement): number {
  if (movement.reporting_amount != null && Number.isFinite(Number(movement.reporting_amount))) {
    return Number(movement.reporting_amount);
  }
  if (movement.exchange_rate != null && Number.isFinite(Number(movement.exchange_rate))) {
    return Number(movement.amount) * Number(movement.exchange_rate);
  }
  return toReporting(Number(movement.amount), movement.currency);
}
