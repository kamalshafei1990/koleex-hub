/* ---------------------------------------------------------------------------
   ai/cost/meter — what one turn consumed.

   Phase 5B. The audit scored cost controls 1.0/10 — "not measured at all" —
   and the §I table has a row reading "Tokens/cost per turn: not measured at
   all". This is the first half of closing that: measure it.

   TWO THINGS ARE DELIBERATELY SEPARATED, because conflating them is how cost
   reporting goes wrong:

     TOKENS are MEASURED. They come from the provider, or they are null. They
     are never estimated from character counts — an estimate that looks like a
     measurement is worse than a gap, because nobody re-checks a number that
     already has a value.

     COST is DERIVED, and only when a price is configured for that model. See
     cost/prices.ts for why the price table is not hard-coded. An unpriced
     model reports real tokens and a null cost, which is the honest shape and
     still supports per-user / per-tenant / per-lane attribution.

   WHERE IT GOES, and why not a table yet. The plan proposes an `ai_usage`
   table. That is a schema change, and the standing rule for this project is
   that no schema arrives without its reason, indexes, RLS, migration,
   rollback and expected load being put up for a decision first. So this stage
   emits ONE greppable line per turn, in the shape the table would take. That
   is deliberately useful on its own — it answers "what did today cost" from
   log search — and it also means the table, if it is approved, is populated
   by a writer that already has its columns proved.

   IT LOGS NUMBERS, NEVER TEXT. No prompt, no reply, no tool arguments — the
   standing rule against logging full prompts or responses in production
   applies here more than anywhere, because a cost meter is exactly the kind
   of thing that grows a "and the question was…" field for debugging.

   IT CANNOT BREAK A TURN. Every entry point swallows its own errors. A
   failure to measure must never become a failure to answer — the same
   fail-open posture as the rate limiter and the circuit breaker.
   --------------------------------------------------------------------------- */

import { costUsd } from "./prices";

export interface UsageInput {
  tenantId: string | null;
  accountId: string | null;
  /** Which lane served: canned / fast / brand / general / agent / degraded. */
  lane: string;
  /** The provider label that served, e.g. "deepseek". */
  provider: string;
  /** The concrete model id billing will be against. */
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  /** Wall-clock for the turn. */
  ms: number;
  /** Correlates with the Phase 1 request log line. */
  traceId?: string | null;
}

export interface UsageRecord extends UsageInput {
  /** UTC day, YYYY-MM-DD — the grain the plan's index is on. */
  day: string;
  costUsd: number | null;
  /** True when the provider told us nothing, so a reader can tell "zero
   *  tokens" apart from "we never found out". */
  tokensUnknown: boolean;
}

/** Pure. Exported so the shape and the arithmetic are proved without
 *  capturing console output. */
export function buildUsageRecord(input: UsageInput, now: Date = new Date()): UsageRecord {
  const tokensUnknown = input.inputTokens === null && input.outputTokens === null;
  return {
    ...input,
    day: now.toISOString().slice(0, 10),
    costUsd: costUsd(input.model, input.inputTokens, input.outputTokens),
    tokensUnknown,
  };
}

/** Render the record as one greppable line. Pure, so the "no free text" rule
 *  is assertable rather than reviewable. */
export function formatUsageLine(r: UsageRecord): string {
  const n = (v: number | null) => (v === null ? "-" : String(v));
  const cost = r.costUsd === null ? "-" : r.costUsd.toFixed(6);
  return (
    `[ai.usage] day=${r.day} tenant=${r.tenantId ?? "-"} account=${r.accountId ?? "-"}` +
    ` lane=${r.lane} provider=${r.provider} model=${r.model}` +
    ` in=${n(r.inputTokens)} out=${n(r.outputTokens)} cost_usd=${cost}` +
    ` ms=${r.ms} unknown=${r.tokensUnknown ? 1 : 0} trace=${r.traceId ?? "-"}`
  );
}

/** Record one turn. Never throws — see the header. */
export function recordUsage(input: UsageInput): void {
  try {
    console.log(formatUsageLine(buildUsageRecord(input)));
  } catch {
    /* Measuring must not be able to break the thing being measured. */
  }
}
