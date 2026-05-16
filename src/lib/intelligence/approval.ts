/* ===========================================================================
   Approval Intelligence Engine  —  Phase 2.2.1

   Reads the Phase-2.2 approval columns on finance_expenses and produces:

     · aging buckets         (<1d / 1-3d / 4-7d / 8-14d / 14+d)
     · backlog summary       (count + value + oldest waiting days)
     · reviewer workload     (per-reviewer pending count / value / avg latency)
     · cycle metrics         (avg submit→approve, PoP trend, rejection rate)
     · operational events    (approval_backlog, review_delay, …)
     · composite health      (0..100)

   No new APIs. Operates entirely on FinanceExpense[] the dashboard
   already loads. Pure functions; the orchestrator threads them into
   the global event stream, the executive digest, and the Copilot.

   Discipline rules:
     · materially-trivial signals are dropped before they leave.
     · narratives anchor on real numbers; no filler phrases.
     · single-reviewer / single-day moves don't fire events.
   ========================================================================== */

import type { ApprovalStatus, FinanceExpense } from "@/lib/finance/types";
import type {
  ApprovalAgingBucket,
  ApprovalAgingBucketKey,
  ApprovalCycleMetrics,
  ApprovalIntelligenceSnapshot,
  OperationalEvent,
  Pressure,
  ReviewerWorkload,
  Severity,
} from "./types";
import { clamp01, daysBetween, daysFromToday, mean, safePct, stableId } from "./behavior";

/* ---------------------------------------------------------------------------
   Constants
   --------------------------------------------------------------------------- */

const PENDING_STATUSES: ReadonlySet<ApprovalStatus> = new Set([
  "submitted",
  "under_review",
  "requires_changes",
]);

const NOW = () => Date.now();

/* ---------------------------------------------------------------------------
   Aging
   --------------------------------------------------------------------------- */

const AGING_LABEL: Record<ApprovalAgingBucketKey, string> = {
  lt_1d:    "< 1 d",
  "1_3d":   "1–3 d",
  "4_7d":   "4–7 d",
  "8_14d":  "8–14 d",
  "14_plus": "14+ d",
};

function bucketForDays(days: number): ApprovalAgingBucketKey {
  if (days < 1) return "lt_1d";
  if (days <= 3) return "1_3d";
  if (days <= 7) return "4_7d";
  if (days <= 14) return "8_14d";
  return "14_plus";
}

function waitingDays(e: FinanceExpense): number {
  /* Time since the work landed in a reviewer's queue. Prefer the most
     recent meaningful timestamp:
       requires_changes → reviewed_at (when we sent it back)
       submitted/under_review → submitted_at
     Fall back to submitted_at, then created/updated_at. */
  const candidate =
    e.approval_status === "requires_changes" ? (e.reviewed_at ?? e.submitted_at)
    : (e.submitted_at ?? e.reviewed_at ?? e.created_at ?? null);
  if (!candidate) return 0;
  const d = daysFromToday(candidate);
  return d == null ? 0 : Math.max(0, -d);
}

/* ---------------------------------------------------------------------------
   Workload
   --------------------------------------------------------------------------- */

function resolveReviewerId(e: FinanceExpense): string {
  /* Pending items waiting on someone: prefer the reviewer currently
     responsible for the next move. For submitted/under_review that's
     reviewed_by (the manager already touched it) or approved_by
     candidate; if neither is set we attribute to "unassigned". For
     requires_changes the *submitter* is the next-mover, so we
     attribute that pile to submitted_by — the operator owns the
     resubmit. */
  if (e.approval_status === "requires_changes") return e.submitted_by ?? "unassigned";
  return e.reviewed_by ?? e.approved_by ?? "unassigned";
}

/* ---------------------------------------------------------------------------
   Cycle metrics
   --------------------------------------------------------------------------- */

