/* ---------------------------------------------------------------------------
   security/view-model — PURE presenter for the Security Center (Phase 2A · A1).

   Transforms the existing LoginAnalyticsResponse (from GET /api/admin/
   login-analytics — the FROZEN S3b contract) into a product-ready, verdict-first
   view model the UI renders directly.

   Hard rules:
     · Pure functions, ZERO imports, deterministic, no `any`.
     · No side effects, no network, no browser/Date APIs (timestamps are passed
       through as strings; formatting of time labels is the UI's job).
     · Reads the API response ONLY — never touches auth, signin, sessions, the
       analytics engine, enforcement, or schema. Threat level / posture /
       attention are DERIVED here on the client; nothing new is computed server-
       side.
     · Advisory only — produces no enforcement CTA, no mutation, no controls.

   Input types below are a structural mirror of the API response; the real
   response is assignable to them. Defining them locally keeps this module
   import-free and unit-testable in plain Node.
   --------------------------------------------------------------------------- */

/* ----------------------------- input shape ------------------------------- */

export type AnalyticsWindow = "24h" | "7d" | "30d";
export type ReadinessLevel =
  | "not_ready"
  | "needs_more_data"
  | "ready_with_caution"
  | "ready";

export interface ReportSummary {
  totalAttempts: number;
  successes: number;
  failures: number;
  successRate: number;
  failureRate: number;
  distinctIps: number;
  distinctIdentifiers: number;
  wouldBlockCount: number;
  wouldBlockRate: number;
  truncated: boolean;
  sampleSize: number;
  byOutcome: Record<string, number>;
}
export interface ReportIp {
  ipAddress: string;
  total: number;
  failures: number;
  successes: number;
  distinctIdentifiers: number;
  wouldBlockHits: number;
  lastSeen: string;
}
export interface ReportIdentifier {
  identifier: string;
  total: number;
  failures: number;
  distinctIps: number;
  mapsToAccount: boolean;
  lastSeen: string;
}
export interface ReportRule {
  rule: string;
  limit: number;
  windowMin: number;
  hardBlock: boolean;
  wouldFireCount: number;
  blockedSuccesses: number;
  distinctIpsAffected: number;
  distinctIdentifiersAffected: number;
}
export interface ReportFalsePositive {
  identifier: string;
  ipAddress: string;
  occurrences: number;
  mapsToAccount: boolean;
  rules: string[];
  lastSeen: string;
}
export interface ReportBucket {
  bucketStart: string;
  attempts: number;
  failures: number;
  successes: number;
  wouldBlock: number;
}
export interface ReportReadiness {
  score: number;
  level: ReadinessLevel;
  reasons: string[];
  signals: Record<string, number>;
}
export interface SecurityReport {
  window: AnalyticsWindow;
  generatedAt: string;
  summary: ReportSummary;
  topOffendingIps: ReportIp[];
  topTargetedIdentifiers: ReportIdentifier[];
  ruleSimulation: ReportRule[];
  falsePositiveCandidates: ReportFalsePositive[];
  timeSeries: ReportBucket[];
  readiness: ReportReadiness;
  recentRateLimitEvents: { id: string; action: string; ip: string | null; details: Record<string, unknown> | null; createdAt: string }[];
}

/* ----------------------------- output shape ------------------------------ */

export type ThreatLevel = "quiet" | "elevated" | "high";
export type PostureState = "secure" | "watch" | "at_risk";
export type Severity = "info" | "attention" | "critical";
/** Visual tone — maps to the monochrome-first semantic palette in the UI.
 *  calm = neutral (healthy), info = accent, attention = amber, critical = red. */
export type Tone = "calm" | "info" | "attention" | "critical";

export type AttentionTargetKind =
  | "ip"
  | "identifier"
  | "rule"
  | "readiness"
  | "false_positives"
  | "threats"
  | "none";

