import "server-only";

/* ---------------------------------------------------------------------------
   ai/provider/registry — which provider serves this turn, and what happens
   when it cannot.

   Phase 3B made this "the first adapter with a key wins". Phase 4B adds the
   thing router.ts has been stating as a known risk in a comment for months:

       "WORTH KNOWING: this leaves no automatic failover. If DeepSeek is down,
        Koleex AI is down."

   The registry is ordered by preference. DeepSeek is first deliberately and
   for a reason that is not preference — it is the China-accessible provider,
   and mainland China working without a VPN is a stated architectural
   requirement. An adapter added ABOVE it would silently change that; the order
   is a decision, not an accident.

   FAILOVER IS INERT UNTIL A SECOND PROVIDER IS CONFIGURED. With only DeepSeek
   holding a key there is exactly one candidate and the loop below is
   byte-for-byte today's behaviour. That is why this ships without a staged
   rollout: the configuration IS the rollout. `AI_MODEL_ROUTER=off` remains as
   a kill-switch for an operator who wants the old single-provider path back
   while a second key is set. (The plan proposed this flag default-OFF; it is
   default-ON because a default-off flag on an already-inert code path would
   mean the feature is disabled twice and enabled by nobody.)

   TWO RULES IN THE LOOP ARE LOAD-BEARING, and both exist because getting them
   wrong is worse than having no failover at all:

     1. NEVER fail over once a delta has been emitted. Streaming puts tokens on
        the user's screen as they arrive; a second attempt would append a whole
        second answer to a half-written one. The transport already refuses to
        retry mid-stream for this reason — this is the same rule one level up.

     2. NEVER fail over on a failure the next provider would also return. A 400
        means the REQUEST is malformed; retrying it elsewhere buys a second
        identical failure and doubles the user's wait. Only "this provider
        cannot serve" is worth a second door.

   ON SPEED (Phase 4C). 4B shipped failover and recorded that it was slow: the
   primary's own retry ladder in core/transport.ts (3 attempts, 8s cap) runs to
   exhaustion BEFORE the second provider is tried, so a dead primary cost ~14s
   on EVERY turn for the length of the outage. The circuit breaker in
   router/circuit-breaker.ts fixes the repetition, not the first occurrence:
   after `failureThreshold` health failures the primary is skipped outright, so
   the ladder never starts. The first request of an outage still pays full
   price; every one after it goes straight to the healthy provider.

   Two properties of that breaker are what make it safe to put in front of the
   only door: it FAILS OPEN, and it can never block the last provider — if
   every candidate is broken, all of them are tried anyway, in preference
   order. A breaker that can empty the candidate list is a breaker that can
   take the product down by itself.

   The breaker state is per-instance and dies with the instance; on serverless
   that means a warm instance learns and a cold one starts over. Real
   limitation, deliberately accepted here (the plan puts shared health state
   behind "optional Redis later"), and it must not be described as a
   cluster-wide health view.
   --------------------------------------------------------------------------- */

import { deepseekAdapter } from "./adapters/deepseek";
import { openAiCompatibleAdapter } from "./adapters/openai-compatible";
import type { ProviderAdapter, TurnOutcome } from "./types";
import type { TurnRequest } from "./turn-ir";
import { providerBreaker, admissible, type Breaker } from "@/lib/server/ai/router/circuit-breaker";

/* Ordered by preference. See the header on why DeepSeek is first. */
const REGISTRY: ProviderAdapter[] = [deepseekAdapter, openAiCompatibleAdapter];

/** Pure selection, over any list. Exported so the rule — first CONFIGURED
 *  adapter wins, order is preference — can be tested with fakes rather than
 *  only with whatever happens to have a key in this environment. */
export function pickAdapter(adapters: ReadonlyArray<ProviderAdapter>): ProviderAdapter | null {
  return adapters.find((a) => a.configured()) ?? null;
}

/** Every adapter that could serve, in preference order. */
export function configuredAdapters(adapters: ReadonlyArray<ProviderAdapter> = REGISTRY): ProviderAdapter[] {
  return adapters.filter((a) => a.configured());
}

/** The adapter that will serve a turn right now, or null if none is
 *  configured. Exported so the degraded lane can ask before committing. */
export function selectAdapter(): ProviderAdapter | null {
  return pickAdapter(REGISTRY);
}