function cycleMetrics(expenses: FinanceExpense[], periodDays: number): ApprovalCycleMetrics {
  /* Two windows of terminal decisions, by approved_at OR rejected_at,
     in the current and prior period of length `periodDays`. */
  type Decision = { cycleDays: number; rejected: boolean; daysFromNow: number };
  const decisions: Decision[] = [];
  for (const e of expenses) {
    const decisionTs = e.approved_at ?? e.rejected_at;
    if (!decisionTs || !e.submitted_at) continue;
    const cycleDays = daysBetween(decisionTs, e.submitted_at);
    if (cycleDays == null || cycleDays < 0) continue;
    const days = daysFromToday(decisionTs);
    if (days == null) continue;
    decisions.push({ cycleDays, rejected: !!e.rejected_at, daysFromNow: days });
  }
  const current = decisions.filter((d) => d.daysFromNow >= -periodDays && d.daysFromNow <= 0);
  const prior   = decisions.filter((d) => d.daysFromNow >= -2 * periodDays && d.daysFromNow < -periodDays);

  const avgCycleDays      = mean(current.map((d) => d.cycleDays));
  const priorAvgCycleDays = mean(prior.map((d) => d.cycleDays));
  const trendPct          = safePct(avgCycleDays, priorAvgCycleDays);
  const decisionsCurrent  = current.length;
  const rejectionRate     = decisionsCurrent === 0
    ? 0
    : current.filter((d) => d.rejected).length / decisionsCurrent;

  /* Changes-rate approximated from currently-changes-requested items
     vs the period's pending+terminal volume. */
  const changesNow = expenses.filter((e) => e.approval_status === "requires_changes").length;
  const totalNow   = expenses.filter((e) => e.approval_status && e.approval_status !== "draft").length;
  const changesRate = totalNow === 0 ? 0 : changesNow / totalNow;

  return {
    avgCycleDays:      Math.round(avgCycleDays * 10) / 10,
    priorAvgCycleDays: Math.round(priorAvgCycleDays * 10) / 10,
    trendPct:          Math.round(trendPct * 10) / 10,
    rejectionRate:     Math.round(rejectionRate * 100) / 100,
    changesRate:       Math.round(changesRate * 100) / 100,
  };
}

/* ---------------------------------------------------------------------------
   Events
   --------------------------------------------------------------------------- */

interface EventCtx {
  pendingTotalValue: number;
  pendingCount: number;
  oldestWait: number;
  topReviewerName: string;
  topReviewerShare: number;
  topReviewerPending: number;
  topReviewerValue: number;
  changesRate: number;
  cycle: ApprovalCycleMetrics;
}