export interface ThreatView {
  level: ThreatLevel;
  label: string;
  reason: string;
  tone: Tone;
}
export interface PostureView {
  state: PostureState;
  headline: string;
  subline: string;
  tone: Tone;
}
export interface ReadinessHeroView {
  level: ReadinessLevel;
  score: number;
  label: string;
  oneLineReason: string;
  tone: Tone;
  /** Always true in Phase A — the hero never enables enforcement. */
  advisory: true;
}
export interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  actionLabel: string;
  target: { kind: AttentionTargetKind; id?: string };
}
export interface KpiView {
  key: "attempts" | "failure_rate" | "would_block_rate" | "distinct_ips";
  label: string;
  value: number;
  display: string;
  tone: Tone;
  /** Per-bucket spark series (empty when no series applies). */
  spark: number[];
  hint?: string;
}
export interface OutcomeSplitView {
  successes: number;
  failures: number;
  successPct: number;
  failurePct: number;
}
export interface TrendView {
  /** Raw ISO bucket starts; the UI formats them per window. */
  labels: string[];
  attempts: number[];
  failures: number[];
  wouldBlock: number[];
  hasData: boolean;
}
export interface EmptyFlags {
  empty: boolean;
  lowTraffic: boolean;
  truncated: boolean;
  allClear: boolean;
}
export interface SecurityViewModel {
  window: AnalyticsWindow;
  generatedAt: string;
  posture: PostureView;
  threat: ThreatView;
  readiness: ReadinessHeroView;
  attention: AttentionItem[];
  kpis: KpiView[];
  outcomeSplit: OutcomeSplitView;
  trend: TrendView;
  flags: EmptyFlags;
}

/* --------------------------- tunable thresholds -------------------------- */
/* Documented, deterministic constants. Threat level answers "are we under
   attack now?"; it is intentionally distinct from readiness ("safe to
   enforce?"). False positives drive ATTENTION + READINESS, not threat. */

export const THRESHOLDS = {
  /** sampleSize below this → readiness can't be trusted yet (mirrors engine MIN_SAMPLE). */
  LOW_TRAFFIC_SAMPLE: 200,
  /** distinct offending IPs at/above this with hard-rule pressure → stuffing/fan-out → High. */
  HIGH_FANOUT_IPS: 5,
  /** total hard-rule would-fire at/above this (few IPs, sustained) → High. */
  HIGH_HARDFIRE: 25,
  /** minimum volume before failure-rate alone can raise Elevated. */
  ELEVATED_MIN_VOLUME: 20,
  /** failure rate (0..1) at/above this (with volume) → at least Elevated. */
  ELEVATED_FAILURE_RATE: 0.6,
  /** failure-rate KPI turns amber at/above this. */
  KPI_FAILURE_WARN: 0.5,
} as const;

const ATTENTION_MAX = 3;
const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 0, attention: 1, info: 2 };

/* ------------------------------ formatters ------------------------------- */
/* Locale-independent for deterministic output (no Intl/toLocaleString). */

