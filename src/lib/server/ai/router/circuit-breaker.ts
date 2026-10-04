import "server-only";

/* ---------------------------------------------------------------------------
   ai/router/circuit-breaker — stop paying the retry ladder for a provider
   that is already known to be down.

   Phase 4C. 4B shipped failover and said plainly what it did not do: the
   primary's own retry ladder in core/transport.ts (3 attempts, backoff capped
   at 8s) runs to exhaustion BEFORE the second provider is tried, so a
   rate-limited or dead primary can cost ~14s per turn — every turn, for as
   long as the outage lasts. Failover worked; it was just slow in exactly the
   situation it exists for.

   Shortening the ladder would be the wrong fix. The ladder is what absorbs
   ordinary rate limits, and removing it would turn a recoverable 429 into a
   user-visible error. The right fix is to stop STARTING the ladder against a
   provider that has already failed repeatedly. That is this file. The first
   request during an outage still pays full price; every request after it skips
   straight to the healthy provider.

   Three states, the standard ones:

     closed     normal. Failures are counted.
     open       skip this provider entirely. After openMs, one request is
                allowed through to see whether it recovered.
     half-open  that one trial request is in flight or allowed. Success closes
                the breaker; failure re-opens it for another openMs.

   FOUR DECISIONS WORTH STATING, because each is a place this could do harm:

   1. IT FAILS OPEN. Every uncertainty resolves to "allow the call". A breaker
      that wrongly blocks the only working provider is a self-inflicted
      outage — strictly worse than the latency it was added to save. This is
      the same posture as the rate limiter, and for the same reason.

   2. IT NEVER BLOCKS THE LAST DOOR. If every candidate is open, the caller is
      told to ignore the breaker and try them in preference order anyway. An
      outage that trips both providers must degrade to "slow", never to "the
      assistant is down while a healthy provider sits behind an open breaker".

   3. ONLY PROVIDER-HEALTH FAILURES COUNT. A 400 means WE sent something
      malformed; tripping the breaker on it would take a healthy provider out
      of service because of a bug in our own request. The caller decides which
      statuses count, using the same table that decides failover.

   4. THE STATE IS PER-INSTANCE AND EPHEMERAL. This is a Vercel serverless
      deployment: there is no durable RAM and no shared memory between
      instances, so a warm instance learns a provider is down and a cold one
      starts over. That is a real limitation, not an oversight — it is why the
      plan put shared health state behind "optional Redis later". The value
      here is still real, because Fluid Compute reuses warm instances across
      many requests, which is where the repeated 14s cost was being paid. What
      it is NOT is a cluster-wide health view, and it must not be described as
      one.

   Time is injected. A breaker tested with real sleeps is a slow test that
   everyone eventually skips.
   --------------------------------------------------------------------------- */

export type BreakerState = "closed" | "open" | "half-open";

export interface BreakerOptions {
  /** Consecutive health failures before the breaker opens. */
  failureThreshold: number;
  /** How long it stays open before allowing one trial request. */
  openMs: number;
  now: () => number;
}

const DEFAULTS: BreakerOptions = {
  /* Three, not one. A single 503 is often a blip, and opening on it would swap
     providers for a hiccup — which costs the label churn and, once a real
     second provider exists, a model change mid-conversation. */
  failureThreshold: 3,
  /* 30s. Long enough that a struggling provider is not hammered, short enough
     that recovery is noticed within a conversation rather than after it. */
  openMs: 30_000,
  now: () => Date.now(),
};

interface Entry {
  consecutiveFailures: number;
  /** When the breaker opened. null means it is not open. */
  openedAt: number | null;
  /** A trial request has been handed out and not yet resolved. */
  trialOut: boolean;
}

export interface Breaker {
  /** May this provider be tried right now? PURE — asking must not consume
   *  anything. An earlier version folded the half-open trial slot into this
   *  call, which meant filtering the candidate list spent the trial on
   *  providers that were then never contacted (the first candidate succeeded,
   *  and the second silently burned its one chance to prove it had
   *  recovered). Asking and taking are separate now. */
  allow(name: string): boolean;
  /** Take the half-open trial slot. Called immediately before the attempt, in
   *  the same synchronous step as allow(), so no second request can slip
   *  between the two. */
  beginAttempt(name: string): void;
  recordSuccess(name: string): void;
  recordFailure(name: string): void;
  stateOf(name: string): BreakerState;
  /** For logging and tests. Never contains a key or any request content. */
  snapshot(): Record<string, { state: BreakerState; consecutiveFailures: number }>;
}

export function createBreaker(opts: Partial<BreakerOptions> = {}): Breaker {
  const cfg: BreakerOptions = { ...DEFAULTS, ...opts };
  const entries = new Map<string, Entry>();

  const entry = (name: string): Entry => {
    let e = entries.get(name);
    if (!e) {
      e = { consecutiveFailures: 0, openedAt: null, trialOut: false };
      entries.set(name, e);
    }
    return e;
  };

  const stateOf = (name: string): BreakerState => {
    const e = entries.get(name);
    if (!e || e.openedAt === null) return "closed";
    if (cfg.now() - e.openedAt >= cfg.openMs) return "half-open";
    return "open";
  };

  return {
    allow(name) {
      const s = stateOf(name);
      if (s === "closed") return true;
      if (s === "open") return false;
      /* half-open: exactly one trial in flight at a time, so a burst of
         concurrent requests does not all pay the retry ladder against a
         provider that is only being probed. */
      return !entry(name).trialOut;
    },

    beginAttempt(name) {
      if (stateOf(name) === "half-open") entry(name).trialOut = true;
    },

    recordSuccess(name) {
      const e = entry(name);
      e.consecutiveFailures = 0;
      e.openedAt = null;
      e.trialOut = false;
    },

    recordFailure(name) {
      const e = entry(name);
      e.trialOut = false;
      /* A failure while half-open re-opens immediately: the trial WAS the
         evidence, so waiting for the threshold again would hand out one slow
         request every openMs for the whole outage. */
      if (e.openedAt !== null) {
        e.openedAt = cfg.now();
        return;
      }
      e.consecutiveFailures += 1;
      if (e.consecutiveFailures >= cfg.failureThreshold) {
        e.openedAt = cfg.now();
      }
    },

    stateOf,

    snapshot() {
      const out: Record<string, { state: BreakerState; consecutiveFailures: number }> = {};
      for (const [name, e] of entries) {
        out[name] = { state: stateOf(name), consecutiveFailures: e.consecutiveFailures };
      }
      return out;
    },
  };
}

/** Decision 2, as a function rather than a comment: given the candidates in
 *  preference order, which may actually be tried?
 *
 *  Returns the allowed ones — or, when the breaker would block EVERY
 *  candidate, all of them unchanged. A breaker that can empty the candidate
 *  list is a breaker that can take the product down on its own. */
export function admissible<T extends { name: string }>(
  candidates: ReadonlyArray<T>,
  breaker: Breaker,
): { tryThese: T[]; allBlocked: boolean } {
  /* allow() is pure, so filtering here costs nothing and consumes nothing. */
  const allowed = candidates.filter((c) => breaker.allow(c.name));
  if (allowed.length > 0) return { tryThese: allowed, allBlocked: false };
  return { tryThese: [...candidates], allBlocked: true };
}

/** The process-wide breaker. Module scope, so it survives between requests on
 *  a warm instance — which is the entire point — and dies with the instance,
 *  which is the documented limitation. */
export const providerBreaker = createBreaker();
