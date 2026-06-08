"use client";

/* ---------------------------------------------------------------------------
   /accounts/login-security — Phase 2A · S3c.

   READ-ONLY super-admin monitor for observe-mode login_attempts analytics and
   enforcement readiness. Consumes GET /api/admin/login-analytics (S3b).

   This page NEVER enables enforcement, NEVER changes env vars, and offers NO
   "turn on enforce" control. It is analysis-only. Brand-aligned (Koleex dark
   minimal), desktop + mobile responsive, custom icons only, no new chart lib,
   no polling (manual refresh).
   --------------------------------------------------------------------------- */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthGate from "@/components/admin/AuthGate";
import SecurityCenter from "@/components/security/SecurityCenter";
import KpiCard from "@/components/ui/KpiCard";
import { AreaChart, DonutChart } from "@/components/finance/charts";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import LineChartIcon from "@/components/icons/ui/LineChartIcon";
import PieChartIcon from "@/components/icons/ui/PieChartIcon";

/* ---- local mirror of the S3b response (type-only; no server import) ------- */
type Win = "24h" | "7d" | "30d";
interface Summary {
  totalAttempts: number; successes: number; failures: number;
  successRate: number; failureRate: number; distinctIps: number;
  distinctIdentifiers: number; wouldBlockCount: number; wouldBlockRate: number;
  truncated: boolean; byOutcome: Record<string, number>;
}
interface IpStat { ipAddress: string; total: number; failures: number; successes: number; distinctIdentifiers: number; wouldBlockHits: number; lastSeen: string; }
interface IdStat { identifier: string; total: number; failures: number; distinctIps: number; mapsToAccount: boolean; lastSeen: string; }
interface RuleSim { rule: string; limit: number; windowMin: number; hardBlock: boolean; wouldFireCount: number; blockedSuccesses: number; distinctIpsAffected: number; distinctIdentifiersAffected: number; }
interface FpCand { identifier: string; ipAddress: string; occurrences: number; mapsToAccount: boolean; rules: string[]; lastSeen: string; }
interface Bucket { bucketStart: string; attempts: number; failures: number; successes: number; wouldBlock: number; }
interface Readiness { score: number; level: "not_ready" | "needs_more_data" | "ready_with_caution" | "ready"; reasons: string[]; signals: Record<string, number>; }
interface AuditEvent { id: string; action: string; ip: string | null; details: Record<string, unknown> | null; createdAt: string; }
interface Report {
  window: Win; generatedAt: string; summary: Summary;
  topOffendingIps: IpStat[]; topTargetedIdentifiers: IdStat[];
  ruleSimulation: RuleSim[]; falsePositiveCandidates: FpCand[];
  timeSeries: Bucket[]; readiness: Readiness; recentRateLimitEvents: AuditEvent[];
}

const WINDOWS: { id: Win; label: string }[] = [
  { id: "24h", label: "24h" }, { id: "7d", label: "7 days" }, { id: "30d", label: "30 days" },
];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const shortTime = (iso: string, win: Win) =>
  new Date(iso).toLocaleString(undefined, win === "24h" ? { hour: "2-digit" } : { month: "short", day: "numeric" });

const READINESS: Record<Readiness["level"], { label: string; tone: "default" | "positive" | "warning" | "rose" | "info"; blurb: string }> = {
  ready: { label: "Ready", tone: "positive", blurb: "No false positives over an adequate soak." },
  ready_with_caution: { label: "Ready · caution", tone: "info", blurb: "Mostly safe — review the noted collisions first." },
  needs_more_data: { label: "Needs more data", tone: "warning", blurb: "Keep observe mode running to build a confident baseline." },
  not_ready: { label: "Not ready", tone: "rose", blurb: "Enforcing now would block legitimate logins." },
};

export default function LoginSecurityPage() {
  return (
    <AuthGate title="Login Security" subtitle="Observe-mode rate-limit analytics and enforcement readiness">
      <Suspense fallback={null}>
        <VersionSwitch />
      </Suspense>
    </AuthGate>
  );
}

/* A3: the redesigned Security Center is opt-in behind ?v=2; the existing monitor
   stays the default until the redesign is fully verified (A5 cutover). */
function VersionSwitch() {
  const v2 = useSearchParams().get("v") === "2";
  return v2 ? <SecurityCenter /> : <Monitor />;
}

