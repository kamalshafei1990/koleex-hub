/* ---------------------------------------------------------------------------
   login-analytics-compute — PURE aggregation logic for login_attempts.
   Phase 2A · S3a.

   This module is deliberately DEPENDENCY-FREE (no server-only, no Supabase, no
   path-alias imports) so it can be unit-tested directly in Node and reused by
   the server orchestrator (login-analytics.ts). It performs NO I/O — every
   function takes already-fetched rows (or summaries) and returns a typed result.

   Privacy: this layer never sees a password/hash (they are not on
   login_attempts at all). Identifiers ARE handled here but are only ever
   surfaced to super-admins by the caller.
   --------------------------------------------------------------------------- */

export type AttemptOutcome =
  | "success"
  | "failure"
  | "blocked"
  | "disabled"
  | "unknown_user";

export type AnalyticsWindow = "24h" | "7d" | "30d";

/** Outcomes that count as a "failed" attempt. `success` is excluded. */
export const FAILED_OUTCOMES: readonly AttemptOutcome[] = [
  "failure",
  "disabled",
  "unknown_user",
  "blocked",
] as const;

export function isFailureOutcome(o: AttemptOutcome): boolean {
  return (FAILED_OUTCOMES as readonly string[]).includes(o);
}

/** Canonical rule thresholds mirrored for SIMULATION. These intentionally match
 *  the enforcement rules in rate-limit.ts; keep the two in sync. `hardBlock`
 *  marks the rules that actually 429 in enforce mode (per-IP, per-IP+identifier);
 *  the per-identifier rule is observe/alert-only (never a global lock). */
export interface SimulationRule {
  rule: string;
  limit: number;
  windowMin: number;
  hardBlock: boolean;
}
export const SIMULATION_RULES: readonly SimulationRule[] = [
  { rule: "ip_10_failures_10m", limit: 10, windowMin: 10, hardBlock: true },
  { rule: "ip_identifier_5_failures_15m", limit: 5, windowMin: 15, hardBlock: true },
  { rule: "identifier_20_failures_30m", limit: 20, windowMin: 30, hardBlock: false },
] as const;

/** One login attempt, normalized for analytics (subset of login_attempts).
 *  Never includes any secret; password/hash are not on the source table. */
export interface ComputeAttempt {
  id: string;
  ipAddress: string;
  identifier: string;
  accountId: string | null;
  outcome: AttemptOutcome;
  /** metadata.would_block (first hard/observe rule tripped at arrival). */
  wouldBlock: boolean;
  /** metadata.rule (first tripped rule label) or null. */
  rule: string | null;
  /** metadata.counts — per-rule arrival counts captured in observe mode. */
  counts: Record<string, number>;
  /** ISO timestamp. */
  createdAt: string;
}

export interface Summary {
  totalAttempts: number;
  byOutcome: Record<AttemptOutcome, number>;
  successes: number;
  failures: number;
  /** successes / total (0..1); 0 when no attempts. */
  successRate: number;
  failureRate: number;
  distinctIps: number;
  distinctIdentifiers: number;
  /** attempts whose arrival metadata flagged would_block=true. */
  wouldBlockCount: number;
  /** wouldBlockCount / total (0..1). */
  wouldBlockRate: number;
  /** True when the fetch hit its row cap (results are a recent-N sample). */
  truncated: boolean;
  sampleSize: number;
}

export interface IpStat {
  ipAddress: string;
  total: number;
  failures: number;
  successes: number;
  /** distinct identifiers this IP attempted — credential-stuffing signal. */
  distinctIdentifiers: number;
  /** attempts from this IP where would_block was true. */
  wouldBlockHits: number;
  lastSeen: string;
}

export interface IdentifierStat {
  identifier: string;
  total: number;
  failures: number;
  /** distinct source IPs targeting this identifier — distributed-attack signal. */
  distinctIps: number;
  /** True if ANY attempt for this identifier resolved to a real account.
   *  Boolean only — never leaks WHICH account (enumeration-safe). */
  mapsToAccount: boolean;
  lastSeen: string;
}

