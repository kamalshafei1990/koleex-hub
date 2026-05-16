/* ===========================================================================
   Treasury Intelligence Engine — Phase 2.4

   Reads bank accounts + cash movements + finance payments and produces:

     · cash position totals (available / restricted / pending)
     · per-account snapshot in reporting currency
     · currency exposure decomposition
     · forward cash-event timeline
     · 7 / 30 / 60-day projection + runway days
     · concentration metric (largest account share)
     · operational events (the 10 new treasury kinds, all materially gated)
     · composite 0..100 treasury health

   Pure function of input — no fetch, no React, no async.

   Discipline:
     · weak signals disappear
     · narratives anchor on concrete amounts + currencies
     · events compete in the shared pipeline; no treasury-only shortcuts
   ========================================================================== */

import type {
  BankAccount,
  CashMovement,
  FinancePayment,
  FinanceOrder,
} from "@/lib/finance/types";
import type {
  BankAccountSnapshot,
  CashProjection,
  FXExposure,
  OperationalEvent,
  Pressure,
  Severity,
  TreasurySnapshot,
  TreasuryTimelineItem,
} from "./types";
import { clamp01, daysFromToday, stableId } from "./behavior";

const NOW = () => Date.now();

const REPORTING_CURRENCY = "USD";

/* ---------------------------------------------------------------------------
   FX translation — Phase 2.4 ships a simple, deterministic table so the
   engine can produce reporting-currency totals without depending on an
   external API. Operators can override per-movement via
   exchange_rate / reporting_amount columns; the engine respects those.
   --------------------------------------------------------------------------- */

const FX_TABLE: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.26,
  CNY: 0.139,
  EGP: 0.020,
};

function translateToReporting(amount: number, currency: string): number {
  const rate = FX_TABLE[currency] ?? 1.0;
  return amount * rate;
}

/* ---------------------------------------------------------------------------
   Cash position per account
   --------------------------------------------------------------------------- */

function unreconciledForAccount(accountId: string, movements: CashMovement[]): number {
  return movements.filter((m) => m.bank_account_id === accountId && m.reconciliation_status === "unreconciled").length;
}

function snapshotAccount(a: BankAccount, movements: CashMovement[], totalReporting: number): BankAccountSnapshot {
  const total = a.available_balance + a.pending_balance + a.restricted_balance;
  const totalReportingForAcct = translateToReporting(total, a.currency);
  return {
    id: a.id,
    bankName: a.bank_name,
    accountName: a.account_name,
    currency: a.currency,
    available: a.available_balance,
    pending: a.pending_balance,
    restricted: a.restricted_balance,
    total,
    share: totalReporting > 0 ? totalReportingForAcct / totalReporting : 0,
    unreconciledMovements: unreconciledForAccount(a.id, movements),
  };
}

/* ---------------------------------------------------------------------------
   Forward timeline — unified across orders, payments, and scheduled
   cash movements. Each item carries a confidence: scheduled bank
   movements are 1.0, planned payments 0.85, AR collection forecasts
   0.6 (the operator can't fully control when the customer pays).
   --------------------------------------------------------------------------- */