function formatInt(n: number): string {
  const sign = n < 0 ? "-" : "";
  const s = Math.abs(Math.trunc(n)).toString();
  return sign + s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/* ------------------------------ helpers ---------------------------------- */

function hardFireTotal(report: SecurityReport): number {
  return report.ruleSimulation
    .filter((r) => r.hardBlock)
    .reduce((acc, r) => acc + Math.max(0, r.wouldFireCount), 0);
}
function offendingIpCount(report: SecurityReport): number {
  return report.topOffendingIps.filter((ip) => ip.failures > 0).length;
}
function fpOnAccounts(report: SecurityReport): number {
  return report.falsePositiveCandidates.filter((f) => f.mapsToAccount).length;
}

/* ----------------------------- derivations ------------------------------- */

export function deriveThreatLevel(report: SecurityReport): ThreatView {
  const hardFire = hardFireTotal(report);
  const ips = offendingIpCount(report);
  const { sampleSize, failureRate } = report.summary;

  if (hardFire > 0 && (ips >= THRESHOLDS.HIGH_FANOUT_IPS || hardFire >= THRESHOLDS.HIGH_HARDFIRE)) {
    return {
      level: "high",
      label: "High",
      tone: "critical",
      reason:
        ips >= THRESHOLDS.HIGH_FANOUT_IPS
          ? `Sustained attempts from ${ips} IPs are tripping rate-limit thresholds.`
          : `${formatInt(hardFire)} attempts would trip rate-limit thresholds.`,
    };
  }
  if (hardFire > 0 || (sampleSize >= THRESHOLDS.ELEVATED_MIN_VOLUME && failureRate >= THRESHOLDS.ELEVATED_FAILURE_RATE)) {
    return {
      level: "elevated",
      label: "Elevated",
      tone: "attention",
      reason:
        hardFire > 0
          ? "Some sign-ins are approaching rate-limit thresholds."
          : `Failure rate is elevated (${formatPct(failureRate)}).`,
    };
  }
  return { level: "quiet", label: "Quiet", tone: "calm", reason: "No attack pressure detected." };
}

export function derivePosture(report: SecurityReport, threat: ThreatView, flags: EmptyFlags): PostureView {
  const anyFp = report.falsePositiveCandidates.length > 0;
  const fpAccounts = fpOnAccounts(report);

  if (threat.level === "high" || fpAccounts > 0) {
    return {
      state: "at_risk",
      tone: "critical",
      headline: "Action recommended",
      subline:
        fpAccounts > 0
          ? "Legitimate sign-ins would be blocked by current rules."
          : "A sustained attack pattern is in progress.",
    };
  }
  if (threat.level === "elevated" || anyFp) {
    return {
      state: "watch",
      tone: "attention",
      headline: "Monitoring elevated activity",
      subline: anyFp
        ? "Some successful sign-ins would have been rate-limited — review before enforcing."
        : "Some sign-ins are tripping rate-limit thresholds.",
    };
  }
  // Secure — tailor the subline to the data we actually have.
  let subline = "No suspicious activity detected.";
  if (flags.empty) subline = "No sign-in activity recorded in this window.";
  else if (flags.lowTraffic) subline = "Limited activity — still building a baseline.";
  return { state: "secure", tone: "calm", headline: "Authentication secure", subline };
}

export function deriveReadinessHero(report: SecurityReport): ReadinessHeroView {
  const { level, score, reasons } = report.readiness;
  const LABEL: Record<ReadinessLevel, string> = {
    not_ready: "Not ready",
    needs_more_data: "Needs more data",
    ready_with_caution: "Ready · caution",
    ready: "Ready",
  };
  const TONE: Record<ReadinessLevel, Tone> = {
    not_ready: "critical",
    needs_more_data: "attention",
    ready_with_caution: "info",
    ready: "calm",
  };
  const FALLBACK: Record<ReadinessLevel, string> = {
    not_ready: "Enforcing now would block legitimate logins.",
    needs_more_data: "Keep observe mode running to build a confident baseline.",
    ready_with_caution: "Mostly safe — review the noted items first.",
    ready: "No false positives over an adequate soak.",
  };
  return {
    level,
    score,
    label: LABEL[level],
    tone: TONE[level],
    oneLineReason: reasons.length > 0 ? reasons[0] : FALLBACK[level],
    advisory: true,
  };
}

export function deriveEmptyFlags(report: SecurityReport, attentionCount: number): EmptyFlags {
  const { totalAttempts, sampleSize, truncated } = report.summary;
  return {
    empty: totalAttempts === 0,
    lowTraffic: totalAttempts > 0 && sampleSize < THRESHOLDS.LOW_TRAFFIC_SAMPLE,
    truncated,
    allClear: attentionCount === 0,
  };
}

export function deriveNeedsAttention(report: SecurityReport, threat: ThreatView): AttentionItem[] {
  const items: AttentionItem[] = [];

  // 1) FALSE POSITIVES — always highest priority (real users would be blocked).
  const fps = report.falsePositiveCandidates;
  if (fps.length > 0) {
    const onAccounts = fpOnAccounts(report);
    items.push({
      id: "fp",
      severity: onAccounts > 0 ? "critical" : "attention",
      title: "Possible false positives",
      detail:
        onAccounts > 0
          ? `${formatInt(onAccounts)} legitimate sign-in${onAccounts === 1 ? "" : "s"} would be blocked by current rules.`
          : `${formatInt(fps.length)} successful sign-in${fps.length === 1 ? "" : "s"} would have been rate-limited.`,
      actionLabel: "Review",
      target: { kind: "false_positives" },
    });
  }

  // 2) ATTACK PRESSURE — high/elevated threat.
  const hardFire = hardFireTotal(report);
  if (threat.level === "high" || threat.level === "elevated") {
    items.push({
      id: "threat",
      severity: threat.level === "high" ? "critical" : "attention",
      title: threat.level === "high" ? "Active attack pattern" : "Elevated attack pressure",
      detail: `${formatInt(hardFire)} attempt${hardFire === 1 ? "" : "s"} from ${formatInt(offendingIpCount(report))} IP${offendingIpCount(report) === 1 ? "" : "s"} would trip rate limits.`,
      actionLabel: "Investigate",
      target: { kind: "threats" },
    });
  }

  // 3) READINESS BLOCKER — only when explicitly not ready (needs_more_data is normal soak, not an alert).
  if (report.readiness.level === "not_ready") {
    items.push({
      id: "readiness",
      severity: "attention",
      title: "Enforcement not ready",
      detail: report.readiness.reasons[0] ?? "Resolve the readiness blockers before enabling enforcement.",
      actionLabel: "View readiness",
      target: { kind: "readiness" },
    });
  }

  // 4) TRUNCATION — informational data caveat.
  if (report.summary.truncated) {
    items.push({
      id: "truncated",
      severity: "info",
      title: "Showing a recent sample",
      detail: "The row cap was reached — figures are a lower bound for this window.",
      actionLabel: "",
      target: { kind: "none" },
    });
  }

  // Stable ranking: severity first (FP critical wins), then insertion order.
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => SEVERITY_WEIGHT[a.item.severity] - SEVERITY_WEIGHT[b.item.severity] || a.i - b.i)
    .slice(0, ATTENTION_MAX)
    .map(({ item }) => item);
}

