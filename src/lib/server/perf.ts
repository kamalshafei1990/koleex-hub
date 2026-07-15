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

/* ── Sampling (SW-1, Phase 4) ──────────────────────────────────────────────
   High-volume ops (auth.resolve runs on EVERY authenticated request) would
   flood the logs if every call emitted a line. We ALWAYS log the signal-rich
   cases — slow requests, errors, denials — and sample the rest 1-in-N so a
   healthy P50 is still visible without drowning the log. Deterministic
   per-process counter (no Math.random, which is unavailable in some runtimes);
   the modulo gives an even sample across ops. Tunable via env. */
const SLOW_MS = Number(process.env.KX_TIMING_SLOW_MS ?? 800);   // always log ≥ this
const SAMPLE_N = Math.max(1, Number(process.env.KX_TIMING_SAMPLE_N ?? 4)); // else 1-in-N
let _sampleCounter = 0;
function shouldLog(totalMs: number, extra?: Record<string, unknown>): boolean {
  if (totalMs >= SLOW_MS) return true;
  // Never sample away a security-relevant outcome (error/denied/unauthorized).
  const status = extra && (extra.status ?? extra.error ?? extra.denied);
  if (status === true || (typeof status === "number" && status >= 400) ||
      (typeof status === "string" && /error|deny|denied|unauth|forbidden|401|403/i.test(status))) return true;
  return (_sampleCounter++ % SAMPLE_N) === 0;
}

export type StageTimer = {
  mark: (stage: string) => void;
  /** Log (sampled) + return the Server-Timing header value. Call exactly once. */
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
        if (shouldLog(total, extra)) {
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
        }
      } catch { /* metrics must never break the request */ }
      const header =
        stages.map(([k, v]) => `${k};dur=${v}`).join(", ") + (stages.length ? ", " : "") + `total;dur=${total}`;
      return { total, header };
    },
  };
}

/* ── Route wrapper (SW-1) ──────────────────────────────────────────────────
   Opt-in convenience so a Route Handler gets timing + a Server-Timing header
   with ZERO body/PII exposure and no per-request metric fetch. Use a
   NORMALIZED op name (e.g. "customers.list") — never a raw URL with ids.

     export const GET = timedRoute("customers.list", async (req, { timer }) => {
       const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
       timer.mark("auth");
       const rows = await load(...); timer.mark("db");
       return NextResponse.json(rows);   // wrapper appends Server-Timing + logs (sampled)
     });

   The handler may ignore `timer` entirely — it still gets a total + a status
   tag. Errors are always logged (never sampled away). */
export function timedRoute<Ctx>(
  op: string,
  handler: (req: Request, ctx: Ctx & { timer: StageTimer }) => Promise<Response>,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    const timer = stageTimer(op);
    try {
      const res = await handler(req, { ...(ctx as Ctx), timer });
      const { header } = timer.done({ status: res.status });
      try {
        const existing = res.headers.get("Server-Timing");
        res.headers.set("Server-Timing", existing ? `${existing}, ${header}` : header);
      } catch { /* immutable headers on some responses — timing already logged */ }
      return res;
    } catch (e) {
      timer.done({ status: "error" });
      throw e;
    }
  };
}
