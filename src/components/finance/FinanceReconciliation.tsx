"use client";

/* ===========================================================================
   FinanceReconciliation — Phase 2.5 queue UI.

   Renders the suggested reconciliation queue alongside controls for
   confirm / reject / rescan. The system suggests; the operator decides.

   Layout:
     · Compact header with rescan + filter toggle
     · KPI strip: suggested / high-confidence / partial / duplicate-risk
     · Queue list — one row per candidate, dense but calm:
         confidence pill · payment summary · movement summary
         match-reason text · matched-factor chips · warnings
         confirm + reject + open-payment + open-movement actions
   ========================================================================== */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FinanceHeader from "@/components/finance/FinanceHeader";
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import { MetricCard } from "@/components/finance/FinanceUiX";
import RrIcon from "@/components/ui/RrIcon";
import GuidanceTip from "@/components/ui/GuidanceTip";
import { fmtMoney } from "@/lib/finance/calc";
import type {
  FinanceReconciliationCandidate,
  ReconciliationCandidateType,
  ReconciliationConfidenceLevel,
} from "@/lib/finance/types";

type FilterKey = "active" | "suggested" | "confirmed" | "rejected" | "all";

export default function FinanceReconciliation() {
  const [candidates, setCandidates] = useState<FinanceReconciliationCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescanBusy, setRescanBusy] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("active");
  const [acting, setActing] = useState<string | null>(null);   // candidate.id currently in-flight
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: FilterKey) => {
    setLoading(true);
    setError(null);
    try {
      const statusParam =
        status === "active"    ? "suggested,confirmed" :
        status === "suggested" ? "suggested" :
        status === "confirmed" ? "confirmed" :
        status === "rejected"  ? "rejected,expired" :
        "suggested,confirmed,rejected,expired";
      const r = await fetch(`/api/finance/reconciliation/candidates?status=${encodeURIComponent(statusParam)}&limit=200`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { candidates?: FinanceReconciliationCandidate[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setCandidates(j.candidates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(filter); }, [load, filter]);

  const rescan = useCallback(async () => {
    setRescanBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/finance/reconciliation/rescan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRescanBusy(false);
    }
  }, [load, filter]);

  const confirm = useCallback(async (id: string) => {
    setActing(id);
    setError(null);
    try {
      const r = await fetch("/api/finance/reconciliation/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: id }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(null);
    }
  }, [load, filter]);

  const reject = useCallback(async (id: string) => {
    const reason = window.prompt("Why is this match wrong? (optional)") ?? undefined;
    setActing(id);
    setError(null);
    try {
      const r = await fetch("/api/finance/reconciliation/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: id, rejection_reason: reason || undefined }),
      });
      const j = (await r.json().catch(() => ({}))) as { candidate?: unknown; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(null);
    }
  }, [load, filter]);

  /* ── KPIs over the currently-loaded queue ── */
  const kpi = useMemo(() => {
    const total = candidates.length;
    const high = candidates.filter((c) => c.confidence_level === "high" && c.status === "suggested").length;
    const partial = candidates.filter((c) =>
      ["partial", "underpayment", "overpayment"].includes(c.candidate_type) && c.status === "suggested",
    ).length;
    const dups = candidates.filter((c) => c.candidate_type === "duplicate_risk" && c.status === "suggested").length;
    return { total, high, partial, dups };
  }, [candidates]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <FinanceHeader
          title="Reconciliation Queue"
          subtitle="Deterministic matches between payments and bank movements. You confirm; the engine never reconciles silently."
          action={
            <button
              type="button"
              onClick={rescan}
              disabled={rescanBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-white/[0.18] disabled:opacity-60"
            >
              {rescanBusy ? (
                <>
                  <RrIcon name="loading" size={12} className="animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <RrIcon name="search" size={12} />
                  Rescan
                </>
              )}
            </button>
          }
        />

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="In queue"          value={kpi.total}  unit="cand." hint="Across the current filter" loading={loading} />
          <MetricCard label="High-confidence"   value={kpi.high}   unit="cand." hint="Same amount + same direction + tight timing" loading={loading} />
          <MetricCard label="Partial / variance" value={kpi.partial} unit="cand." hint="Partial, over- or under-payments" loading={loading} />
          <MetricCard label="Duplicate risk"    value={kpi.dups}   unit="cand." hint="Possible duplicate bank movement" loading={loading} />
        </div>

        {/* Filter chips */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {(["active","suggested","confirmed","rejected","all"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`h-7 rounded-full border px-3 text-[11px] font-semibold capitalize transition ${
                filter === k
                  ? "border-white/[0.18] bg-white/[0.08] text-[var(--text-primary)]"
                  : "border-white/[0.06] bg-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              {k}
            </button>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500">
            <span>How matching works</span>
            <GuidanceTip guidanceId="treasury.unreconciled" />
          </span>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <SectionCard>
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-dim)]">
                <RrIcon name="loading" size={14} className="animate-spin" />
                Loading queue…
              </div>
            </SectionCard>
          ) : candidates.length === 0 ? (
            <EmptyState
              title="No reconciliation suggestions yet"
              hint="The engine compares unreconciled bank movements against open payments. Run a rescan to refresh the queue."
              action={
                <button
                  onClick={rescan}
                  disabled={rescanBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-60"
                >
                  <RrIcon name="search" size={12} />
                  Rescan now
                </button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {/* Phase S.4 — pass the stable parent callbacks directly
                  so React.memo on CandidateRow actually sticks. The
                  child reads candidate.id and calls onConfirm(id). */}
              {candidates.map((c) => (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  busy={acting === c.id}
                  onConfirm={confirm}
                  onReject={reject}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   CandidateRow — one row in the queue.
   ──────────────────────────────────────────────────────────────────────── */

const CandidateRow = memo(function CandidateRow({
  candidate,
  busy,
  onConfirm,
  onReject,
}: {
  candidate: FinanceReconciliationCandidate;
  busy: boolean;
  /* Phase S.4 — accept id-passing parent callbacks so React.memo
     stays effective; toggling `busy` on one row no longer rerenders
     every other row in the queue. */
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const p = candidate.payment ?? null;
  const m = candidate.cash_movement ?? null;
  const isActive = candidate.status === "suggested";

  const conf = Math.round(candidate.confidence * 100);
  const confLevel = candidate.confidence_level;

  const expected = Number(p?.expected_amount ?? p?.amount ?? 0);
  const actual = Number(m?.amount ?? 0);
  const diff = actual - expected;

  const typeLabel = TYPE_LABELS[candidate.candidate_type];

  return (
    <div className={`rounded-2xl border bg-[var(--bg-secondary)] p-4 transition ${
      isActive
        ? "border-white/[0.06] hover:border-white/[0.12]"
        : "border-white/[0.04] opacity-90"
    }`}
    >
      {/* Top row: confidence + candidate type + status */}
      <div className="flex flex-wrap items-center gap-2">
        <ConfidencePill level={confLevel} pct={conf} />
        <TypeChip type={candidate.candidate_type} />
        <span className="text-[11px] uppercase tracking-wider text-gray-500">{typeLabel}</span>
        {candidate.status !== "suggested" && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            candidate.status === "confirmed" ? "bg-emerald-500/15 text-emerald-300"
            : candidate.status === "rejected" ? "bg-rose-500/15 text-rose-300"
            : "bg-gray-500/15 text-gray-300"
          }`}>{candidate.status}</span>
        )}
        <span className="ml-auto text-[10px] text-gray-500">
          {new Date(candidate.suggested_at).toLocaleString()}
        </span>
      </div>

      {/* Reason summary */}
      <div className="mt-2 text-[13px] leading-snug text-[var(--text-primary)]">
        {candidate.match_reason_summary}
      </div>

      {/* Two-column comparison */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <SideCard
          eyebrow="Payment"
          title={p?.party_name ?? "—"}
          line1={p ? `${p.direction === "in" ? "Money in" : "Money out"} · ${p.payment_date} · ${p.payment_method ?? "—"}` : "—"}
          line2={p ? `Expected ${fmtMoney(expected, p.currency, { compact: true })}` : ""}
          accentTone={p?.direction === "in" ? "positive" : "negative"}
          href={`/finance/payments`}
        />
        <SideCard
          eyebrow="Bank movement"
          title={m?.counterparty_name ?? m?.bank_reference ?? "Bank movement"}
          line1={m ? `${m.direction === "inflow" ? "Inflow" : "Outflow"} · ${m.movement_date} · ${m.bank_reference ?? "no ref"}` : "—"}
          line2={m ? `Actual ${fmtMoney(actual, m.currency, { compact: true })}` : ""}
          accentTone={m?.direction === "inflow" ? "positive" : "negative"}
        />
      </div>

      {/* Difference bar — only when there's a real gap */}
      {Math.abs(diff) > 0.005 && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.04] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
          <span className="text-gray-500">Difference</span>
          <span className={`tabular-nums font-semibold ${diff > 0 ? "text-amber-300" : "text-rose-300"}`}>
            {diff > 0 ? "+" : "−"}{fmtMoney(Math.abs(diff), m?.currency ?? p?.currency ?? "USD", { compact: true })}
          </span>
        </div>
      )}

      {/* Factors + warnings */}
      {(candidate.matched_factors.length > 0 || candidate.warnings.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {candidate.matched_factors.map((f) => (
            <span key={f.key} className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              <RrIcon name="check" size={9} />
              {f.label}
            </span>
          ))}
          {candidate.warnings.map((w) => (
            <span
              key={w.key}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                w.severity === "risk"  ? "border-rose-500/25 bg-rose-500/10 text-rose-300" :
                w.severity === "watch" ? "border-amber-500/25 bg-amber-500/10 text-amber-300" :
                                          "border-white/[0.08] bg-white/[0.03] text-gray-400"
              }`}
              title={w.message}
            >
              <RrIcon name="info" size={9} />
              {w.message}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      {isActive && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onConfirm(candidate.id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/25 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 transition hover:bg-emerald-500/35 disabled:opacity-60"
          >
            {busy ? <RrIcon name="loading" size={11} className="animate-spin" /> : <RrIcon name="check" size={11} />}
            Confirm match
          </button>
          <button
            type="button"
            onClick={() => onReject(candidate.id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] font-medium text-gray-300 transition hover:border-rose-500/30 hover:text-rose-300 disabled:opacity-60"
          >
            <RrIcon name="cross" size={11} />
            Reject
          </button>
          <span className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
            <Link href="/finance/payments" className="inline-flex items-center gap-1 hover:text-gray-200">
              <RrIcon name="arrow-up-right-from-square" size={10} />
              Open payment
            </Link>
            <span className="text-gray-700">·</span>
            <Link href="/finance/payments" className="inline-flex items-center gap-1 hover:text-gray-200">
              <RrIcon name="arrow-up-right-from-square" size={10} />
              Open movement
            </Link>
          </span>
        </div>
      )}
    </div>
  );
});

/* ────────────────────────────────────────────────────────────────────────
   Atoms
   ──────────────────────────────────────────────────────────────────────── */

function ConfidencePill({ level, pct }: { level: ReconciliationConfidenceLevel; pct: number }) {
  const cls =
    level === "high"   ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/30" :
    level === "medium" ? "bg-amber-500/20 text-amber-200 border-amber-500/30"      :
                          "bg-slate-500/25 text-slate-100 border-slate-400/40";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      {pct}% <span className="text-[9px] uppercase tracking-wider opacity-80">{level}</span>
    </span>
  );
}

function TypeChip({ type }: { type: ReconciliationCandidateType }) {
  const cls =
    type === "exact"          ? "bg-emerald-500/15 text-emerald-300" :
    type === "partial"        ? "bg-amber-500/15 text-amber-300"      :
    type === "underpayment"   ? "bg-rose-500/15 text-rose-300"        :
    type === "overpayment"    ? "bg-sky-500/15 text-sky-300"          :
    type === "fee_adjusted"   ? "bg-violet-500/15 text-violet-300"    :
    type === "duplicate_risk" ? "bg-rose-500/15 text-rose-300"        :
                                "bg-gray-500/15 text-gray-300";
  const label =
    type === "duplicate_risk" ? "duplicate risk" :
    type === "fee_adjusted"   ? "fee adjusted"   :
    type;
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function SideCard({
  eyebrow, title, line1, line2, accentTone, href,
}: {
  eyebrow: string;
  title: string;
  line1: string;
  line2?: string;
  accentTone: "positive" | "negative";
  href?: string;
}) {
  const accent = accentTone === "positive" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="rounded-xl border border-white/[0.05] bg-[var(--bg-primary)]/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">{eyebrow}</span>
        {href && (
          <Link href={href} className="text-[10px] text-gray-500 hover:text-gray-200 inline-flex items-center gap-0.5">
            Open <RrIcon name="arrow-up-right-from-square" size={9} />
          </Link>
        )}
      </div>
      <div className="mt-1 truncate text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="mt-0.5 truncate text-[11px] text-gray-400">{line1}</div>
      {line2 && <div className={`mt-0.5 text-[11px] font-medium tabular-nums ${accent}`}>{line2}</div>}
    </div>
  );
}

const TYPE_LABELS: Record<ReconciliationCandidateType, string> = {
  exact:          "Same amount",
  partial:        "Partial settlement",
  underpayment:   "Bank short of payment",
  overpayment:    "Bank exceeds payment",
  fee_adjusted:   "Bank fee deducted",
  duplicate_risk: "Possible duplicate movement",
};