export function providerConfigured(): boolean {
  return selectAdapter() !== null;
}

/** Is this failure one that a DIFFERENT provider might not return?
 *
 *  Pure, and exported, because it is the whole of the failover policy and a
 *  table of statuses is far easier to check than a branch inside a loop.
 *
 *    5xx        the provider is broken or overloaded          → try the next
 *    429        the provider is rate-limiting US              → try the next
 *    401 / 403  our credential for THIS provider is bad       → try the next
 *    404        this provider's endpoint is wrong             → try the next
 *    4xx other  the REQUEST is bad (400, 413, 422, …)         → stop
 *
 *  The last line is the important one. Those failures are a property of what
 *  we sent, not of who we sent it to, so a second attempt is a second failure
 *  plus the latency of getting there. */
export function shouldTryNextProvider(status: number): boolean {
  if (status >= 500) return true;
  return status === 429 || status === 401 || status === 403 || status === 404;
}

function failoverEnabled(): boolean {
  return process.env.AI_MODEL_ROUTER !== "off";
}

/** The one door to a model.
 *
 *  Exported with an injectable adapter list so the failover RULES can be
 *  proved with fakes — forcing a real provider to return 503 on demand is not
 *  something a static suite can do, and a rule this consequential should not
 *  rest on reading the loop and believing it. */
export async function chatWithToolsVia(
  adapters: ReadonlyArray<ProviderAdapter>,
  req: TurnRequest,
  opts?: { onDelta?: (t: string) => void; failover?: boolean; breaker?: Breaker },
): Promise<TurnOutcome> {
  const breaker = opts?.breaker ?? providerBreaker;
  const candidates = configuredAdapters(adapters);
  if (candidates.length === 0) {
    return { ok: false, status: 503, bodyText: "no AI provider configured" };
  }

  /* Rule 1. Wrapping onDelta is how we KNOW whether anything reached the user,
     rather than assuming it from `stream: true`. A streaming turn that failed
     before its first token is safe to retry; one that failed after is not. */
  let emitted = false;
  const onDelta = opts?.onDelta;
  const wrapped = onDelta
    ? (t: string) => {
        emitted = true;
        onDelta(t);
      }
    : undefined;
  const callOpts = wrapped ? { onDelta: wrapped } : undefined;

  const allowFailover = opts?.failover ?? failoverEnabled();

  /* The breaker filters the candidate list; `allBlocked` means every provider
     is currently considered down, in which case we try them all anyway rather
     than reporting an outage we could have served through. */
  const { tryThese } = admissible(candidates, breaker);

  let last: TurnOutcome = { ok: false, status: 503, bodyText: "no provider attempted" };
  for (const adapter of tryThese) {
    breaker.beginAttempt(adapter.name);
    last = await adapter.chat(req, callOpts);

    if (last.ok) {
      breaker.recordSuccess(adapter.name);
      return last;
    }

    /* Only PROVIDER-health failures count against a provider. A 400 is our
       malformed request; counting it would take a healthy provider out of
       service because of a bug on our side. Same table as failover, on
       purpose — "worth a second door" and "counts against this provider" are
       the same question asked twice. */
    const providerFault = shouldTryNextProvider(last.status);
    if (providerFault) breaker.recordFailure(adapter.name);

    if (!allowFailover) break;
    if (emitted) break;
    if (!providerFault) break;
  }
  return last;
}

/** The one door, over the live registry. */
export async function chatWithTools(
  req: TurnRequest,
  opts?: { onDelta?: (t: string) => void },
): Promise<TurnOutcome> {
  return chatWithToolsVia(REGISTRY, req, opts);
}

/** The `provider` string reported on an AgentResponse, e.g. "deepseek:deepseek-chat".
 *
 *  NOTE the limitation, since the label is what the audit trail records: this
 *  reports the adapter that would be selected FIRST, not necessarily the one
 *  that ended up serving after a failover. Making it exact means returning the
 *  serving adapter out of chatWithTools and threading it back to every call
 *  site — a change to the loop's shape, which belongs with the router work
 *  rather than smuggled into the registry. Recorded so the next reader does not
 *  mistake it for accuracy it does not have. */
export function activeProviderLabel(): string {
  const a = selectAdapter();
  return a ? `${a.name}:${a.model()}` : "none";
}