function buildEvents(ctx: EventCtx, expenses: FinanceExpense[]): OperationalEvent[] {
  const out: OperationalEvent[] = [];
  const now = NOW();

  /* 1) Backlog — count + value. Materially we need ≥ 5 items AND value
        ≥ USD 5K, OR ≥ 10 items regardless of value. */
  if ((ctx.pendingCount >= 5 && ctx.pendingTotalValue >= 5_000) || ctx.pendingCount >= 10) {
    const severity: Severity =
      ctx.pendingCount >= 20 || ctx.pendingTotalValue >= 100_000 ? "risk"
      : ctx.pendingCount >= 10 ? "watch"
      : "watch";
    out.push({
      key: stableId(["approval-backlog"]),
      source: "approval",
      kind: "approval_backlog",
      severity,
      magnitude: ctx.pendingCount,
      amount: ctx.pendingTotalValue,
      label: `Approval backlog · ${ctx.pendingCount} pending`,
      detail: `${ctx.pendingCount} expense${ctx.pendingCount === 1 ? "" : "s"} awaiting review, totalling ${formatCompact(ctx.pendingTotalValue)} USD.`,
      ts: now,
    });
  }

  /* 2) Review delay — surface the *oldest* waiting item if it's been
        in queue ≥ 7 days. We don't enumerate every aging item — the
        aging table covers that. We emit one summary event for the
        worst offender so the Copilot can speak to it. */
  if (ctx.oldestWait >= 7) {
    /* Find the actual oldest pending item (highest value when there's
       a tie on age — operationally that's what gets attention). */
    const oldest = [...expenses]
      .filter((e) => PENDING_STATUSES.has((e.approval_status ?? "draft") as ApprovalStatus))
      .map((e) => ({ e, w: waitingDays(e), v: Number(e.amount) || 0 }))
      .sort((a, b) => b.w - a.w || b.v - a.v)[0];
    if (oldest) {
      const severity: Severity =
        oldest.w >= 21 ? "risk"
        : oldest.w >= 14 ? "watch"
        : "watch";
      out.push({
        key: stableId(["review-delay", oldest.e.id]),
        source: "approval",
        kind: "review_delay",
        severity,
        entity: { type: "expense", id: oldest.e.id, name: oldest.e.title },
        magnitude: oldest.w,
        amount: oldest.v,
        label: `${oldest.e.title || "Expense"} · ${Math.round(oldest.w)}d in review`,
        detail: `Awaiting review for ${Math.round(oldest.w)} days at ${formatCompact(oldest.v)} USD. Operational latency on the review path.`,
        ts: now,
      });
    }
  }

  /* 3) Reviewer concentration — single reviewer owns ≥ 60% of backlog
        AND backlog is at least 5 items (avoids trivial-concentration
        false positives in tiny inboxes). */
  if (
    ctx.topReviewerShare >= 0.6 &&
    ctx.pendingCount >= 5 &&
    ctx.topReviewerName !== "Unassigned"
  ) {
    const severity: Severity = ctx.topReviewerShare >= 0.8 ? "risk" : "watch";
    out.push({
      key: stableId(["approval-concentration", ctx.topReviewerName]),
      source: "approval",
      kind: "approval_concentration",
      severity,
      magnitude: Math.round(ctx.topReviewerShare * 100),
      amount: ctx.topReviewerValue,
      label: `${ctx.topReviewerName} · ${Math.round(ctx.topReviewerShare * 100)}% of review queue`,
      detail: `${ctx.topReviewerName} carries ${ctx.topReviewerPending} of ${ctx.pendingCount} pending reviews (${formatCompact(ctx.topReviewerValue)} USD). Reviewer-bandwidth single point of failure.`,
      ts: now,
    });
  }

  /* 4) Approval velocity drop — current cycle ≥ 50% slower than prior,
        AND current cycle ≥ 4 days (we don't flag a slowdown from 0.5d
        to 1d as material). */
  if (ctx.cycle.trendPct >= 50 && ctx.cycle.avgCycleDays >= 4) {
    const severity: Severity = ctx.cycle.trendPct >= 100 ? "risk" : "watch";
    out.push({
      key: stableId(["approval-velocity"]),
      source: "approval",
      kind: "approval_velocity_drop",
      severity,
      direction: "up",
      magnitude: ctx.cycle.trendPct,
      label: `Approval cycle ${ctx.cycle.avgCycleDays.toFixed(1)}d (↑ ${ctx.cycle.trendPct.toFixed(0)}%)`,
      detail: `Average submit-to-decision time is ${ctx.cycle.avgCycleDays.toFixed(1)} days versus ${ctx.cycle.priorAvgCycleDays.toFixed(1)} days in the prior period.`,
      ts: now,
    });
  }

  /* 5) Unresolved changes — items sitting in requires_changes
        for ≥ 5 days without resubmit. */
  const stalledChanges = expenses.filter((e) =>
    e.approval_status === "requires_changes" && waitingDays(e) >= 5,
  );
  if (stalledChanges.length >= 2 || (stalledChanges.length >= 1 && stalledChanges[0] && waitingDays(stalledChanges[0]) >= 10)) {
    const totalValue = stalledChanges.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const severity: Severity = stalledChanges.length >= 5 ? "risk" : "watch";
    out.push({
      key: stableId(["unresolved-changes"]),
      source: "approval",
      kind: "unresolved_changes_request",
      severity,
      magnitude: stalledChanges.length,
      amount: totalValue,
      label: `${stalledChanges.length} change request${stalledChanges.length === 1 ? "" : "s"} unresolved`,
      detail: `${stalledChanges.length} expense${stalledChanges.length === 1 ? "" : "s"} sitting in "changes requested" for ≥ 5 days, ${formatCompact(totalValue)} USD frozen pending operator response.`,
      ts: now,
    });
  }

  /* 6) Repeated rejection — rejection rate ≥ 30% AND ≥ 5 decisions in
        the current period. (Too few decisions = noisy ratio.) */
  if (ctx.cycle.rejectionRate >= 0.3) {
    const rejectedCount = expenses.filter((e) => e.approval_status === "rejected").length;
    if (rejectedCount >= 5) {
      const severity: Severity = ctx.cycle.rejectionRate >= 0.5 ? "risk" : "watch";
      out.push({
        key: stableId(["repeated-rejection"]),
        source: "approval",
        kind: "repeated_rejection",
        severity,
        magnitude: Math.round(ctx.cycle.rejectionRate * 100),
        label: `Rejection rate ${(ctx.cycle.rejectionRate * 100).toFixed(0)}%`,
        detail: `${(ctx.cycle.rejectionRate * 100).toFixed(0)}% of review decisions ended in rejection this period — recurring quality issue at submission time.`,
        ts: now,
      });
    }
  }

  return out;
}

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000)     return sign + (abs / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
  return sign + abs.toFixed(0);
}

