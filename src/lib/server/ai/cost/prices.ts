/* ---------------------------------------------------------------------------
   ai/cost/prices — what a thousand tokens costs, per model.

   Phase 5B. No `server-only`: it is a parser and a lookup, and the suite
   imports it directly.

   THESE ARE NOT HARD-CODED, and the reason is the same one that kept the
   fallback endpoint out of the adapter in 4B: this environment cannot reach
   any provider's pricing page, so a table written here would be written from
   memory. A wrong price does not fail loudly — it produces a plausible number
   on a cost report that somebody then budgets against. A missing price is
   visibly missing; a wrong one is not.

   So prices are one environment variable, JSON, in USD per 1 000 tokens:

     AI_MODEL_PRICES={"deepseek-chat":{"in":0.00027,"out":0.0011}}

   Keyed by MODEL id rather than provider, because that is the granularity
   billing actually has — a provider serving three models charges three
   different rates.

   WITHOUT IT, TOKENS ARE STILL RECORDED. The meter separates "how many
   tokens" from "what they cost": the first is measured, the second is
   configured. An unpriced model reports real token counts and a null cost,
   which is the honest shape — and still answers most of what the plan's
   acceptance asks for, since attribution per user/tenant/lane/day works on
   token counts alone.
   --------------------------------------------------------------------------- */

export interface ModelPrice {
  /** USD per 1 000 input tokens. */
  in: number;
  /** USD per 1 000 output tokens. */
  out: number;
}

export type PriceTable = Record<string, ModelPrice>;

function isFiniteNonNegative(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** Parse the price table. Exported so the rejection paths are proved
 *  directly. Every one of them drops the entry rather than coercing it — a
 *  price of NaN or "0.001" silently becomes a wrong number downstream, and a
 *  wrong cost is the failure this whole file is arranged to avoid. */
export function parsePriceTable(raw: string | undefined): PriceTable {
  if (!raw || !raw.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  const out: PriceTable = {};
  for (const [model, price] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof price !== "object" || price === null || Array.isArray(price)) continue;
    const p = price as { in?: unknown; out?: unknown };
    if (!isFiniteNonNegative(p.in) || !isFiniteNonNegative(p.out)) continue;
    if (!model.trim()) continue;
    out[model.trim()] = { in: p.in, out: p.out };
  }
  return out;
}

const PRICES = parsePriceTable(process.env.AI_MODEL_PRICES);

/** The price for a model, or null when none is configured. */
export function priceFor(model: string, table: PriceTable = PRICES): ModelPrice | null {
  return table[model] ?? null;
}

/** Cost in USD, or null when the model has no configured price or the token
 *  counts are unknown. Never a zero standing in for "we don't know" — zero is
 *  a real and different answer. */
export function costUsd(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
  table: PriceTable = PRICES,
): number | null {
  const p = priceFor(model, table);
  if (!p) return null;
  if (inputTokens === null && outputTokens === null) return null;
  return ((inputTokens ?? 0) / 1000) * p.in + ((outputTokens ?? 0) / 1000) * p.out;
}
