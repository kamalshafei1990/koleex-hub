"use client";

/* ===========================================================================
   FinanceTreasuryPlans — Phase 2.9

   Operational treasury governance surface.

   List view groups plans into four status buckets (draft / under_review
   / approved / archived). Selecting a plan reveals an inline detail
   panel: executive summary, applied assumptions, key metrics,
   review history, comparison against current state, and review actions
   (approve / request changes / archive).

   No giant tables. Calm cards + dense rows. The page is read-mostly —
   editing assumptions happens on /finance/treasury-forecast, not here.
   ========================================================================== */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import { MetricCard } from "@/components/finance/FinanceUiX";
import { useBaseCurrency } from "@/lib/hooks/useBaseCurrency";
import RrIcon from "@/components/ui/RrIcon";
import type {
  TreasuryPlan,
  TreasuryPlanReview,
  TreasuryPlanReviewDecision,
  TreasuryPlanStatus,
  TreasuryPlanVersion,
} from "@/lib/finance/types";
import type { ForecastResult } from "@/lib/intelligence/treasury-forecast";
import { humanizeError } from "@/lib/ui/humanize-error";

function fmtCompactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

const STATUS_BUCKETS: { key: TreasuryPlanStatus; label: string }[] = [
  { key: "draft",        label: "Drafts" },
  { key: "under_review", label: "Under review" },
  { key: "approved",     label: "Approved" },
  { key: "archived",     label: "Archived" },
];

interface DetailResponse {
  plan: TreasuryPlan;
  versions: TreasuryPlanVersion[];
  reviews: TreasuryPlanReview[];
}

interface CompareResponse {
  mode: "current" | "plan";
  plan: TreasuryPlan;
  current?: ForecastResult;
  otherPlan?: TreasuryPlan;
  diff: {
    d7Delta: number; d30Delta: number; d60Delta: number; d90Delta: number;
    lowestDelta: number;
    runwayDelta: number | null;
    firstNegativeDateChange: { from: string | null; to: string | null } | null;
    direction: "improves" | "neutral" | "deteriorates";
  };
}