export interface RuleSimulation {
  rule: string;
  limit: number;
  windowMin: number;
  hardBlock: boolean;
  /** attempts whose arrival counts for this rule were at/over the limit. */
  wouldFireCount: number;
  /** of those, how many were actually a SUCCESS → false-positive (a legit
   *  login this rule would have blocked). For hardBlock rules this is the
   *  dangerous signal. */
  blockedSuccesses: number;
  distinctIpsAffected: number;
  distinctIdentifiersAffected: number;
}

export interface FalsePositiveCandidate {
  identifier: string;
  ipAddress: string;
  /** would_block=true rows that nonetheless ended in a successful login. */
  occurrences: number;
  mapsToAccount: boolean;
  rules: string[];
  lastSeen: string;
}

export interface TimeBucket {
  bucketStart: string; // ISO
  attempts: number;
  failures: number;
  successes: number;
  wouldBlock: number;
}

export type ReadinessLevel =
  | "not_ready"
  | "needs_more_data"
  | "ready_with_caution"
  | "ready";

export interface Readiness {
  score: number; // 0..100
  level: ReadinessLevel;
  reasons: string[];
  signals: {
    sampleSize: number;
    soakHours: number;
    falsePositiveGroups: number;
    hardRuleFalsePositives: number;
    legitIpsWouldBlock: number;
    wouldBlockRate: number;
  };
}

/* ----------------------------- helpers ----------------------------------- */

export function windowToMs(w: AnalyticsWindow): number {
  switch (w) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
  }
}

function emptyOutcomeMap(): Record<AttemptOutcome, number> {
  return { success: 0, failure: 0, blocked: 0, disabled: 0, unknown_user: 0 };
}

/* --------------------------- aggregators --------------------------------- */

export function computeSummary(rows: ComputeAttempt[], truncated = false): Summary {
  const byOutcome = emptyOutcomeMap();
  const ips = new Set<string>();
  const idents = new Set<string>();
  let wouldBlockCount = 0;
  for (const r of rows) {
    byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
    ips.add(r.ipAddress);
    idents.add(r.identifier);
    if (r.wouldBlock) wouldBlockCount++;
  }
  const total = rows.length;
  const successes = byOutcome.success;
  const failures = total - successes;
  return {
    totalAttempts: total,
    byOutcome,
    successes,
    failures,
    successRate: total ? successes / total : 0,
    failureRate: total ? failures / total : 0,
    distinctIps: ips.size,
    distinctIdentifiers: idents.size,
    wouldBlockCount,
    wouldBlockRate: total ? wouldBlockCount / total : 0,
    truncated,
    sampleSize: total,
  };
}

export function computeTopOffendingIps(rows: ComputeAttempt[], n: number): IpStat[] {
  const map = new Map<
    string,
    { total: number; failures: number; successes: number; idents: Set<string>; wb: number; lastSeen: string }
  >();
  for (const r of rows) {
    let e = map.get(r.ipAddress);
    if (!e) {
      e = { total: 0, failures: 0, successes: 0, idents: new Set(), wb: 0, lastSeen: r.createdAt };
      map.set(r.ipAddress, e);
    }
    e.total++;
    if (isFailureOutcome(r.outcome)) e.failures++;
    if (r.outcome === "success") e.successes++;
    e.idents.add(r.identifier);
    if (r.wouldBlock) e.wb++;
    if (r.createdAt > e.lastSeen) e.lastSeen = r.createdAt;
  }
  return [...map.entries()]
    .map(([ipAddress, e]) => ({
      ipAddress,
      total: e.total,
      failures: e.failures,
      successes: e.successes,
      distinctIdentifiers: e.idents.size,
      wouldBlockHits: e.wb,
      lastSeen: e.lastSeen,
    }))
    .filter((s) => s.failures > 0)
    .sort((a, b) => b.failures - a.failures || b.total - a.total || a.ipAddress.localeCompare(b.ipAddress))
    .slice(0, n);
}