export function deriveTrend(report: SecurityReport): TrendView {
  const t = report.timeSeries;
  return {
    labels: t.map((b) => b.bucketStart),
    attempts: t.map((b) => b.attempts),
    failures: t.map((b) => b.failures),
    wouldBlock: t.map((b) => b.wouldBlock),
    hasData: t.some((b) => b.attempts > 0),
  };
}

export function deriveOutcomeSplit(report: SecurityReport): OutcomeSplitView {
  const { successes, failures, totalAttempts } = report.summary;
  const denom = totalAttempts > 0 ? totalAttempts : 1;
  return {
    successes,
    failures,
    successPct: successes / denom,
    failurePct: failures / denom,
  };
}

export function deriveKpis(report: SecurityReport, trend: TrendView): KpiView[] {
  const s = report.summary;
  return [
    {
      key: "attempts",
      label: "Total attempts",
      value: s.totalAttempts,
      display: formatInt(s.totalAttempts),
      tone: "calm",
      spark: trend.attempts,
    },
    {
      key: "failure_rate",
      label: "Failure rate",
      value: s.failureRate,
      display: formatPct(s.failureRate),
      tone: s.failureRate >= THRESHOLDS.KPI_FAILURE_WARN ? "attention" : "calm",
      spark: trend.failures,
    },
    {
      key: "would_block_rate",
      label: "Would-block rate",
      value: s.wouldBlockRate,
      display: formatPct(s.wouldBlockRate),
      tone: s.wouldBlockCount > 0 ? "info" : "calm",
      spark: trend.wouldBlock,
      hint: `${formatInt(s.wouldBlockCount)} attempts`,
    },
    {
      key: "distinct_ips",
      label: "Distinct IPs",
      value: s.distinctIps,
      display: formatInt(s.distinctIps),
      tone: "calm",
      spark: [],
    },
  ];
}

/* ----------------------------- orchestrator ------------------------------ */

export function deriveViewModel(
  report: SecurityReport,
  window: AnalyticsWindow = report.window,
): SecurityViewModel {
  const threat = deriveThreatLevel(report);
  const attention = deriveNeedsAttention(report, threat);
  const flags = deriveEmptyFlags(report, attention.length);
  const posture = derivePosture(report, threat, flags);
  const readiness = deriveReadinessHero(report);
  const trend = deriveTrend(report);
  const outcomeSplit = deriveOutcomeSplit(report);
  const kpis = deriveKpis(report, trend);

  return {
    window,
    generatedAt: report.generatedAt,
    posture,
    threat,
    readiness,
    attention,
    kpis,
    outcomeSplit,
    trend,
    flags,
  };
}