function Monitor() {
  const boot = useMeBootstrap();
  const isSuperAdmin = boot.data?.isSuperAdmin === true;
  const bootLoading = boot.loading;

  const [win, setWin] = useState<Win>("24h");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async (w: Win) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/login-analytics?window=${w}`, { credentials: "include" });
      if (res.status === 403) { setForbidden(true); setReport(null); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport((await res.json()) as Report);
    } catch {
      setError("Couldn't load analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isSuperAdmin) void load(win); }, [isSuperAdmin, win, load]);

  if (bootLoading) return <CenterSpinner />;
  if (!isSuperAdmin) return <AccessDenied />;
  if (forbidden) return <AccessDenied />;

  const s = report?.summary;
  const empty = !!report && s?.totalAttempts === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/accounts" className="mt-1 text-[var(--text-dim)] hover:text-[var(--text-primary)]" aria-label="Back to accounts">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
              <BarChart3Icon className="h-6 w-6" /> Login Security
            </h1>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Observe-mode rate-limit analytics and enforcement readiness
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-0.5">
            {WINDOWS.map((w) => (
              <button key={w.id} onClick={() => setWin(w.id)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${win === w.id ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
                {w.label}
              </button>
            ))}
          </div>
          <button onClick={() => load(win)} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
            {loading ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <span>Refresh</span>}
          </button>
        </div>
      </div>

      {/* Advisory banner */}
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs text-[var(--text-dim)]">
        Advisory analysis only · production is in <span className="font-medium text-[var(--text-secondary)]">observe</span> mode · this page never enables enforcement.
      </div>

      {error && <Banner text={error} />}
      {loading && !report && <CenterSpinner />}

      {report && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Total attempts" value={s!.totalAttempts.toLocaleString()} icon={<BarChart3Icon className="h-4 w-4" />} />
            <KpiCard label="Failure rate" value={pct(s!.failureRate)} tone={s!.failureRate > 0.5 ? "warning" : "default"} />
            <KpiCard label="Would-block rate" value={pct(s!.wouldBlockRate)} tone={s!.wouldBlockRate > 0 ? "info" : "default"} hint={`${s!.wouldBlockCount} attempts`} />
            <KpiCard label="Distinct IPs" value={s!.distinctIps.toLocaleString()} />
            <KpiCard label="Distinct identifiers" value={s!.distinctIdentifiers.toLocaleString()} />
            <KpiCard label="Readiness" value={READINESS[report.readiness.level].label} tone={READINESS[report.readiness.level].tone} hint={`score ${report.readiness.score}`} />
          </div>

          {empty ? (
            <EmptyState win={win} />
          ) : (
            <>
              {/* Charts */}
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card title="Attempts over time" icon={<LineChartIcon className="h-4 w-4" />} className="lg:col-span-2">
                  <AreaChart
                    height={220}
                    labels={report.timeSeries.map((b) => shortTime(b.bucketStart, win))}
                    series={[
                      { name: "Attempts", values: report.timeSeries.map((b) => b.attempts), tone: "info" },
                      { name: "Failures", values: report.timeSeries.map((b) => b.failures), tone: "warning" },
                    ]}
                  />
                </Card>
                <Card title="Outcome mix" icon={<PieChartIcon className="h-4 w-4" />}>
                  <div className="flex justify-center py-2">
                    <DonutChart
                      centerLabel="Attempts"
                      centerValue={String(s!.totalAttempts)}
                      segments={Object.entries(s!.byOutcome)
                        .filter(([, v]) => v > 0)
                        .map(([name, value]) => ({ name: name.replace("_", " "), value }))}
                    />
                  </div>
                </Card>
              </div>

              {/* Tables: top IPs + top identifiers */}
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card title="Top offending IPs">
                  <Table head={["IP", "Fails", "Total", "Idents", "WB"]}
                    rows={report.topOffendingIps.map((r) => [r.ipAddress, r.failures, r.total, r.distinctIdentifiers, r.wouldBlockHits])}
                    empty="No failing IPs in this window." />
                </Card>
                <Card title="Top targeted identifiers">
                  <Table head={["Identifier", "Fails", "IPs", "Account?"]}
                    rows={report.topTargetedIdentifiers.map((r) => [r.identifier, r.failures, r.distinctIps, r.mapsToAccount ? "yes" : "no"])}
                    empty="No targeted identifiers in this window." />
                </Card>
              </div>

              {/* Rule simulation */}
              <Card title="Rule simulation" className="mt-4" icon={<BarChart3Icon className="h-4 w-4" />}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {report.ruleSimulation.map((r) => (
                    <div key={r.rule} className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                      <div className="font-mono text-xs text-[var(--text-secondary)]">{r.rule}</div>
                      <div className="mt-1 text-[11px] text-[var(--text-dim)]">≥{r.limit} fails / {r.windowMin}m · {r.hardBlock ? "hard-block" : "observe-only"}</div>
                      <div className="mt-3 flex items-baseline gap-4">
                        <div><div className="text-2xl font-bold text-[var(--text-primary)]">{r.wouldFireCount}</div><div className="text-[11px] text-[var(--text-dim)]">would fire</div></div>
                        <div><div className={`text-2xl font-bold ${r.blockedSuccesses > 0 ? "text-rose-400" : "text-[var(--text-primary)]"}`}>{r.blockedSuccesses}</div><div className="text-[11px] text-[var(--text-dim)]">blocked successes (FP)</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* False-positive candidates */}
              <Card title="False-positive candidates" className="mt-4">
                <Table head={["IP", "Identifier", "Count", "Account?", "Rules"]}
                  rows={report.falsePositiveCandidates.map((r) => [r.ipAddress, r.identifier, r.occurrences, r.mapsToAccount ? "yes" : "no", r.rules.join(", ")])}
                  empty="No false-positive candidates — no successful login would have been blocked." />
              </Card>

              {/* Readiness verdict */}
              <Card title="Enforcement readiness" className="mt-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className={`text-xl font-bold ${toneText(READINESS[report.readiness.level].tone)}`}>{READINESS[report.readiness.level].label}</div>
                    <div className="text-sm text-[var(--text-dim)]">{READINESS[report.readiness.level].blurb}</div>
                  </div>
                  <div className="text-right text-sm text-[var(--text-dim)]">score {report.readiness.score}/100</div>
                </div>
                {report.readiness.reasons.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
                    {report.readiness.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
                <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-dim)]">
                  Advisory only. Enabling enforcement is a deliberate, separate configuration change — this page cannot do it.
                </div>
              </Card>

              {/* Recent rate-limit events */}
              <Card title="Recent rate-limit security events" className="mt-4">
                <Table head={["When", "IP", "Rule", "Retry-After"]}
                  rows={report.recentRateLimitEvents.map((e) => [
                    new Date(e.createdAt).toLocaleString(),
                    e.ip ?? "—",
                    String((e.details?.rule as string) ?? "—"),
                    String((e.details?.retry_after_seconds as number) ?? "—"),
                  ])}
                  empty="No enforcement events — expected while production is observe-only." />
              </Card>
            </>
          )}

          {s?.truncated && <p className="mt-4 text-xs text-[var(--text-dim)]">Showing a recent sample (row cap reached) — figures are a lower bound for this window.</p>}
        </>
      )}
    </div>
  );
}

/* ---------------------------------- bits --------------------------------- */

function toneText(t: "default" | "positive" | "warning" | "rose" | "info"): string {
  return { default: "text-[var(--text-primary)]", positive: "text-emerald-400", warning: "text-amber-400", rose: "text-rose-400", info: "text-blue-400" }[t];
}

function Card({ title, icon, className = "", children }: { title: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/60 p-4 ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">{icon}{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  if (rows.length === 0) return <p className="py-4 text-sm text-[var(--text-dim)]">{empty}</p>;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-dim)]">
            {head.map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--border)]">
              {r.map((c, j) => <td key={j} className={`px-2 py-1.5 ${j === 0 ? "font-mono text-[var(--text-primary)]" : "text-[var(--text-secondary)] tabular-nums"}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card2({ children }: { children: React.ReactNode }) { return <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">{children}</div>; }
function EmptyState({ win }: { win: Win }) { return <div className="mt-6"><Card2><p className="text-[var(--text-secondary)]">No login attempts recorded in the last {win}.</p><p className="mt-1 text-sm text-[var(--text-dim)]">Observe mode records attempts as they happen — check back after some sign-in activity.</p></Card2></div>; }
function AccessDenied() { return <div className="mx-auto max-w-md px-4 py-20 text-center"><Card2><p className="text-lg font-semibold text-[var(--text-primary)]">Super-admin only</p><p className="mt-2 text-sm text-[var(--text-dim)]">You don&apos;t have access to login-security analytics.</p></Card2></div>; }
function CenterSpinner() { return <div className="flex justify-center py-24"><SpinnerIcon className="h-6 w-6 animate-spin text-[var(--text-dim)]" /></div>; }
function Banner({ text }: { text: string }) { return <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{text}</div>; }