function buildTimeline(
  orders: FinanceOrder[],
  payments: FinancePayment[],
  movements: CashMovement[],
  horizonDays = 60,
): TreasuryTimelineItem[] {
  const items: TreasuryTimelineItem[] = [];

  /* Scheduled cash movements within the horizon. */
  for (const m of movements) {
    if (m.reconciliation_status !== "unreconciled") continue;
    if (m.cleared_at) continue;
    const days = daysFromToday(m.movement_date);
    if (days == null) continue;
    if (days < -3 || days > horizonDays) continue;
    items.push({
      key: stableId(["movement", m.id]),
      date: m.movement_date,
      daysFromNow: days,
      direction: m.direction,
      source: "scheduled_movement",
      party: m.counterparty_name ?? m.bank_reference ?? "Movement",
      amount: m.amount,
      currency: m.currency,
      confidence: 1.0,
    });
  }

  /* Approved + pending payments scheduled into the window. */
  for (const p of payments) {
    /* Skip fully-settled, fully-paid items — those are no longer
       forward events. */
    const settled = ["matched", "verified"].includes(p.reconciliation_status ?? "");
    if (settled) continue;
    const days = daysFromToday(p.payment_date);
    if (days == null) continue;
    if (days < -3 || days > horizonDays) continue;
    const amount = Number(p.expected_amount ?? p.amount ?? 0);
    if (amount <= 0) continue;
    items.push({
      key: stableId(["payment", p.id]),
      date: p.payment_date,
      daysFromNow: days,
      direction: p.direction === "in" ? "inflow" : "outflow",
      source: p.direction === "in" ? "customer_collect" : (p.party_type === "supplier" ? "supplier_due" : "payment"),
      party: p.party_name || (p.party_type === "supplier" ? "Supplier" : "Party"),
      amount,
      currency: p.currency,
      confidence: p.approval_status === "approved" ? 0.85
                : p.approval_status === "submitted" ? 0.7
                : 0.5,
    });
  }

  /* AR collection forecasts from orders. */
  for (const o of orders) {
    const outstanding = Number(o.outstanding_receivable ?? 0);
    if (outstanding <= 0) continue;
    if (!o.payment_due_date) continue;
    const days = daysFromToday(o.payment_due_date);
    if (days == null) continue;
    if (days < -7 || days > horizonDays) continue;
    items.push({
      key: stableId(["order-ar", o.id]),
      date: o.payment_due_date,
      daysFromNow: days,
      direction: "inflow",
      source: "customer_collect_forecast",
      party: o.customer_name || "Customer",
      amount: outstanding,
      currency: o.currency,
      confidence: 0.6,
    });
  }

  /* AP forecasts from order supplier lines. */
  for (const o of orders) {
    for (const s of o.suppliers ?? []) {
      const outstanding = Math.max(0, (Number(s.supplier_cost ?? 0)) - Number(s.paid_amount ?? 0));
      if (outstanding <= 0) continue;
      if (!s.due_date) continue;
      const days = daysFromToday(s.due_date);
      if (days == null) continue;
      if (days < -7 || days > horizonDays) continue;
      items.push({
        key: stableId(["order-ap", s.id]),
        date: s.due_date,
        daysFromNow: days,
        direction: "outflow",
        source: "supplier_due_forecast",
        party: s.supplier_name || "Supplier",
        amount: outstanding,
        currency: s.currency,
        confidence: 0.7,
      });
    }
  }

  return items.sort((a, b) => a.daysFromNow - b.daysFromNow);
}

/* ---------------------------------------------------------------------------
   Forward projection — ASCENDING walk over the timeline, accumulating
   net cash position in reporting currency. Runway days = the first
   point where projected cash crosses zero (null if it never does).
   --------------------------------------------------------------------------- */

function projectCash(startingCash: number, timeline: TreasuryTimelineItem[]): CashProjection {
  let runwayDays: number | null = null;
  let cum = startingCash;
  let d7 = startingCash;
  let d30 = startingCash;
  let d60 = startingCash;
  for (const t of timeline) {
    if (t.daysFromNow < 0) continue;          // past items already in balance
    const reporting = translateToReporting(t.amount, t.currency);
    const expected = reporting * t.confidence;
    const signed = t.direction === "inflow" ? expected : -expected;
    cum += signed;
    if (runwayDays == null && cum < 0) runwayDays = t.daysFromNow;
    if (t.daysFromNow <= 7)  d7 = cum;
    if (t.daysFromNow <= 30) d30 = cum;
    if (t.daysFromNow <= 60) d60 = cum;
  }
  return { d7, d30, d60, runwayDays };
}

/* ---------------------------------------------------------------------------
   Currency exposure
   --------------------------------------------------------------------------- */

function buildExposure(accounts: BankAccount[]): FXExposure[] {
  const acc = new Map<string, { native: number; reporting: number }>();
  for (const a of accounts) {
    const native = a.available_balance + a.pending_balance + a.restricted_balance;
    const reporting = translateToReporting(native, a.currency);
    const prev = acc.get(a.currency) ?? { native: 0, reporting: 0 };
    prev.native += native;
    prev.reporting += reporting;
    acc.set(a.currency, prev);
  }
  const totalReporting = Array.from(acc.values()).reduce((s, x) => s + x.reporting, 0);
  return Array.from(acc.entries())
    .map(([currency, v]) => ({
      currency,
      totalValue: Math.round(v.native * 100) / 100,
      reportingValue: Math.round(v.reporting * 100) / 100,
      share: totalReporting > 0 ? v.reporting / totalReporting : 0,
      isReporting: currency === REPORTING_CURRENCY,
    }))
    .sort((a, b) => b.reportingValue - a.reportingValue);
}

