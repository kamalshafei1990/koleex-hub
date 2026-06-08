import "server-only";

/* ---------------------------------------------------------------------------
   login-analytics — server-only orchestrator for login-security analytics.
   Phase 2A · S3a.

   READ-ONLY over public.login_attempts and public.koleex_security_audit via the
   service-role client. Performs the bounded, time-windowed fetches and delegates
   all aggregation to the dependency-free login-analytics-compute module.

   Guarantees:
     · Read-only — never writes; never touches the signin/auth flow.
     · Service-role only (these tables are RLS service-role-only; the anon client
       is default-denied). No new client exposure.
     · Never selects a password/hash (not present on login_attempts anyway).
     · Every query is time-window bounded (created_at >= now - window) and
       LIMIT-capped to avoid unbounded scans; truncation is surfaced, never silent.
     · No caching layer (S3a). Callers (S3b API) add gating + caching as needed.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import {
  type AnalyticsWindow,
  type ComputeAttempt,
  type AttemptOutcome,
  type Summary,
  type IpStat,
  type IdentifierStat,
  type RuleSimulation,
  type FalsePositiveCandidate,
  type TimeBucket,
  type Readiness,
  windowToMs,
  computeSummary,
  computeTopOffendingIps,
  computeTopTargetedIdentifiers,
  computeRuleSimulation,
  computeFalsePositiveCandidates,
  computeTimeSeries,
  computeReadiness,
} from "@/lib/server/login-analytics-compute";

/** Hard upper bound on rows pulled per window. A range scan on the
 *  (created_at) index; aggregation happens in-process. If a window exceeds
 *  this, results are a recent-N sample and `truncated` is set true (surfaced,
 *  never silent). A daily rollup table is the future fix at large scale. */
const MAX_ROWS = 20000;

interface FetchResult {
  rows: ComputeAttempt[];
  truncated: boolean;
}

function sinceIso(window: AnalyticsWindow, nowMs: number): string {
  return new Date(nowMs - windowToMs(window)).toISOString();
}

function toCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** Bounded, windowed fetch of login_attempts → normalized ComputeAttempt[]. */
export async function fetchAttempts(
  window: AnalyticsWindow,
  nowMs: number = Date.now(),
): Promise<FetchResult> {
  const { data, error } = await supabaseServer
    .from("login_attempts")
    .select("id, ip_address, identifier, account_id, outcome, metadata, created_at")
    .gte("created_at", sinceIso(window, nowMs))
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error || !data) return { rows: [], truncated: false };

  const rows: ComputeAttempt[] = data.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id),
      ipAddress: r.ip_address ?? "unknown",
      identifier: r.identifier ?? "",
      accountId: r.account_id ?? null,
      outcome: r.outcome as AttemptOutcome,
      wouldBlock: meta.would_block === true,
      rule: typeof meta.rule === "string" ? meta.rule : null,
      counts: toCounts(meta.counts),
      createdAt: r.created_at as string,
    };
  });

  return { rows, truncated: data.length >= MAX_ROWS };
}

/** Earliest/latest timestamps + soak duration for the fetched set. */
function soakHoursOf(rows: ComputeAttempt[]): number {
  if (rows.length === 0) return 0;
  let min = rows[0].createdAt;
  let max = rows[0].createdAt;
  for (const r of rows) {
    if (r.createdAt < min) min = r.createdAt;
    if (r.createdAt > max) max = r.createdAt;
  }
  const ms = Date.parse(max) - Date.parse(min);
  return ms > 0 ? ms / 3_600_000 : 0;
}

/* ---- Public API (each fetches its own bounded window) -------------------- */

export async function summary(window: AnalyticsWindow): Promise<Summary> {
  const { rows, truncated } = await fetchAttempts(window);
  return computeSummary(rows, truncated);
}

export async function topOffendingIps(window: AnalyticsWindow, n = 20): Promise<IpStat[]> {
  const { rows } = await fetchAttempts(window);
  return computeTopOffendingIps(rows, n);
}

