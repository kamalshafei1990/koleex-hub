import "server-only";

/* ---------------------------------------------------------------------------
   kx-server-timing — structured stage timing for critical API operations
   (Phase 2 observability).

   Usage:
     const timing = stageTimer("discuss.mutate");
     …work…; timing.mark("auth");
     …work…; timing.mark("db_insert");
     const { header } = timing.done({ action: "sendMessage" });
     return NextResponse.json(data, { headers: { "Server-Timing": header } });

   · Emits ONE log line per request: `[kx-server-timing] {json}` with the
     per-stage durations (ms) — visible in Vercel function logs, filterable,
     and percentile-ready (raw values, never pre-averaged).
   · Also produces a standards-compliant `Server-Timing` response header so
     the browser DevTools network panel shows the same stage breakdown.
   · PRIVACY: stage names and `extra` tags are code-authored constants only —
     never row data, message content, emails, tokens or identifiers beyond
     internal UUIDs already visible to the authenticated caller.
   · Emitted via console.warn because next.config removeConsole strips
     console.log/info from production builds (only error/warn survive).
   · Overhead: a few performance.now() calls + one JSON.stringify — sub-0.1ms.
   --------------------------------------------------------------------------- */

export type StageTimer = {
  mark: (stage: string) => void;
  /** Log + return the Server-Timing header value. Call exactly once. */
  done: (extra?: Record<string, string | number | boolean>) => { total: number; header: string };
};

export function stageTimer(op: string): StageTimer {
  const t0 = performance.now();
  let last = t0;
  const stages: Array<[string, number]> = [];
  return {
    mark(stage: string) {
      const now = performance.now();
      stages.push([stage, Math.round((now - last) * 10) / 10]);
      last = now;
    },
    done(extra) {
      const total = Math.round((performance.now() - t0) * 10) / 10;
      try {
        console.warn(
          `[kx-server-timing] ${JSON.stringify({
            op,
            total_ms: total,
            stages: Object.fromEntries(stages),
            ts: Date.now(),
            env: process.env.VERCEL_ENV ?? "dev",
            region: process.env.VERCEL_REGION ?? "local",
            ...(extra ?? {}),
          })}`,
        );
      } catch { /* metrics must never break the request */ }
      const header =
        stages.map(([k, v]) => `${k};dur=${v}`).join(", ") + (stages.length ? ", " : "") + `total;dur=${total}`;
      return { total, header };
    },
  };
}