export function computeTopTargetedIdentifiers(rows: ComputeAttempt[], n: number): IdentifierStat[] {
  const map = new Map<
    string,
    { total: number; failures: number; ips: Set<string>; mapsToAccount: boolean; lastSeen: string }
  >();
  for (const r of rows) {
    let e = map.get(r.identifier);
    if (!e) {
      e = { total: 0, failures: 0, ips: new Set(), mapsToAccount: false, lastSeen: r.createdAt };
      map.set(r.identifier, e);
    }
    e.total++;
    if (isFailureOutcome(r.outcome)) e.failures++;
    e.ips.add(r.ipAddress);
    if (r.accountId !== null) e.mapsToAccount = true;
    if (r.createdAt > e.lastSeen) e.lastSeen = r.createdAt;
  }
  return [...map.entries()]
    .map(([identifier, e]) => ({
      identifier,
      total: e.total,
      failures: e.failures,
      distinctIps: e.ips.size,
      mapsToAccount: e.mapsToAccount,
      lastSeen: e.lastSeen,
    }))
    .filter((s) => s.failures > 0)
    .sort((a, b) => b.failures - a.failures || b.total - a.total || a.identifier.localeCompare(b.identifier))
    .slice(0, n);
}

export function computeRuleSimulation(
  rows: ComputeAttempt[],
  rules: readonly SimulationRule[] = SIMULATION_RULES,
): RuleSimulation[] {
  return rules.map((rule) => {
    let wouldFire = 0;
    let blockedSuccesses = 0;
    const ips = new Set<string>();
    const idents = new Set<string>();
    for (const r of rows) {
      const c = r.counts[rule.rule] ?? 0;
      if (c >= rule.limit) {
        wouldFire++;
        ips.add(r.ipAddress);
        idents.add(r.identifier);
        if (r.outcome === "success") blockedSuccesses++;
      }
    }
    return {
      rule: rule.rule,
      limit: rule.limit,
      windowMin: rule.windowMin,
      hardBlock: rule.hardBlock,
      wouldFireCount: wouldFire,
      blockedSuccesses,
      distinctIpsAffected: ips.size,
      distinctIdentifiersAffected: idents.size,
    };
  });
}

export function computeFalsePositiveCandidates(
  rows: ComputeAttempt[],
  n: number,
): FalsePositiveCandidate[] {
  // A false-positive candidate = a SUCCESSFUL login whose arrival metadata said
  // would_block=true. Grouped by (ip, identifier).
  const map = new Map<
    string,
    { identifier: string; ipAddress: string; occurrences: number; mapsToAccount: boolean; rules: Set<string>; lastSeen: string }
  >();
  for (const r of rows) {
    if (r.outcome !== "success" || !r.wouldBlock) continue;
    const key = `${r.ipAddress} ${r.identifier}`;
    let e = map.get(key);
    if (!e) {
      e = { identifier: r.identifier, ipAddress: r.ipAddress, occurrences: 0, mapsToAccount: false, rules: new Set(), lastSeen: r.createdAt };
      map.set(key, e);
    }
    e.occurrences++;
    if (r.accountId !== null) e.mapsToAccount = true;
    if (r.rule) e.rules.add(r.rule);
    if (r.createdAt > e.lastSeen) e.lastSeen = r.createdAt;
  }
  return [...map.values()]
    .map((e) => ({
      identifier: e.identifier,
      ipAddress: e.ipAddress,
      occurrences: e.occurrences,
      mapsToAccount: e.mapsToAccount,
      rules: [...e.rules].sort(),
      lastSeen: e.lastSeen,
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.identifier.localeCompare(b.identifier))
    .slice(0, n);
}

export function computeTimeSeries(
  rows: ComputeAttempt[],
  opts: { windowMs: number; bucketMs: number; nowMs: number },
): TimeBucket[] {
  const { windowMs, bucketMs, nowMs } = opts;
  const startMs = Math.floor((nowMs - windowMs) / bucketMs) * bucketMs;
  const bucketCount = Math.ceil(windowMs / bucketMs) + 1;
  const buckets: TimeBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      bucketStart: new Date(startMs + i * bucketMs).toISOString(),
      attempts: 0,
      failures: 0,
      successes: 0,
      wouldBlock: 0,
    });
  }
  for (const r of rows) {
    const t = Date.parse(r.createdAt);
    if (Number.isNaN(t)) continue;
    const idx = Math.floor((t - startMs) / bucketMs);
    if (idx < 0 || idx >= buckets.length) continue;
    const b = buckets[idx];
    b.attempts++;
    if (r.outcome === "success") b.successes++;
    if (isFailureOutcome(r.outcome)) b.failures++;
    if (r.wouldBlock) b.wouldBlock++;
  }
  return buckets;
}

