/* ---------------------------------------------------------------------------
   ai/skills/timeout — one slow handler must not eat the whole turn.

   Phase 6B. No `server-only`: it is a race and a table, and the suite imports
   it directly.

   THE PROBLEM. dispatchTool awaits `tool.handler(ctx, args)` with no bound. A
   handler that hangs — a Supabase query that never returns, an outbound fetch
   with no timeout of its own — holds the agent loop until the whole serverless
   invocation is killed. The user sees nothing and then sees a failure with no
   explanation, and the audit row is never written because the code that writes
   it is downstream of the await.

   WHAT THIS DOES, STATED PRECISELY, because the honest limitation matters more
   than the feature. `Promise.race` frees the CALLER. It does NOT cancel the
   underlying work: the query keeps running until it finishes or the invocation
   ends. Real cancellation needs an AbortSignal threaded through every handler
   and every Supabase call, which is a change to all 45 handlers — and Phase 6
   is explicitly "metadata only, no handler logic changes".

   So this is a bound on how long the TURN waits, not on how long the query
   runs. That is still the property worth having: the loop continues, the user
   gets an answer, the audit row is written, and the timeout is visible.
   Anything stronger is a later phase and should be described as such.

   IT FAILS AS A NORMAL TOOL FAILURE. A timeout returns the same ToolResult
   shape a thrown handler already produces — ok:false, denied, no stack trace.
   The agent loop's existing error path handles it unchanged, which is what
   keeps this from being a behaviour change anywhere but the hang it fixes.
   --------------------------------------------------------------------------- */

/** Generous on purpose. Every tool here is a Supabase read or a small write;
 *  §I budgets a single tool call at under 400 ms p50 and 1.2 s p95, so 15 s is
 *  roughly a factor of twelve above the worst normal case. It is a hang
 *  detector, not a performance budget — a limit tight enough to trip on a slow
 *  day would turn a slow answer into no answer, which is the wrong trade. */
export const DEFAULT_TOOL_TIMEOUT_MS = 15_000;

/** Tools that legitimately take longer, with the reason. Anything not listed
 *  gets the default — an unlisted tool is never given MORE time by accident. */
export const TOOL_TIMEOUT_OVERRIDES: Readonly<Record<string, number>> = Object.freeze({
  /* Leaves our network and waits on a third party we do not control. Still
     bounded, because "the internet is slow" is not a reason to hold the turn
     open indefinitely. */
  search_web: 25_000,
  /* A generation is tens of seconds of a vendor's GPU. The adapter's own
     bound is 45 s (IMAGE_TIMEOUT_MS); this sits just above it so the
     adapter's cause, not a bare timeout, is what the model relays. */
  generate_image: 50_000,
});

export function timeoutFor(toolName: string): number {
  return TOOL_TIMEOUT_OVERRIDES[toolName] ?? DEFAULT_TOOL_TIMEOUT_MS;
}

export interface TimeoutOutcome<T> {
  timedOut: boolean;
  value: T | null;
  waitedMs: number;
}

/** Race a promise against a deadline.
 *
 *  Injectable timer so the suite proves the behaviour without waiting 15
 *  seconds — a timeout tested with real sleeps is a slow test somebody
 *  eventually deletes.
 *
 *  The timer is ALWAYS cleared, including on the fast path. A dangling
 *  setTimeout keeps the event loop alive and, on a serverless runtime, can
 *  hold an invocation open after its response was sent — the opposite of what
 *  this file is for. */
export async function raceTimeout<T>(
  work: Promise<T>,
  ms: number,
  timer: {
    set: (fn: () => void, ms: number) => unknown;
    clear: (h: unknown) => void;
    now: () => number;
  } = { set: setTimeout, clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>), now: Date.now },
): Promise<TimeoutOutcome<T>> {
  const started = timer.now();
  let handle: unknown;
  const TIMED_OUT = Symbol("timeout");

  try {
    const raced = await Promise.race([
      work,
      new Promise<typeof TIMED_OUT>((resolve) => {
        handle = timer.set(() => resolve(TIMED_OUT), ms);
      }),
    ]);
    if (raced === TIMED_OUT) {
      return { timedOut: true, value: null, waitedMs: timer.now() - started };
    }
    return { timedOut: false, value: raced as T, waitedMs: timer.now() - started };
  } finally {
    /* Also on the timeout path: the work promise may still reject later, and
       an unhandled rejection from an abandoned handler would crash the
       process on some runtimes. Attaching a no-op catch is what makes
       abandoning it safe. */
    if (handle !== undefined) timer.clear(handle);
    void work.catch(() => {});
  }
}
