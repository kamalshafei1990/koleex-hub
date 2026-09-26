import "server-only";

/* ---------------------------------------------------------------------------
   ai/provider/types — what a provider must be able to do.

   Phase 3B. Deliberately shaped around what the AGENT LOOP actually needs,
   not around what any one vendor's SDK offers:

     · a turn may or may not carry tools
     · a turn may or may not stream
     · a FAILED turn must hand back the status and the body text, because the
       loop's rescue path reads both to decide between a retry, a friendly
       hand-back, and a hard error. An adapter that threw on failure, or
       flattened every failure to null, would delete behaviour that exists
       because of real incidents.

   So the result is a discriminated outcome rather than a nullable response:
   the caller cannot forget to handle the failure branch.

   The adapter owns PARSING. Before 3B the loop parsed the provider's JSON
   itself at two of the three call sites, which is why "support a second
   provider" meant editing the loop. Moving the parse here is the change that
   makes the loop vendor-neutral; a differential test pins the parsed result
   against what the loop used to produce.
   --------------------------------------------------------------------------- */

import type { TurnRequest, TurnResponse } from "./turn-ir";

/** Which adapter actually handled the turn, and what it cost.
 *
 *  Phase 5B. Filled in by the registry, not by the adapters — only the
 *  registry knows which one ended up serving after a failover. It closes two
 *  gaps at once, which is why they are one field set:
 *
 *    · the `provider` label on an AgentResponse came from
 *      activeProviderLabel(), i.e. the FIRST CONFIGURED adapter, which
 *      misreported every failover turn. That label is what the audit trail
 *      records, so it was wrong exactly when it mattered most.
 *    · the cost meter needs to attribute tokens to the model that billed
 *      them, and after a failover that is not the model the registry would
 *      have picked.
 *
 *  Optional on both branches because a failure before any adapter ran has no
 *  server to name. */
export interface TurnMeta {
  /** The adapter that handled it, e.g. "deepseek". */
  servedBy?: string;
  /** The concrete model id it used — the granularity billing has. */
  model?: string;
  /** Wall-clock across every attempt, including a failover. */
  ms?: number;
  /** True when an earlier adapter failed and a later one was tried. */
  failedOver?: boolean;
}

export type TurnOutcome =
  | ({ ok: true; response: TurnResponse } & TurnMeta)
  /** status is the HTTP status where there was one, or a synthesised 5xx for
   *  a socket that died before any byte arrived. bodyText is whatever the
   *  provider said — never shown to a user, but the loop logs it and the
   *  rescue path branches on it. */
  | ({ ok: false; status: number; bodyText: string } & TurnMeta);

export interface ProviderAdapter {
  /** Stable identifier used in the `provider` field of an AgentResponse and
   *  in logs. Never shown to a user — AI_PROVENANCE_RULE forbids naming a
   *  provider in prompt text, and this string is not prompt text. */
  readonly name: string;

  /** Is a key configured for this provider right now? */
  configured(): boolean;

  /** The model id this adapter will use, for the provider label. */
  model(): string;

  /** One turn. `onDelta` present means stream the answer tokens; the adapter
   *  is responsible for reassembling fragmented tool calls before returning. */
  chat(req: TurnRequest, opts?: { onDelta?: (t: string) => void }): Promise<TurnOutcome>;
}