/* ---------------------------------------------------------------------------
   Health scoring  —  pure function of the snapshot's own metrics
   --------------------------------------------------------------------------- */

function scoreFromSnapshot(args: {
  pendingCount: number;
  oldestWait: number;
  topReviewerShare: number;
  rejectionRate: number;
  cycleTrendPct: number;
  unresolvedChanges: number;
}): { score: number; pressure: Pressure } {
  let score = 100;
  /* Backlog damage — gentle until ~20 pending, then steep. */
  if (args.pendingCount >= 20) score -= 18;
  else if (args.pendingCount >= 10) score -= 10;
  else if (args.pendingCount >= 5)  score -= 4;
  /* Oldest-wait damage. */
  if (args.oldestWait >= 21) score -= 18;
  else if (args.oldestWait >= 14) score -= 12;
  else if (args.oldestWait >= 7)  score -= 6;
  /* Concentration damage. */
  if (args.topReviewerShare >= 0.85) score -= 14;
  else if (args.topReviewerShare >= 0.7) score -= 8;
  /* Rejection rate damage. */
  if (args.rejectionRate >= 0.5) score -= 14;
  else if (args.rejectionRate >= 0.3) score -= 8;
  /* Cycle velocity damage. */
  if (args.cycleTrendPct >= 100) score -= 12;
  else if (args.cycleTrendPct >= 50) score -= 6;
  /* Unresolved-changes damage. */
  if (args.unresolvedChanges >= 5) score -= 10;
  else if (args.unresolvedChanges >= 2) score -= 4;

  score = clamp01(score);
  const pressure: Pressure =
    score < 40 ? "critical"
    : score < 60 ? "risk"
    : score < 80 ? "watch"
    : "calm";
  return { score: Math.round(score), pressure };
}

/* ---------------------------------------------------------------------------
   Public API
   --------------------------------------------------------------------------- */

