/* ---------------------------------------------------------------------------
   ai/observability/latency-stats — min / median / max over a handful of
   latency samples.

   Pulled out of /api/ai/providers rather than left inline, for one reason: a
   median with an even-length branch is the kind of code that is quietly wrong
   for years because nobody ever measures an even number of things on the day
   they read it. Inside a Route Handler it cannot be tested — Next.js route
   files may only export route symbols — so it lived where no assertion could
   reach it. Here the suite feeds it real lists.

   NOT a statistics library. Three numbers over a handful of samples, which is
   what a probe produces. Percentiles over a real distribution come from the
   `[kx-server-timing]` log lines, which are raw and never pre-averaged.

   No `server-only`: pure arithmetic, and the suite imports it directly.
   --------------------------------------------------------------------------- */

export type LatencyStats = {
  min: number;
  /** Mean of the two middle values on even lengths, rounded. */
  median: number;
  max: number;
};

/** Reports all three together, because with few samples the SPREAD is the
 *  interesting part and a lone median hides it — a provider that answers in
 *  400ms then 4000ms has the same median as one steady at 2200ms, and they are
 *  not the same provider.
 *
 *  Returns null for an empty list rather than 0: no samples and a sample of
 *  zero are different facts, and a caller that renders 0 would state the
 *  second when it means the first. */
export function latencyStats(samples: ReadonlyArray<number>): LatencyStats | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return {
    min: sorted[0],
    median:
      sorted.length % 2 === 1
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2),
    max: sorted[sorted.length - 1],
  };
}