export default function FinanceTreasuryPlans() {
  const [plans, setPlans] = useState<TreasuryPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  /* Phase S.4 — stable id-passing callback so PlanCard's memo holds. */
  const togglePlan = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/finance/treasury-plans", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { plans?: TreasuryPlan[]; error?: string };
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      setPlans(j.plans ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void loadList(); }, [loadList]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/finance/treasury-plans/${id}`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as DetailResponse & { error?: string };
      if (!r.ok || !j.plan) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      setDetail(j);
      setComparison(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDetail(null);
    }
  }, []);
  useEffect(() => { if (openId) void loadDetail(openId); else { setDetail(null); setComparison(null); } }, [openId, loadDetail]);

  const compareAgainstCurrent = useCallback(async () => {
    if (!openId) return;
    setCompareBusy(true);
    try {
      const r = await fetch(`/api/finance/treasury-plans/${openId}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ against: "current" }),
      });
      const j = (await r.json().catch(() => ({}))) as CompareResponse & { error?: string };
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      setComparison(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCompareBusy(false);
    }
  }, [openId]);

  const review = useCallback(async (decision: TreasuryPlanReviewDecision, notes?: string) => {
    if (!openId) return;
    setActionBusy(true);
    try {
      const r = await fetch(`/api/finance/treasury-plans/${openId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      await loadList();
      await loadDetail(openId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(false);
    }
  }, [openId, loadList, loadDetail]);

  const archive = useCallback(async () => {
    if (!openId) return;
    if (!window.confirm("Archive this plan? It will remain visible in the archive list.")) return;
    setActionBusy(true);
    try {
      const r = await fetch(`/api/finance/treasury-plans/${openId}/archive`, { method: "POST" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      await loadList();
      await loadDetail(openId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(false);
    }
  }, [openId, loadList, loadDetail]);

  /* Plans grouped by status. */
  const groups = useMemo(() => {
    const map = new Map<TreasuryPlanStatus, TreasuryPlan[]>();
    for (const p of plans) {
      const arr = map.get(p.status) ?? [];
      arr.push(p);
      map.set(p.status, arr);
    }
    return STATUS_BUCKETS.map((b) => ({ ...b, items: map.get(b.key) ?? [] }));
  }, [plans]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Treasury Plans"
          subtitle="Saved forecasts under operational governance: review, approve, archive, and compare against current treasury state."
          action={
            <Link
              href="/finance/treasury-forecast"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90"
            >
              <RrIcon name="plus" size={12} />
              New plan from forecast
            </Link>
          }
        />

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">{error}</div>
        )}

        {loading ? (
          <SectionCard>
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-dim)]">
              <RrIcon name="loading" size={14} className="animate-spin" />
              Loading treasury plans…
            </div>
          </SectionCard>
        ) : plans.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No treasury plans yet"
              hint="Open the Treasury Forecast page, configure a scenario, and click ‘Save as plan’ to capture an executive review snapshot."
              action={
                <Link
                  href="/finance/treasury-forecast"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90"
                >
                  <RrIcon name="arrow-up-right-from-square" size={12} />
                  Open Treasury Forecast
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {groups.map((g) => g.items.length === 0 ? null : (
              <section key={g.key}>
                <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  <StatusDot status={g.key} />
                  {g.label}
                  <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-gray-400">{g.items.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {/* Phase S.4 — pass stable togglePlan callback so
                      the memo on PlanCard sticks across openId changes. */}
                  {g.items.map((p) => (
                    <PlanCard
                      key={p.id}
                      plan={p}
                      active={openId === p.id}
                      onOpen={togglePlan}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {openId && detail && (
          <div className="mt-6">
            <PlanDetail
              detail={detail}
              comparison={comparison}
              actionBusy={actionBusy}
              compareBusy={compareBusy}
              onCompareCurrent={compareAgainstCurrent}
              onApprove={() => review("approve")}
              onRequestChanges={() => {
                const notes = window.prompt("Notes for the operator?", "") ?? undefined;
                void review("request_changes", notes);
              }}
              onArchive={archive}
              onClose={() => setOpenId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   PlanCard
   ──────────────────────────────────────────────────────────────────────── */

/* Phase S.4 — memoized; parent's `openId` toggle no longer rerenders
   every card in the list. */
const PlanCard = memo(function PlanCard({ plan, active, onOpen }: { plan: TreasuryPlan; active: boolean; onOpen: (id: string) => void }) {
  const m = plan.projected_metrics;
  const ds = daysAgo(plan.approved_at ?? plan.updated_at);
  const reviewLabel = plan.approved_at
    ? `Approved ${ds === 0 ? "today" : `${ds}d ago`}`
    : plan.status === "under_review"
      ? `Awaiting review · ${ds === 0 ? "today" : `${ds}d`}`
      : `Updated ${ds === 0 ? "today" : `${ds}d ago`}`;

  return (
    <button
      onClick={() => onOpen(plan.id)}
      className={`flex flex-col gap-3 rounded-2xl border bg-[var(--bg-secondary)] p-4 text-left transition ${
        active ? "border-white/[0.18] bg-white/[0.03]" : "border-white/[0.06] hover:border-white/[0.12]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot status={plan.status} />
            <span className="text-[12px] font-bold uppercase tracking-wider text-gray-500">{plan.status.replace("_", " ")}</span>
          </div>
          <div className="mt-1 truncate text-[14px] font-bold text-[var(--text-primary)]">{plan.name}</div>
          {plan.description && (
            <div className="mt-0.5 line-clamp-2 text-[11px] text-gray-400">{plan.description}</div>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-gray-300">{plan.forecast_window_days}d</span>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/[0.04] bg-[var(--bg-primary)]/40 px-3 py-2.5">
        <Stat label="Start" value={fmtCompactUsd(m.startingCash)} />
        <Stat label="90d"   value={fmtCompactUsd(m.d90)}            tone={m.d90 < 0 ? "rose" : "neutral"} />
        <Stat label="Runway" value={m.runwayDays != null ? `${m.runwayDays}d` : "—"} tone={m.runwayDays != null && m.runwayDays <= 14 ? "rose" : m.runwayDays != null && m.runwayDays <= 30 ? "amber" : "neutral"} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500">
        {m.firstNegativeDate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-300">
            <RrIcon name="info" size={9} />
            Negative {m.firstNegativeDate}
          </span>
        )}
        {plan.confidence != null && (
          <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 font-medium text-gray-400">{Math.round(plan.confidence * 100)}% confidence</span>
        )}
        <span className="ml-auto">{reviewLabel}</span>
      </div>
    </button>
  );
});

function Stat({ label, value, tone }: { label: string; value: string; tone?: "rose" | "amber" | "neutral" }) {
  const cls = tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "text-[var(--text-primary)]";
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</div>
      <div className={`mt-0.5 text-[13px] font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function StatusDot({ status }: { status: TreasuryPlanStatus }) {
  const cls =
    status === "approved"     ? "bg-emerald-400" :
    status === "under_review" ? "bg-amber-300"   :
    status === "draft"        ? "bg-sky-300"     :
                                 "bg-gray-400";
  return <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}

/* ────────────────────────────────────────────────────────────────────────
   PlanDetail
   ──────────────────────────────────────────────────────────────────────── */

function PlanDetail({
  detail, comparison, actionBusy, compareBusy, onCompareCurrent, onApprove, onRequestChanges, onArchive, onClose,
}: {
  detail: DetailResponse;
  comparison: CompareResponse | null;
  actionBusy: boolean;
  compareBusy: boolean;
  onCompareCurrent: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  const baseCurrency = useBaseCurrency();
  const p = detail.plan;
  const m = p.projected_metrics;
  const snapshot = p.base_forecast_snapshot as Partial<ForecastResult>;
  const assumptions = (snapshot?.assumptions as Array<{ key: string; label: string; affectedEventCount: number; cashImpact: number }> | undefined) ?? [];
  const drivers = snapshot?.drivers;

  const canApprove = p.status !== "approved" && p.status !== "archived";
  const canArchive = p.status !== "archived";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[var(--bg-secondary)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Plan detail</div>
          <h2 className="mt-1 text-[18px] font-bold tracking-tight">{p.name}</h2>
          {p.description && <div className="mt-1 max-w-prose text-[12px] text-gray-300">{p.description}</div>}
          <div className="mt-1 text-[10px] text-gray-500">
            {p.status === "approved" && p.approved_at
              ? <>Approved {new Date(p.approved_at).toLocaleDateString()} · </>
              : null}
            Created {new Date(p.created_at).toLocaleDateString()} · Window {p.forecast_window_days}d · Confidence {p.confidence != null ? `${Math.round(p.confidence * 100)}%` : "—"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canApprove && (
            <button
              onClick={onApprove}
              disabled={actionBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/25 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/35 disabled:opacity-50"
            >
              {actionBusy ? <RrIcon name="loading" size={11} className="animate-spin" /> : <RrIcon name="check" size={11} />}
              Approve
            </button>
          )}
          {canApprove && (
            <button
              onClick={onRequestChanges}
              disabled={actionBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-gray-300 hover:border-amber-500/30 hover:text-amber-300 disabled:opacity-50"
            >
              <RrIcon name="pencil" size={11} />
              Request changes
            </button>
          )}
          {canArchive && (
            <button
              onClick={onArchive}
              disabled={actionBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-gray-300 hover:border-rose-500/30 hover:text-rose-300 disabled:opacity-50"
            >
              <RrIcon name="trash" size={11} />
              Archive
            </button>
          )}
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-2.5 py-2 text-xs text-gray-300 hover:border-white/[0.18]"
          >
            <RrIcon name="cross" size={11} />
          </button>
        </div>
      </div>

      {/* Executive summary KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Start"  value={m.startingCash} unit={baseCurrency} hint="At save" loading={false} />
        <MetricCard label="7d"  value={m.d7}  unit={baseCurrency} tone={m.d7  < 0 ? "negative" : "neutral"} hint="Locked" loading={false} />
        <MetricCard label="30d" value={m.d30} unit={baseCurrency} tone={m.d30 < 0 ? "negative" : "neutral"} hint="Locked" loading={false} />
        <MetricCard label="60d" value={m.d60} unit={baseCurrency} tone={m.d60 < 0 ? "negative" : "neutral"} hint="Locked" loading={false} />
        <MetricCard label="90d" value={m.d90} unit={baseCurrency} tone={m.d90 < 0 ? "negative" : "neutral"} hint="Locked" loading={false} />
        <MetricCard
          label="Runway"
          value={m.runwayDays != null ? `${m.runwayDays}` : "—"}
          unit={m.runwayDays != null ? "days" : ""}
          tone={m.runwayDays == null ? "positive" : m.runwayDays <= 14 ? "negative" : m.runwayDays <= 30 ? "warning" : "neutral"}
          hint={m.firstNegativeDate ?? "Beyond horizon"}
          loading={false}
        />
      </div>

      {/* Comparison strip */}
      <div className="mt-4">
        <SectionCard
          title="Plan vs current treasury state"
          subtitle={comparison
            ? `Direction: ${comparison.diff.direction}. The plan was locked when the forecast looked like the numbers above; the current state may have drifted.`
            : "Click to compare this plan's locked snapshot against the current 90-day forecast."}
          action={
            <button
              onClick={onCompareCurrent}
              disabled={compareBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-white/[0.18] disabled:opacity-50"
            >
              {compareBusy ? <RrIcon name="loading" size={11} className="animate-spin" /> : <RrIcon name="recycle" size={11} />}
              Re-compare
            </button>
          }
        >
          {!comparison ? (
            <div className="py-2 text-[11px] text-gray-500">Comparison not run yet. Click &ldquo;Re-compare&rdquo; to evaluate this plan against today&apos;s treasury state.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5 text-[11px]">
              <Diff label="d7"  value={comparison.diff.d7Delta}  />
              <Diff label="d30" value={comparison.diff.d30Delta} />
              <Diff label="d60" value={comparison.diff.d60Delta} />
              <Diff label="d90" value={comparison.diff.d90Delta} />
              <Diff label="Lowest projected" value={comparison.diff.lowestDelta} />
              {comparison.diff.firstNegativeDateChange && (
                <div className="col-span-full rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  Negative-cash date moved:
                  {" "}
                  {comparison.diff.firstNegativeDateChange.from ?? "never"} → {comparison.diff.firstNegativeDateChange.to ?? "never"}
                </div>
              )}
              {comparison.diff.runwayDelta != null && (
                <div className="col-span-full text-[11px] text-gray-400">
                  Runway: {comparison.diff.runwayDelta > 0 ? "+" : ""}{comparison.diff.runwayDelta} days vs the plan.
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Body grid: assumptions + drivers / timeline */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Applied assumptions" subtitle="What was locked into this plan.">
          {assumptions.length === 0 ? (
            <div className="py-2 text-[11px] text-gray-500">Base case — no scenario assumptions applied.</div>
          ) : (
            <ul className="space-y-1.5">
              {assumptions.map((a) => (
                <li key={a.key} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-[var(--text-primary)]">{a.label}</span>
                    <span className="block text-[10px] text-gray-500">Affected events: {a.affectedEventCount}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-gray-300">{fmtCompactUsd(a.cashImpact)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Top liquidity drivers" subtitle="Largest outflows + inflows locked at save time.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <DriverList
              title="Top outflows"
              items={Array.isArray(drivers?.topOutflows) ? drivers.topOutflows.slice(0, 5) as Array<{ key?: string; party?: string; amountReporting?: number; daysFromNow?: number }> : []}
              tone="negative"
            />
            <DriverList
              title="Top inflows"
              items={Array.isArray(drivers?.topInflows) ? drivers.topInflows.slice(0, 5) as Array<{ key?: string; party?: string; amountReporting?: number; daysFromNow?: number }> : []}
              tone="positive"
            />
          </div>
        </SectionCard>
      </div>

      {/* Review history + version timeline */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Review history" subtitle="Every approve / request-changes / archive decision.">
          {detail.reviews.length === 0 ? (
            <div className="py-2 text-[11px] text-gray-500">No reviews yet.</div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {detail.reviews.map((rev) => (
                <li key={rev.id} className="py-2.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      rev.decision === "approve"          ? "bg-emerald-500/15 text-emerald-300" :
                      rev.decision === "request_changes"  ? "bg-amber-500/15 text-amber-300"   :
                                                            "bg-rose-500/15 text-rose-300"
                    }`}>
                      {rev.decision.replace("_", " ")}
                    </span>
                    <span className="text-gray-500">{new Date(rev.created_at).toLocaleString()}</span>
                  </div>
                  {rev.notes && <div className="mt-1 truncate text-[11px] text-gray-300">{rev.notes}</div>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Version history" subtitle="Assumption + metric changes captured automatically.">
          {detail.versions.length === 0 ? (
            <div className="py-2 text-[11px] text-gray-500">No edits since the plan was first saved.</div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {detail.versions.map((v) => {
                const d = v.diff_summary as Record<string, unknown>;
                return (
                  <li key={v.id} className="py-2.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{new Date(v.changed_at).toLocaleString()}</span>
                    </div>
                    {d.d90Delta != null && (
                      <div className="mt-1 text-gray-400">d90 Δ {fmtCompactUsd(d.d90Delta as number)} USD · Runway Δ {String(d.runwayDelta ?? "—")}d</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Diff({ label, value }: { label: string; value: number }) {
  const sign = value > 0 ? "+" : "";
  const tone = Math.abs(value) < 1 ? "text-gray-400" : value < 0 ? "text-rose-300" : "text-emerald-300";
  return (
    <div className="rounded-lg border border-white/[0.05] bg-[var(--bg-primary)]/40 px-2.5 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</div>
      <div className={`mt-0.5 text-[13px] font-bold tabular-nums ${tone}`}>{sign}{fmtCompactUsd(value)}</div>
    </div>
  );
}

function DriverList({
  title, items, tone,
}: {
  title: string;
  items: Array<{ key?: string; party?: string; amountReporting?: number; daysFromNow?: number }>;
  tone: "positive" | "negative";
}) {
  const accent = tone === "positive" ? "text-emerald-300" : "text-rose-300";
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">{title}</div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.05] px-3 py-3 text-[11px] text-gray-500">No material items.</div>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={it.key ?? i} className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-[var(--bg-primary)]/40 px-2.5 py-1.5 text-[11px]">
              <span className="text-gray-500 tabular-nums w-10">d+{it.daysFromNow ?? "—"}</span>
              <span className="min-w-0 flex-1 truncate text-gray-300">{it.party ?? "—"}</span>
              <span className={`tabular-nums font-semibold ${accent}`}>{fmtCompactUsd(it.amountReporting)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