export function buildApprovalSnapshot(
  expenses: FinanceExpense[],
  periodDays = 90,
): ApprovalIntelligenceSnapshot {
  /* ── Aging ──────────────────────────────────────────── */
  const buckets: Record<ApprovalAgingBucketKey, ApprovalAgingBucket> = {
    lt_1d:    { key: "lt_1d",    label: AGING_LABEL.lt_1d,    count: 0, totalValue: 0 },
    "1_3d":   { key: "1_3d",     label: AGING_LABEL["1_3d"],  count: 0, totalValue: 0 },
    "4_7d":   { key: "4_7d",     label: AGING_LABEL["4_7d"],  count: 0, totalValue: 0 },
    "8_14d":  { key: "8_14d",    label: AGING_LABEL["8_14d"], count: 0, totalValue: 0 },
    "14_plus": { key: "14_plus", label: AGING_LABEL["14_plus"], count: 0, totalValue: 0 },
  };
  const pendingExpenses = expenses.filter((e) =>
    PENDING_STATUSES.has((e.approval_status ?? "draft") as ApprovalStatus));
  let pendingValue = 0;
  let oldestWait = 0;
  for (const e of pendingExpenses) {
    const w = waitingDays(e);
    const v = Number(e.amount) || 0;
    const b = bucketForDays(w);
    buckets[b].count += 1;
    buckets[b].totalValue += v;
    pendingValue += v;
    if (w > oldestWait) oldestWait = w;
  }
  const aging: ApprovalAgingBucket[] = Object.values(buckets);

  /* ── Workload ───────────────────────────────────────── */
  const reviewerMap = new Map<string, ReviewerWorkload>();
  const ensure = (id: string, name: string): ReviewerWorkload => {
    let r = reviewerMap.get(id);
    if (!r) {
      r = {
        reviewerId: id,
        reviewerName: name,
        pendingCount: 0,
        pendingValue: 0,
        approvedCount: 0,
        rejectedCount: 0,
        avgLatencyDays: 0,
        backlogShare: 0,
      };
      reviewerMap.set(id, r);
    }
    return r;
  };
  /* Pending side — attribute by next-mover. */
  for (const e of pendingExpenses) {
    const rid = resolveReviewerId(e);
    const name = rid === "unassigned" ? "Unassigned" : (rid.slice(0, 8) + "…");
    const w = ensure(rid, name);
    w.pendingCount += 1;
    w.pendingValue += Number(e.amount) || 0;
  }
  /* Decision-side metrics — for users who approved/rejected. */
  const latencyAcc = new Map<string, number[]>();
  for (const e of expenses) {
    if (e.approved_at && e.approved_by) {
      const rid = e.approved_by;
      const name = rid.slice(0, 8) + "…";
      const w = ensure(rid, name);
      w.approvedCount += 1;
      if (e.submitted_at) {
        const d = daysBetween(e.approved_at, e.submitted_at);
        if (d != null && d >= 0) {
          const arr = latencyAcc.get(rid) ?? [];
          arr.push(d);
          latencyAcc.set(rid, arr);
        }
      }
    }
    if (e.rejected_at && e.rejected_by) {
      const rid = e.rejected_by;
      const name = rid.slice(0, 8) + "…";
      const w = ensure(rid, name);
      w.rejectedCount += 1;
    }
  }
  for (const [rid, arr] of latencyAcc) {
    const w = reviewerMap.get(rid);
    if (w) w.avgLatencyDays = Math.round(mean(arr) * 10) / 10;
  }
  /* Compute backlog shares. */
  const totalBacklog = Math.max(1, pendingExpenses.length);
  for (const r of reviewerMap.values()) {
    r.backlogShare = r.pendingCount / totalBacklog;
  }
  const workload = Array.from(reviewerMap.values()).sort((a, b) => b.pendingCount - a.pendingCount);
  const top = workload[0];

  /* ── Cycle metrics ──────────────────────────────────── */
  const cycle = cycleMetrics(expenses, periodDays);

  /* ── Health ─────────────────────────────────────────── */
  const unresolvedChanges = expenses.filter((e) =>
    e.approval_status === "requires_changes" && waitingDays(e) >= 5).length;
  const { score, pressure } = scoreFromSnapshot({
    pendingCount: pendingExpenses.length,
    oldestWait,
    topReviewerShare: top?.backlogShare ?? 0,
    rejectionRate: cycle.rejectionRate,
    cycleTrendPct: cycle.trendPct,
    unresolvedChanges,
  });

  /* ── Events ─────────────────────────────────────────── */
  const events = buildEvents({
    pendingTotalValue: pendingValue,
    pendingCount: pendingExpenses.length,
    oldestWait,
    topReviewerName: top?.reviewerName ?? "—",
    topReviewerShare: top?.backlogShare ?? 0,
    topReviewerPending: top?.pendingCount ?? 0,
    topReviewerValue: top?.pendingValue ?? 0,
    changesRate: cycle.changesRate,
    cycle,
  }, expenses);

  /* ── Read narrative ─────────────────────────────────── */
  const read = (() => {
    if (pendingExpenses.length === 0) return "";
    const bits: string[] = [];
    bits.push(`${pendingExpenses.length} pending review${pendingExpenses.length === 1 ? "" : "s"}, ${formatCompact(pendingValue)} USD held.`);
    if (oldestWait >= 7) bits.push(`Oldest waiting ${Math.round(oldestWait)} days.`);
    if ((top?.backlogShare ?? 0) >= 0.6 && top && top.reviewerName !== "Unassigned") {
      bits.push(`${top.reviewerName} carrying ${Math.round((top.backlogShare ?? 0) * 100)}% of the queue.`);
    }
    if (cycle.trendPct >= 50 && cycle.avgCycleDays >= 4) {
      bits.push(`Cycle time ${cycle.avgCycleDays.toFixed(1)}d (↑ ${cycle.trendPct.toFixed(0)}%).`);
    }
    return bits.join(" ");
  })();

  return {
    events,
    aging,
    backlog: {
      count: pendingExpenses.length,
      totalValue: Math.round(pendingValue),
      oldestDays: Math.round(oldestWait),
    },
    workload,
    cycle,
    healthScore: score,
    pressure,
    read,
  };
}
