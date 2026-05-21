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
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";
import { EmptyState, SectionCard } from "@/components/finance/FinanceUi";
import { MetricCard } from "@/components/finance/FinanceUiX";
import RrIcon from "@/components/ui/RrIcon";
import GuidanceTip from "@/components/ui/GuidanceTip";
import { fmtMoney } from "@/lib/finance/calc";
import { humanizeError } from "@/lib/ui/humanize-error";
import type {
  FinanceReconciliationCandidate,
  ReconciliationCandidateType,
  ReconciliationConfidenceLevel,
} from "@/lib/finance/types";

type FilterKey = "active" | "suggested" | "confirmed" | "rejected" | "all";

export default function FinanceReconciliation() {
  const { t } = useTranslation(financeT);
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
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
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
      if (!r.ok || !j.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
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
      if (!r.ok || !j.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(null);
    }
  }, [load, filter]);

  const reject = useCallback(async (id: string) => {
    const reason = window.prompt(t("reconciliation.rejectPrompt", "Why is this match wrong? (optional)")) ?? undefined;
    setActing(id);
    setError(null);
    try {
      const r = await fetch("/api/finance/reconciliation/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: id, rejection_reason: reason || undefined }),
      });
      const j = (await r.json().catch(() => ({}))) as { candidate?: unknown; error?: string };
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
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
          title={t("reconciliation.title", "Reconciliation Queue")}
          subtitle={t("reconciliation.subtitle.long", "Deterministic matches between payments and bank movements. You confirm; the engine never reconciles silently.")}
          action={
            <button
              type="button"
              onClick={rescan}
              disabled={rescanBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:opacity-60"
            >
              {rescanBusy ? (
                <>
                  <RrIcon name="loading" size={12} className="animate-spin" />
                  {t("reconciliation.scanning", "Scanning…")}
                </>
              ) : (
                <>
                  <RrIcon name="search" size={12} />
                  {t("reconciliation.rescan", "Rescan")}
                </>
              )}
            </button>
          }
        />

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label={t("reconciliation.kpi.queue", "In queue")}          value={kpi.total}  unit={t("reconciliation.kpi.cand", "cand.")} hint={t("reconciliation.kpi.queueHint", "Across the current filter")} loading={loading} />
          <MetricCard label={t("reconciliation.kpi.high", "High-confidence")}   value={kpi.high}   unit={t("reconciliation.kpi.cand", "cand.")} hint={t("reconciliation.kpi.highHint", "Same amount + same direction + tight timing")} loading={loading} />
          <MetricCard label={t("reconciliation.kpi.partial", "Partial / variance")} value={kpi.partial} unit={t("reconciliation.kpi.cand", "cand.")} hint={t("reconciliation.kpi.partialHint", "Partial, over- or under-payments")} loading={loading} />
          <MetricCard label={t("reconciliation.kpi.dup", "Duplicate risk")}    value={kpi.dups}   unit={t("reconciliation.kpi.cand", "cand.")} hint={t("reconciliation.kpi.dupHint", "Possible duplicate bank movement")} loading={loading} />
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
                  ? "border-[var(--border-strong)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] bg-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t(`reconciliation.filter.${k}`, k)}
            </button>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
            <span>{t("reconciliation.howWorks", "How matching works")}</span>
            <GuidanceTip guidanceId="treasury.unreconciled" />
          </span>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-600 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <SectionCard>
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-dim)]">
                <RrIcon name="loading" size={14} className="animate-spin" />
                {t("reconciliation.loading", "Loading queue…")}
              </div>
            </SectionCard>
          ) : candidates.length === 0 ? (
            <EmptyState
              title={t("reconciliation.empty.title", "No reconciliation suggestions yet")}
              hint={t("reconciliation.empty.hint", "The engine compares unreconciled bank movements against open payments. Run a rescan to refresh the queue.")}
              action={
                <button
                  onClick={rescan}
                  disabled={rescanBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-60"
                >
                  <RrIcon name="search" size={12} />
                  {t("reconciliation.empty.cta", "Rescan now")}
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
  const { t } = useTranslation(financeT);
  const p = candidate.payment ?? null;
  const m = candidate.cash_movement ?? null;
  const isActive = candidate.status === "suggested";

  const conf = Math.round(candidate.confidence * 100);
  const confLevel = candidate.confidence_level;

  const expected = Number(p?.expected_amount ?? p?.amount ?? 0);
  const actual = Number(m?.amount ?? 0);
  const diff = actual - expected;

  const TYPE_LABELS_LOCAL: Record<ReconciliationCandidateType, string> = {
    exact:          t("reconciliation.typeLabel.exact", "Same amount"),
    partial:        t("reconciliation.typeLabel.partial", "Partial settlement"),
    underpayment:   t("reconciliation.typeLabel.under", "Bank short of payment"),
    overpayment:    t("reconciliation.typeLabel.over", "Bank exceeds payment"),
    fee_adjusted:   t("reconciliation.typeLabel.fee", "Bank fee deducted"),
    duplicate_risk: t("reconciliation.typeLabel.dup", "Possible duplicate movement"),
  };
  const typeLabel = TYPE_LABELS_LOCAL[candidate.candidate_type];

  return (
    <div className={`rounded-2xl border bg-[var(--bg-secondary)] p-4 transition ${
      isActive
        ? "border-[var(--border-subtle)] hover:border-[var(--border-color)]"
        : "border-[var(--border-faint)] opacity-90"
    }`}
    >
      {/* Top row: confidence + candidate type + status */}
      <div className="flex flex-wrap items-center gap-2">
        <ConfidencePill level={confLevel} pct={conf} />
        <TypeChip type={candidate.candidate_type} />
        <span className="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">{typeLabel}</span>
        {candidate.status !== "suggested" && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            candidate.status === "confirmed" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
            : candidate.status === "rejected" ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
            : "bg-gray-500/15 text-[var(--text-highlight)]"
          }`}>{candidate.status}</span>
        )}
        <span className="ml-auto text-[10px] text-[var(--text-dim)]">
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
          eyebrow={t("reconciliation.side.payment", "Payment")}
          title={p?.party_name ?? "—"}
          line1={p ? `${p.direction === "in" ? t("reconciliation.side.in", "Money in") : t("reconciliation.side.out", "Money out")} · ${p.payment_date} · ${p.payment_method ?? "—"}` : "—"}
          line2={p ? t("reconciliation.side.expected", "Expected {value}").replace("{value}", fmtMoney(expected, p.currency, { compact: true })) : ""}
          accentTone={p?.direction === "in" ? "positive" : "negative"}
          href={`/finance/payments`}
        />
        <SideCard
          eyebrow={t("reconciliation.side.movement", "Bank movement")}
          title={m?.counterparty_name ?? m?.bank_reference ?? t("reconciliation.side.bankMovement", "Bank movement")}
          line1={m ? `${m.direction === "inflow" ? t("reconciliation.side.inflow", "Inflow") : t("reconciliation.side.outflow", "Outflow")} · ${m.movement_date} · ${m.bank_reference ?? t("reconciliation.side.noRef", "no ref")}` : "—"}
          line2={m ? t("reconciliation.side.actual", "Actual {value}").replace("{value}", fmtMoney(actual, m.currency, { compact: true })) : ""}
          accentTone={m?.direction === "inflow" ? "positive" : "negative"}
        />
      </div>

      {/* Difference bar — only when there's a real gap */}
      {Math.abs(diff) > 0.005 && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)]/40 px-3 py-2 text-[11px]">
          <span className="text-[var(--text-dim)]">{t("reconciliation.diff", "Difference")}</span>
          <span className={`tabular-nums font-semibold ${diff > 0 ? "text-amber-600 dark:text-amber-300" : "text-rose-600 dark:text-rose-300"}`}>
            {diff > 0 ? "+" : "−"}{fmtMoney(Math.abs(diff), m?.currency ?? p?.currency ?? "USD", { compact: true })}
          </span>
        </div>
      )}

      {/* Factors + warnings */}
      {(candidate.matched_factors.length > 0 || candidate.warnings.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {candidate.matched_factors.map((f) => (
            <span key={f.key} className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-300">
              <RrIcon name="check" size={9} />
              {f.label}
            </span>
          ))}
          {candidate.warnings.map((w) => (
            <span
              key={w.key}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                w.severity === "risk"  ? "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300" :
                w.severity === "watch" ? "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300" :
                                          "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]"
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/25 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-200 transition hover:bg-emerald-500/35 disabled:opacity-60"
          >
            {busy ? <RrIcon name="loading" size={11} className="animate-spin" /> : <RrIcon name="check" size={11} />}
            {t("reconciliation.confirm", "Confirm match")}
          </button>
          <button
            type="button"
            onClick={() => onReject(candidate.id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-highlight)] transition hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-300 disabled:opacity-60"
          >
            <RrIcon name="cross" size={11} />
            {t("reconciliation.reject", "Reject")}
          </button>
          <span className="ml-auto flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
            <Link href="/finance/payments" className="inline-flex items-center gap-1 hover:text-[var(--text-highlight)]">
              <RrIcon name="arrow-up-right-from-square" size={10} />
              {t("reconciliation.openPayment", "Open payment")}
            </Link>
            <span className="text-[var(--text-whisper)]">·</span>
            <Link href="/finance/payments" className="inline-flex items-center gap-1 hover:text-[var(--text-highlight)]">
              <RrIcon name="arrow-up-right-from-square" size={10} />
              {t("reconciliation.openMovement", "Open movement")}
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
    level === "high"   ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border-emerald-500/30" :
    level === "medium" ? "bg-amber-500/20 text-amber-700 dark:text-amber-200 border-amber-500/30"      :
                          "bg-slate-500/25 text-slate-100 border-slate-400/40";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>
      {pct}% <span className="text-[9px] uppercase tracking-wider opacity-80">{level}</span>
    </span>
  );
}

function TypeChip({ type }: { type: ReconciliationCandidateType }) {
  const { t } = useTranslation(financeT);
  const cls =
    type === "exact"          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" :
    type === "partial"        ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"      :
    type === "underpayment"   ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"        :
    type === "overpayment"    ? "bg-sky-500/15 text-sky-600 dark:text-sky-300"          :
    type === "fee_adjusted"   ? "bg-violet-500/15 text-violet-600 dark:text-violet-300"    :
    type === "duplicate_risk" ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"        :
                                "bg-gray-500/15 text-[var(--text-highlight)]";
  const label =
    type === "duplicate_risk" ? t("reconciliation.typeChip.dup", "duplicate risk") :
    type === "fee_adjusted"   ? t("reconciliation.typeChip.fee", "fee adjusted")   :
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
  const { t } = useTranslation(financeT);
  const accent = accentTone === "positive" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">{eyebrow}</span>
        {href && (
          <Link href={href} className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-highlight)] inline-flex items-center gap-0.5">
            {t("reconciliation.open", "Open")} <RrIcon name="arrow-up-right-from-square" size={9} />
          </Link>
        )}
      </div>
      <div className="mt-1 truncate text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
      <div className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{line1}</div>
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
