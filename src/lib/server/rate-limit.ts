import "server-only";

/* ---------------------------------------------------------------------------
   rate-limit — login brute-force protection (Phase 2A · S2c, OBSERVE MODE).

   Server-only. This module RECORDS login attempts into public.login_attempts
   and COMPUTES a "would-block" decision. It NEVER blocks a request in this
   stage — enforcement is S2d.

   Flag: AUTH_RATELIMIT = "off" | "observe" | "enforce"
     · off      → do nothing (no compute, no record). Zero overhead. (default)
     · observe  → record every attempt + compute would_block (NO blocking).
     · enforce  → NOT IMPLEMENTED YET. Treated EXACTLY like "observe" here, with
                  a guard so it cannot accidentally block. S2d will add real
                  blocking behind this value.

   Security:
     · Never receives or stores the plaintext password.
     · Identifier is normalized (trim + lowercase) so attempts bucket correctly.
     · IP comes only from request headers (never the body).
     · All DB work is best-effort: a failure to record/compute must NEVER block
       or fail a login. Writes are AWAITED (S1c proved void writes are dropped
       on Vercel) inside try/catch.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { LoginAttemptOutcome } from "@/types/supabase";

export type RateLimitMode = "off" | "observe" | "enforce";

/** Resolve the flag. Unknown / unset → "off". */
export function rateLimitMode(): RateLimitMode {
  const v = (process.env.AUTH_RATELIMIT ?? "off").toLowerCase();
  return v === "observe" || v === "enforce" ? (v as RateLimitMode) : "off";
}

/** Client IP from headers only. Priority: first x-forwarded-for hop, then
 *  x-real-ip, then "unknown". Never trusts the request body. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  return real || "unknown";
}

/** Truncated user-agent (defensive cap) or null. */
export function clientUserAgent(req: Request): string | null {
  const ua = req.headers.get("user-agent");
  return ua ? ua.slice(0, 1024) : null;
}

/** Normalize the submitted email/username for consistent bucketing. */
export function normalizeIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Outcomes that count as a "failed" attempt for window thresholds.
 *  `success` is intentionally excluded. */
const FAILED_OUTCOMES: LoginAttemptOutcome[] = [
  "failure",
  "disabled",
  "unknown_user",
  "blocked",
];

/** Initial would-block rules (observe only). */
const RULES = [
  { rule: "ip_10_failures_10m", scope: "ip", limit: 10, windowMin: 10 },
  { rule: "ip_identifier_5_failures_15m", scope: "ip_identifier", limit: 5, windowMin: 15 },
  { rule: "identifier_20_failures_30m", scope: "identifier", limit: 20, windowMin: 30 },
] as const;

export interface WouldBlockResult {
  would_block: boolean;
  /** The first rule that tripped, or null. */
  rule: string | null;
  /** Per-rule failed-attempt counts used in the decision. */
  counts: Record<string, number>;
}

/**
 * Compute whether this request WOULD be blocked, evaluated at REQUEST ARRIVAL.
 *
 * Counts only FAILED attempts already stored in each rule's window — i.e. it
 * EXCLUDES the current attempt (which hasn't been recorded yet). This matches
 * real enforcement semantics: a limiter checks the limit before processing the
 * request. Pure read; never throws (returns a safe default on error).
 */
export async function computeWouldBlock(
  ip: string,
  identifier: string,
): Promise<WouldBlockResult> {
  const counts: Record<string, number> = {};
  let triggered: string | null = null;
  try {
    for (const r of RULES) {
      const since = new Date(Date.now() - r.windowMin * 60_000).toISOString();
      let q = supabaseServer
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .in("outcome", FAILED_OUTCOMES)
        .gte("created_at", since);
      if (r.scope === "ip" || r.scope === "ip_identifier") q = q.eq("ip_address", ip);
      if (r.scope === "identifier" || r.scope === "ip_identifier") q = q.eq("identifier", identifier);
      const { count } = await q;
      const c = count ?? 0;
      counts[r.rule] = c;
      if (c >= r.limit && !triggered) triggered = r.rule;
    }
  } catch (e) {
    console.error("[rate-limit] computeWouldBlock failed:", (e as Error)?.name);
  }
  return { would_block: triggered !== null, rule: triggered, counts };
}

/**
 * Record one login attempt. Best-effort + AWAITED + swallows errors so it can
 * never block or fail a login. Never stores the password.
 */
export async function recordAttempt(params: {
  ip: string;
  identifier: string;
  userAgent: string | null;
  accountId: string | null;
  tenantId: string | null;
  outcome: LoginAttemptOutcome;
  reason: string;
  wouldBlock: WouldBlockResult;
  mode: RateLimitMode;
}): Promise<void> {
  try {
    await supabaseServer.from("login_attempts").insert({
      ip_address: params.ip,
      identifier: params.identifier,
      user_agent: params.userAgent,
      account_id: params.accountId,
      tenant_id: params.tenantId,
      outcome: params.outcome,
      reason: params.reason,
      metadata: {
        mode: params.mode,
        would_block: params.wouldBlock.would_block,
        rule: params.wouldBlock.rule,
        counts: params.wouldBlock.counts,
      },
    });
  } catch (e) {
    console.error("[rate-limit] recordAttempt failed:", (e as Error)?.name);
  }
}