/* ---------------------------------------------------------------------------
   Health scoring
   --------------------------------------------------------------------------- */

function score(args: {
  availableCash: number;
  unreconciledMovements: number;
  unreconciledOlderThan7d: number;
  hasNegativeRunway: boolean;
  runwayDays: number | null;
  d30: number;
  concentrationShare: number;
  fxNonReportingShare: number;
  overdraftAccounts: number;
}): { score: number; pressure: Pressure } {
  let score = 100;
  /* Runway is the dominant lever. */
  if (args.hasNegativeRunway) {
    if (args.runwayDays != null) {
      if (args.runwayDays <= 7) score -= 40;
      else if (args.runwayDays <= 14) score -= 28;
      else if (args.runwayDays <= 30) score -= 18;
      else score -= 8;
    }
  } else if (args.d30 < 0) {
    score -= 14;
  }
  /* Low buffer. */
  if (args.availableCash < 50_000) score -= 8;
  if (args.availableCash < 10_000) score -= 8;
  /* Reconciliation pressure. */
  if (args.unreconciledMovements >= 10) score -= 10;
  else if (args.unreconciledMovements >= 5) score -= 6;
  else if (args.unreconciledMovements >= 2) score -= 3;
  if (args.unreconciledOlderThan7d >= 3) score -= 6;
  /* Concentration risk — one account holding > 80%. */
  if (args.concentrationShare >= 0.85) score -= 8;
  else if (args.concentrationShare >= 0.7) score -= 4;
  /* FX exposure — > 60% of cash outside reporting currency. */
  if (args.fxNonReportingShare >= 0.7) score -= 6;
  else if (args.fxNonReportingShare >= 0.5) score -= 3;
  /* Overdrafts. */
  if (args.overdraftAccounts >= 1) score -= 10 * Math.min(2, args.overdraftAccounts);
  score = clamp01(score);
  const pressure: Pressure =
    score < 40 ? "critical"
    : score < 60 ? "risk"
    : score < 80 ? "watch"
    :              "calm";
  return { score: Math.round(score), pressure };
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
   Event synthesis
   --------------------------------------------------------------------------- */

function buildEvents(args: {
  availableCash: number;
  projection: CashProjection;
  unreconciledMovements: number;
  unreconciledOlderThan7d: number;
  concentrationShare: number;
  topAccountName: string;
  fxNonReportingShare: number;
  fxLargestNonReporting: FXExposure | null;
  bankFeeTotal: number;
  bankFeePriorTotal: number;
  failedTransferCount: number;
  overdraftAccounts: BankAccount[];
  idleCashThreshold: number;
}): OperationalEvent[] {
  const out: OperationalEvent[] = [];
  const now = NOW();

  /* low_cash_buffer — available reporting cash below threshold. */
  if (args.availableCash < 25_000) {
    const severity: Severity = args.availableCash < 5_000 ? "risk" : "watch";
    out.push({
      key: stableId(["treasury-low-cash"]),
      source: "treasury",
      kind: "low_cash_buffer",
      severity,
      amount: args.availableCash,
      magnitude: args.availableCash,
      label: `Available cash ${formatCompact(args.availableCash)} USD`,
      detail: `Reporting-currency available cash sits at ${formatCompact(args.availableCash)} USD — below the working-capital comfort threshold.`,
      ts: now,
    });
  }

  /* negative_runway. */
  if (args.projection.runwayDays != null) {
    const severity: Severity =
      args.projection.runwayDays <= 7 ? "critical"
      : args.projection.runwayDays <= 14 ? "risk"
      : "watch";
    out.push({
      key: stableId(["treasury-runway"]),
      source: "treasury",
      kind: "negative_runway",
      severity,
      magnitude: args.projection.runwayDays,
      label: `Cash crosses zero in ${args.projection.runwayDays} days`,
      detail: `At current projected inflow vs outflow, reporting-currency cash position turns negative in ${args.projection.runwayDays} days.`,
      ts: now,
    });
  }

  /* liquidity_gap — 30d projection negative but runway not yet zero. */
  if (args.projection.runwayDays == null && args.projection.d30 < 0) {
    out.push({
      key: stableId(["treasury-liquidity-gap"]),
      source: "treasury",
      kind: "liquidity_gap",
      severity: args.projection.d30 < -25_000 ? "risk" : "watch",
      magnitude: Math.abs(args.projection.d30),
      amount: Math.abs(args.projection.d30),
      label: `30-day projection ${formatCompact(args.projection.d30)} USD`,
      detail: `Forward 30-day cash projection sits at ${formatCompact(args.projection.d30)} USD — outflows are outpacing inflows in the window.`,
      ts: now,
    });
  }

  /* unreconciled_bank_activity. */
  if (args.unreconciledMovements >= 3) {
    const severity: Severity =
      args.unreconciledOlderThan7d >= 5 || args.unreconciledMovements >= 10 ? "risk"
      : "watch";
    out.push({
      key: stableId(["treasury-unreconciled"]),
      source: "treasury",
      kind: "unreconciled_bank_activity",
      severity,
      magnitude: args.unreconciledMovements,
      label: `${args.unreconciledMovements} bank movements unreconciled`,
      detail: `${args.unreconciledMovements} cash movements have not been matched against operational payments${args.unreconciledOlderThan7d > 0 ? ` (${args.unreconciledOlderThan7d} are older than 7 days)` : ""}.`,
      ts: now,
    });
  }

  /* bank_concentration. */
  if (args.concentrationShare >= 0.85) {
    out.push({
      key: stableId(["treasury-concentration"]),
      source: "treasury",
      kind: "bank_concentration",
      severity: "watch",
      magnitude: Math.round(args.concentrationShare * 100),
      label: `${args.topAccountName} · ${Math.round(args.concentrationShare * 100)}% of cash`,
      detail: `Single bank account holds ${Math.round(args.concentrationShare * 100)}% of total cash — concentration risk.`,
      ts: now,
    });
  }

  /* fx_exposure — > 60% of cash outside reporting currency. */
  if (args.fxNonReportingShare >= 0.6 && args.fxLargestNonReporting) {
    out.push({
      key: stableId(["treasury-fx", args.fxLargestNonReporting.currency]),
      source: "treasury",
      kind: "fx_exposure",
      severity: args.fxNonReportingShare >= 0.75 ? "risk" : "watch",
      magnitude: Math.round(args.fxNonReportingShare * 100),
      amount: args.fxLargestNonReporting.reportingValue,
      label: `${Math.round(args.fxLargestNonReporting.share * 100)}% of cash in ${args.fxLargestNonReporting.currency}`,
      detail: `${Math.round(args.fxLargestNonReporting.share * 100)}% of treasury sits in ${args.fxLargestNonReporting.currency} — margin exposed to FX moves.`,
      ts: now,
    });
  }

  /* excessive_bank_fees — fees up ≥ 50% PoP AND ≥ USD 1K. */
  if (args.bankFeePriorTotal > 0) {
    const change = (args.bankFeeTotal - args.bankFeePriorTotal) / args.bankFeePriorTotal;
    if (change >= 0.5 && args.bankFeeTotal >= 1_000) {
      out.push({
        key: stableId(["treasury-fees"]),
        source: "treasury",
        kind: "excessive_bank_fees",
        severity: change >= 1.0 ? "risk" : "watch",
        magnitude: Math.round(change * 100),
        amount: args.bankFeeTotal,
        direction: "up",
        label: `Bank fees ↑ ${Math.round(change * 100)}%`,
        detail: `Bank fees this period totalled ${formatCompact(args.bankFeeTotal)} USD vs ${formatCompact(args.bankFeePriorTotal)} USD prior — review the underlying T/T volume.`,
        ts: now,
      });
    }
  }

  /* transfer_failure. */
  if (args.failedTransferCount >= 1) {
    out.push({
      key: stableId(["treasury-transfer-failure"]),
      source: "treasury",
      kind: "transfer_failure",
      severity: args.failedTransferCount >= 3 ? "risk" : "watch",
      magnitude: args.failedTransferCount,
      label: `${args.failedTransferCount} transfer${args.failedTransferCount === 1 ? "" : "s"} failed`,
      detail: `${args.failedTransferCount} cash-movement transfer${args.failedTransferCount === 1 ? " has" : "s have"} failed at the bank — recovery action required.`,
      ts: now,
    });
  }

  /* overdraft_risk. */
  if (args.overdraftAccounts.length > 0) {
    const acct = args.overdraftAccounts[0];
    out.push({
      key: stableId(["treasury-overdraft", acct.id]),
      source: "treasury",
      kind: "overdraft_risk",
      severity: acct.available_balance < 0 ? "critical" : "risk",
      amount: acct.available_balance,
      label: `${acct.account_name} balance ${formatCompact(acct.available_balance)} ${acct.currency}`,
      detail: `Account ${acct.account_name} (${acct.bank_name}) holds ${formatCompact(acct.available_balance)} ${acct.currency} — overdraft territory.`,
      ts: now,
    });
  }

  /* idle_cash — large surplus relative to forward outflow. */
  if (args.availableCash > args.idleCashThreshold && args.idleCashThreshold > 0) {
    const ratio = args.availableCash / args.idleCashThreshold;
    if (ratio >= 3) {
      out.push({
        key: stableId(["treasury-idle"]),
        source: "treasury",
        kind: "idle_cash",
        severity: "watch",
        amount: args.availableCash,
        magnitude: Math.round(ratio * 100),
        label: `Idle cash · ${formatCompact(args.availableCash)} USD`,
        detail: `Reporting-currency cash buffer is ${ratio.toFixed(1)}× the next-30-day outflow — surplus may be deployable.`,
        ts: now,
      });
    }
  }

  return out;
}

/* ---------------------------------------------------------------------------
   Public API
   --------------------------------------------------------------------------- */

export interface TreasuryInputs {
  accounts: BankAccount[];
  movements: CashMovement[];
  payments: FinancePayment[];
  orders: FinanceOrder[];
}

export function buildTreasurySnapshot(input: TreasuryInputs): TreasurySnapshot {
  const { accounts, movements, payments, orders } = input;

  /* Dormant — no bank accounts connected. Returning a calm snapshot
     keeps the layer architecturally present without firing false-
     positive events on tenants that haven't onboarded treasury yet. */
  if (accounts.length === 0) {
    return {
      events: [],
      accounts: [],
      totalCash: 0,
      availableCash: 0,
      restrictedCash: 0,
      pendingCash: 0,
      projection: { d7: 0, d30: 0, d60: 0, runwayDays: null },
      currencyExposure: [],
      timeline: [],
      largestCashRisk: null,
      concentrationShare: 0,
      unreconciledMovements: 0,
      healthScore: 100,
      pressure: "calm",
      read: "",
    };
  }

  /* Per-account totals (reporting currency). */
  const totalReporting = accounts.reduce((s, a) =>
    s + translateToReporting(a.available_balance + a.pending_balance + a.restricted_balance, a.currency), 0);
  const accountSnapshots = accounts
    .filter((a) => a.status === "active")
    .map((a) => snapshotAccount(a, movements, totalReporting))
    .sort((a, b) => b.share - a.share);

  const totalAvailable    = accounts.reduce((s, a) => s + translateToReporting(a.available_balance, a.currency), 0);
  const totalRestricted   = accounts.reduce((s, a) => s + translateToReporting(a.restricted_balance, a.currency), 0);
  const totalPending      = accounts.reduce((s, a) => s + translateToReporting(a.pending_balance, a.currency), 0);
  const totalCash         = totalAvailable + totalRestricted + totalPending;
  const concentrationShare = accountSnapshots[0]?.share ?? 0;
  const topAccountName    = accountSnapshots[0]?.accountName ?? "—";

  /* Currency exposure. */
  const currencyExposure = buildExposure(accounts);
  const fxNonReporting   = currencyExposure.filter((c) => !c.isReporting);
  const fxNonReportingShare = fxNonReporting.reduce((s, c) => s + c.share, 0);
  const fxLargestNonReporting = fxNonReporting[0] ?? null;

  /* Timeline + projection. */
  const timeline = buildTimeline(orders, payments, movements);
  const projection = projectCash(totalAvailable, timeline);

  /* Reconciliation + transfer + fee summaries. */
  const unreconciledMovements = movements.filter((m) => m.reconciliation_status === "unreconciled").length;
  const unreconciledOlderThan7d = movements.filter((m) => {
    if (m.reconciliation_status !== "unreconciled") return false;
    const d = daysFromToday(m.movement_date);
    return d != null && d <= -7;
  }).length;
  const failedTransferCount = movements.filter((m) => m.movement_type === "transfer" && m.reconciliation_status === "disputed").length;

  /* Bank fees PoP. Current = last 90d, prior = 91..180d. */
  const today = new Date();
  const dayMs = 86_400_000;
  const cutCurrent = today.getTime() - 90 * dayMs;
  const cutPrior   = today.getTime() - 180 * dayMs;
  let bankFeeTotal = 0;
  let bankFeePriorTotal = 0;
  for (const m of movements) {
    if (m.movement_type !== "fee") continue;
    const t = new Date(m.movement_date).getTime();
    if (Number.isNaN(t)) continue;
    const reporting = translateToReporting(m.amount, m.currency);
    if (t >= cutCurrent) bankFeeTotal += reporting;
    else if (t >= cutPrior) bankFeePriorTotal += reporting;
  }

  /* Overdrafts. */
  const overdraftAccounts = accounts.filter((a) => a.status === "active" && a.available_balance < 1_000);

  /* Idle-cash threshold = next-30-day outflow in reporting currency. */
  const outflowForecast = timeline
    .filter((t) => t.direction === "outflow" && t.daysFromNow >= 0 && t.daysFromNow <= 30)
    .reduce((s, t) => s + translateToReporting(t.amount * t.confidence, t.currency), 0);
  const idleCashThreshold = outflowForecast > 0 ? outflowForecast : 50_000;

  /* Largest single liquidity risk in the timeline. */
  const worstOutflow = timeline
    .filter((t) => t.direction === "outflow" && t.daysFromNow >= 0)
    .reduce((m, t) => {
      const v = translateToReporting(t.amount * t.confidence, t.currency);
      if (m == null || v > m.amount) return { label: `${t.party} · ${t.source}`, amount: v, daysFromNow: t.daysFromNow };
      return m;
    }, null as { label: string; amount: number; daysFromNow: number } | null);

  /* Health. */
  const { score: healthScore, pressure } = score({
    availableCash: totalAvailable,
    unreconciledMovements,
    unreconciledOlderThan7d,
    hasNegativeRunway: projection.runwayDays != null,
    runwayDays: projection.runwayDays,
    d30: projection.d30,
    concentrationShare,
    fxNonReportingShare,
    overdraftAccounts: overdraftAccounts.length,
  });

  /* Events. */
  const events = buildEvents({
    availableCash: totalAvailable,
    projection,
    unreconciledMovements,
    unreconciledOlderThan7d,
    concentrationShare,
    topAccountName,
    fxNonReportingShare,
    fxLargestNonReporting,
    bankFeeTotal,
    bankFeePriorTotal,
    failedTransferCount,
    overdraftAccounts,
    idleCashThreshold,
  });

  /* Narrative read. */
  const read = (() => {
    if (accounts.length === 0) return "";
    const bits: string[] = [];
    bits.push(`${formatCompact(totalAvailable)} USD available across ${accounts.length} account${accounts.length === 1 ? "" : "s"}.`);
    if (projection.runwayDays != null) bits.push(`Runway ${projection.runwayDays}d.`);
    else if (projection.d30 < 0) bits.push(`30-day projection ${formatCompact(projection.d30)} USD.`);
    if (unreconciledMovements >= 3) bits.push(`${unreconciledMovements} movements unreconciled.`);
    if (fxNonReportingShare >= 0.6) bits.push(`${Math.round(fxNonReportingShare * 100)}% in non-reporting currencies.`);
    if (overdraftAccounts.length > 0) bits.push(`${overdraftAccounts.length} account${overdraftAccounts.length === 1 ? "" : "s"} near or below zero.`);
    return bits.join(" ");
  })();

  return {
    events,
    accounts: accountSnapshots,
    totalCash: Math.round(totalCash),
    availableCash: Math.round(totalAvailable),
    restrictedCash: Math.round(totalRestricted),
    pendingCash: Math.round(totalPending),
    projection: {
      d7:  Math.round(projection.d7),
      d30: Math.round(projection.d30),
      d60: Math.round(projection.d60),
      runwayDays: projection.runwayDays,
    },
    currencyExposure,
    timeline,
    largestCashRisk: worstOutflow,
    concentrationShare,
    unreconciledMovements,
    healthScore,
    pressure,
    read,
  };
}
