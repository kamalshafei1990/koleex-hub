import "server-only";

/* ---------------------------------------------------------------------------
   ai/router/auto-rank — Auto that learns (Koleex models 4/4, step 2).

   Auto used to walk the registry in a fixed order: Mind, then Blink, then
   Deep. The circuit breaker already skips a provider after three health
   failures in a row; this adds the two things the breaker cannot see:

     1. A RECENT FAILURE. One provider fault in the last two minutes moves
        that model behind the healthy ones — the next user should not be the
        one who finds out whether it has recovered. It is still in the list
        (last), so failover can reach it, and it moves back on its own once
        the two minutes pass or it answers again.

     2. CHRONIC SLOWNESS. A model whose recent answers start more than twice
        as slowly as another healthy model's — measured to the FIRST word
        when streaming, so a long answer is not mistaken for a slow model —
        moves behind the faster one. Only on real evidence: at least
        MIN_SAMPLES answers each.

   WHAT IT DOES NOT DO. It never reorders healthy models of similar speed:
   the registry order is a decision (see provider/registry.ts), and Auto
   keeps it whenever the evidence does not say otherwise. It never removes a
   model (the switches and the breaker do that). It only applies to Auto — a
   user's own choice still goes first (preferFirst).

   Per instance, in memory, like the breaker: a warm instance learns, a cold
   one starts from the registry order. No storage, no network.
   --------------------------------------------------------------------------- */

export const RECENT_FAIL_MS = 2 * 60_000;
export const MIN_SAMPLES = 5;
export const SLOW_FACTOR = 2;
const ALPHA = 0.3;

export interface AutoStat {
  samples: number;
  /** Exponentially weighted time to the first word (or to the answer). */
  ewmaMs: number;
  lastFailAt: number;
}

export interface AutoStats {
  recordSuccess(name: string, ms: number): void;
  recordFailure(name: string, now?: number): void;
  get(name: string): AutoStat | undefined;
}

export function createAutoStats(): AutoStats {
  const map = new Map<string, AutoStat>();
  return {
    recordSuccess(name, ms) {
      if (!Number.isFinite(ms) || ms < 0) return;
      const s = map.get(name);
      if (!s) {
        map.set(name, { samples: 1, ewmaMs: ms, lastFailAt: 0 });
        return;
      }
      s.samples += 1;
      s.ewmaMs = s.ewmaMs * (1 - ALPHA) + ms * ALPHA;
      /* It answered: whatever failed before is behind it. */
      s.lastFailAt = 0;
    },
    recordFailure(name, now = Date.now()) {
      const s = map.get(name);
      if (s) s.lastFailAt = now;
      else map.set(name, { samples: 0, ewmaMs: 0, lastFailAt: now });
    },
    get(name) {
      return map.get(name);
    },
  };
}

/** The order Auto tries candidates in. Pure over its inputs; the list keeps
 *  every candidate. Healthy models keep their registry order unless one is
 *  more than SLOW_FACTOR times slower than a faster healthy one (both with
 *  MIN_SAMPLES answers); recently failed models go last, in registry order. */
export function rankForAuto<T extends { name: string }>(
  candidates: ReadonlyArray<T>,
  stats: AutoStats,
  now = Date.now(),
): T[] {
  const failedRecently = (c: T) => {
    const s = stats.get(c.name);
    return !!s && s.lastFailAt > 0 && now - s.lastFailAt < RECENT_FAIL_MS;
  };
  const healthy = candidates.filter((c) => !failedRecently(c));
  const failed = candidates.filter((c) => failedRecently(c));

  const measured = (c: T) => {
    const s = stats.get(c.name);
    return s && s.samples >= MIN_SAMPLES ? s.ewmaMs : null;
  };
  const known = healthy.map(measured).filter((v): v is number => v !== null);
  const fastest = known.length > 0 ? Math.min(...known) : null;
  const slow = (c: T) => {
    const ms = measured(c);
    return fastest !== null && ms !== null && ms > fastest * SLOW_FACTOR;
  };
  return [...healthy.filter((c) => !slow(c)), ...healthy.filter(slow), ...failed];
}

/** The instance's own stats — what the live registry learns from. */
export const autoStats: AutoStats = createAutoStats();