/* --------------------------- readiness ----------------------------------- */

const MIN_SAMPLE = 200;
const MIN_SOAK_HOURS = 72;

export function computeReadiness(input: {
  summary: Summary;
  ruleSim: RuleSimulation[];
  falsePositives: FalsePositiveCandidate[];
  soakHours: number;
}): Readiness {
  const { summary, ruleSim, falsePositives, soakHours } = input;
  const reasons: string[] = [];

  const hardRuleFps = ruleSim
    .filter((r) => r.hardBlock)
    .reduce((acc, r) => acc + r.blockedSuccesses, 0);
  // distinct legit IPs that would be hard-blocked = FP candidates on hard rules.
  const legitIpsWouldBlock = new Set(
    falsePositives.map((f) => f.ipAddress),
  ).size;

  const signals = {
    sampleSize: summary.sampleSize,
    soakHours,
    falsePositiveGroups: falsePositives.length,
    hardRuleFalsePositives: hardRuleFps,
    legitIpsWouldBlock,
    wouldBlockRate: summary.wouldBlockRate,
  };

  // 1) Not enough evidence yet.
  if (summary.sampleSize < MIN_SAMPLE) {
    reasons.push(`Insufficient sample: ${summary.sampleSize} attempts (need ≥ ${MIN_SAMPLE}).`);
    return { score: 25, level: "needs_more_data", reasons, signals };
  }
  if (soakHours < MIN_SOAK_HOURS) {
    reasons.push(`Soak too short: ${soakHours.toFixed(1)}h (need ≥ ${MIN_SOAK_HOURS}h).`);
    return { score: 35, level: "needs_more_data", reasons, signals };
  }

  // 2) Score from penalties.
  let score = 100;
  if (hardRuleFps > 0) {
    score -= 40 + Math.min(40, hardRuleFps * 10);
    reasons.push(`${hardRuleFps} successful login(s) would have been hard-blocked (false positives).`);
  }
  if (legitIpsWouldBlock > 0) {
    score -= Math.min(20, legitIpsWouldBlock * 10);
    reasons.push(`${legitIpsWouldBlock} IP(s) with successful logins would be blocked (shared-IP/VPN risk).`);
  }
  const softFps = Math.max(0, falsePositives.length - 0);
  if (softFps > 0 && hardRuleFps === 0) {
    score -= Math.min(15, softFps * 3);
    reasons.push(`${softFps} would-block/success collision group(s) to review.`);
  }
  if (score < 0) score = 0;

  let level: ReadinessLevel;
  if (hardRuleFps > 0 || score < 60) {
    level = "not_ready";
  } else if (falsePositives.length > 0 || score < 85) {
    level = "ready_with_caution";
  } else {
    level = "ready";
    reasons.push("No false positives over an adequate soak — thresholds look safe to enforce.");
  }
  return { score, level, reasons, signals };
}