export async function topTargetedIdentifiers(
  window: AnalyticsWindow,
  n = 20,
): Promise<IdentifierStat[]> {
  const { rows } = await fetchAttempts(window);
  return computeTopTargetedIdentifiers(rows, n);
}

export async function ruleSimulation(window: AnalyticsWindow): Promise<RuleSimulation[]> {
  const { rows } = await fetchAttempts(window);
  return computeRuleSimulation(rows);
}

export async function falsePositiveCandidates(
  window: AnalyticsWindow,
  n = 50,
): Promise<FalsePositiveCandidate[]> {
  const { rows } = await fetchAttempts(window);
  return computeFalsePositiveCandidates(rows, n);
}

export async function timeSeries(
  window: AnalyticsWindow,
  bucket: "hour" | "day" = window === "24h" ? "hour" : "day",
): Promise<TimeBucket[]> {
  const nowMs = Date.now();
  const { rows } = await fetchAttempts(window, nowMs);
  const bucketMs = bucket === "hour" ? 3_600_000 : 86_400_000;
  return computeTimeSeries(rows, { windowMs: windowToMs(window), bucketMs, nowMs });
}

export async function readiness(window: AnalyticsWindow): Promise<Readiness> {
  const { rows, truncated } = await fetchAttempts(window);
  const sum = computeSummary(rows, truncated);
  const sim = computeRuleSimulation(rows);
  const fps = computeFalsePositiveCandidates(rows, 1000);
  return computeReadiness({ summary: sum, ruleSim: sim, falsePositives: fps, soakHours: soakHoursOf(rows) });
}

export interface RateLimitAuditEvent {
  id: string;
  action: string;
  ip: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

/** Recent rate-limit security-audit events (surfaced read-only in the monitor). */
export async function recentRateLimitEvents(
  window: AnalyticsWindow,
  n = 50,
): Promise<RateLimitAuditEvent[]> {
  const { data, error } = await supabaseServer
    .from("koleex_security_audit")
    .select("id, action, ip, details, created_at")
    .eq("action", "login_rate_limit_triggered")
    .gte("created_at", sinceIso(window, Date.now()))
    .order("created_at", { ascending: false })
    .limit(n);
  if (error || !data) return [];
  return data.map((r) => ({
    id: String(r.id),
    action: r.action as string,
    ip: (r.ip as string | null) ?? null,
    details: (r.details as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** Single-fetch composite report (S3b will prefer this — one DB round-trip). */
export interface LoginAnalyticsReport {
  window: AnalyticsWindow;
  generatedAt: string;
  summary: Summary;
  topOffendingIps: IpStat[];
  topTargetedIdentifiers: IdentifierStat[];
  ruleSimulation: RuleSimulation[];
  falsePositiveCandidates: FalsePositiveCandidate[];
  timeSeries: TimeBucket[];
  readiness: Readiness;
}

export async function buildReport(
  window: AnalyticsWindow,
  opts: { topN?: number; bucket?: "hour" | "day" } = {},
): Promise<LoginAnalyticsReport> {
  const nowMs = Date.now();
  const { rows, truncated } = await fetchAttempts(window, nowMs);
  const topN = opts.topN ?? 20;
  const bucket = opts.bucket ?? (window === "24h" ? "hour" : "day");
  const bucketMs = bucket === "hour" ? 3_600_000 : 86_400_000;

  const sum = computeSummary(rows, truncated);
  const sim = computeRuleSimulation(rows);
  const fps = computeFalsePositiveCandidates(rows, 1000);

  return {
    window,
    generatedAt: new Date(nowMs).toISOString(),
    summary: sum,
    topOffendingIps: computeTopOffendingIps(rows, topN),
    topTargetedIdentifiers: computeTopTargetedIdentifiers(rows, topN),
    ruleSimulation: sim,
    falsePositiveCandidates: fps.slice(0, 50),
    timeSeries: computeTimeSeries(rows, { windowMs: windowToMs(window), bucketMs, nowMs }),
    readiness: computeReadiness({ summary: sum, ruleSim: sim, falsePositives: fps, soakHours: soakHoursOf(rows) }),
  };
}
