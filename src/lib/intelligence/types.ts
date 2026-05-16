/* ===========================================================================
   Koleex Hub  —  Operational Intelligence Layer  (Phase 2.0)
   --------------------------------------------------------------------------
   The cross-module nervous system.

   Vocabulary used across modules — Finance, Customer, Supplier, Logistics,
   Inventory, CRM. Every signal in the platform reads and writes against
   these types.

   Design rules:
     · Pure data shapes. No React, no fetch, no framework coupling.
     · Vocabulary is enterprise-grade, never gimmicky.
     · A signal must always carry origin + severity + trend, so the
       receiving surface can render it calmly.
     · Modules cannot mutate each other; they emit events. The
       relationship engine correlates.
   ========================================================================== */

/* ─────────────────────────────────────────────────────────────────────────
   Shared primitives
   ───────────────────────────────────────────────────────────────────────── */

/** One of the canonical business modules the intelligence layer understands. */
export type ModuleKey =
  | "finance"
  | "customer"
  | "supplier"
  | "logistics"
  | "inventory"
  | "crm"
  | "production"
  | "operations"
  | "approval"
  | "payment"
  | "treasury";

/** Calm → Critical scale used uniformly across modules. */
export type Pressure = "calm" | "watch" | "risk" | "critical";

export const PRESSURE_RANK: Record<Pressure, number> = {
  critical: 0,
  risk: 1,
  watch: 2,
  calm: 3,
};

/** Severity for individual signals — same shape as Pressure but never "calm". */
export type Severity = "info" | "watch" | "risk" | "critical";

/** Direction of change over a window. */
export type Direction = "up" | "down" | "flat";

/** A score on a 0..100 scale. Higher is always healthier. */
export type Score = number;

/* ─────────────────────────────────────────────────────────────────────────
   Operational events
   ───────────────────────────────────────────────────────────────────────── */

/**
 * The lightweight event stream the system uses to communicate
 * operational state between modules. Events are signals, not
 * notifications — they exist for the relationship engine to correlate,
 * not for user-facing alerts.
 */
export type OperationalEventKind =
  | "overdue_payment"          // customer hasn't paid past due date
  | "collection_delay"         // average DSO drifting up
  | "supplier_due"             // supplier payment approaching
  | "supplier_overdue"         // supplier payment past due
  | "supplier_dependency"      // single supplier dominates COGS
  | "customer_concentration"   // single customer dominates revenue
  | "margin_drop"              // gross margin compressed
  | "logistics_spike"          // shipping / freight / customs spend up
  | "inventory_shortage"       // future hook
  | "inventory_excess"         // future hook
  | "delayed_shipment"         // future hook
  | "liquidity_pressure"       // forward cash window negative
  | "expense_anomaly"          // an expense category jumped period-over-period
  | "deal_stalled"             // CRM stage stagnation (future hook)
  | "revenue_decline"          // revenue down period-over-period
  /* ── Phase 2.2.1 — approval operations ──────────────────────── */
  | "approval_backlog"         // count of pending reviews exceeds threshold
  | "review_delay"             // an item has been waiting > N days
  | "approval_concentration"   // single reviewer owns most pending reviews
  | "repeated_rejection"       // an entity hit rejected → changes loop multiple times
  | "unresolved_changes_request" // changes-requested items that haven't been resubmitted
  | "approval_velocity_drop"   // average approval time deteriorated PoP
  /* ── Phase 2.3 — payment control ────────────────────────────── */
  | "unreconciled_payment"     // payment closed but bank evidence not matched
  | "payment_mismatch"         // actual_amount differs from expected materially
  | "missing_payment_evidence" // paid/received payments without evidence
  | "payment_approval_delay"   // payments waiting for approval too long
  | "failed_payment"           // movement_status = failed
  | "duplicate_payment_risk"   // two same-party same-amount near-date payments
  | "large_unapproved_payment" // high-value draft / submitted payment
  /* ── Phase 2.4 — treasury operations ────────────────────────── */
  | "low_cash_buffer"          // available cash falls below safety multiple of monthly burn
  | "liquidity_gap"             // outflow > inflow within a forward window
  | "negative_runway"           // projected cash crosses zero
  | "bank_concentration"        // single account holds dominant share
  | "excessive_bank_fees"       // bank-fee category up sharply
  | "unreconciled_bank_activity" // cash_movements unreconciled past grace window
  | "transfer_failure"          // failed transfer cash movement
  | "fx_exposure"               // material non-reporting-currency share
  | "idle_cash"                 // surplus cash sitting idle
  | "overdraft_risk";            // any account at / below zero or near it

/** Lifecycle state assigned by the persistence layer. */
export type SignalState =
  | "new"          // appeared this run, no prior memory
  | "recurring"   // appeared in prior run(s) at similar severity
  | "worsening"   // recurring + severity escalated
  | "improving"   // recurring + severity de-escalated
  | "resolved";    // had history but didn't appear this run (carried briefly)

export interface OperationalEvent {
  /** Stable id so renderers can dedupe and key. */
  key: string;
  /** Module that produced the signal. */
  source: ModuleKey;
  kind: OperationalEventKind;
  severity: Severity;
  /** Optional related entity for navigation / Copilot follow-ups. */
  entity?: {
    type: "customer" | "supplier" | "order" | "expense" | "category" | "shipment";
    id?: string;
    name?: string;
  };
  /** Numeric magnitude — interpretation depends on kind. */
  magnitude?: number;
  /** Optional money amount carried with the signal. */
  amount?: number;
  /** Direction of the underlying change. */
  direction?: Direction;
  /** Short one-line label, e.g. "Egypt shipments +18% above baseline". */
  label: string;
  /** Longer plain-language interpretation. */
  detail: string;
  /** UTC timestamp the signal was synthesised. */
  ts: number;
  /** Phase 2.0.1 — composite priority used to rank for visibility. */
  priority?: number;
  /** Phase 2.0.1 — lifecycle state from persistence layer. */
  state?: SignalState;
  /** Phase 2.0.1 — number of consecutive runs this signal has appeared in. */
  persistence?: number;
}

/* ─────────────────────────────────────────────────────────────────────────
   Health & risk
   ───────────────────────────────────────────────────────────────────────── */

export interface HealthDimension {
  module: ModuleKey;
  score: Score;          // 0..100 — higher is healthier
  pressure: Pressure;
  /** Short narrative (≤ 1 sentence) of what's driving the score. */
  driver: string;
}

export interface BusinessHealth {
  /** Composite 0..100 score across all modules. */
  composite: Score;
  /** Overall pressure (worst of any dimension). */
  pressure: Pressure;
  /** Per-module breakdown. */
  dimensions: HealthDimension[];
  /** One-line executive narrative. */
  headline: string;
}

export interface RiskFactor {
  key: string;
  label: string;
  severity: Severity;
  module: ModuleKey;
}

export interface RiskAssessment {
  /** 0..100 — higher is more risky. (Inverse of health.) */
  score: Score;
  pressure: Pressure;
  factors: RiskFactor[];
}

/* ─────────────────────────────────────────────────────────────────────────
   Behavior profiles (customer / supplier)
   ───────────────────────────────────────────────────────────────────────── */

export interface CollectionBehavior {
  /** Average days between due date and actual payment (positive = late). */
  averageDelayDays: number;
  /** Share of invoices paid past the due date (0..1). */
  latePaymentRate: number;
  /** Delta in average delay vs. previous window, in days. */
  delayTrendDays: number;
  /** Direction the trend is moving. */
  trend: Direction;
  /** Soft label: "Reliable" | "Slow" | "Late" | "Severe". */
  label: "Reliable" | "Slow" | "Late" | "Severe" | "Unknown";
}

export interface CustomerBehaviorProfile {
  id: string;
  name: string;
  totalRevenue: number;
  outstanding: number;
  overdue: number;
  /** Share of period revenue (0..100). */
  revenueShare: number;
  ordersCount: number;
  collection: CollectionBehavior;
  /** Health 0..100. */
  healthScore: Score;
  /** Risk 0..100 (inverse of health, weighted differently). */
  riskScore: Score;
  pressure: Pressure;
  /** One-line operational read. */
  read: string;
}

export interface SupplierDependencyProfile {
  id: string;
  name: string;
  /** Total spend with this supplier (period or all-time, set by caller). */
  totalSpend: number;
  outstanding: number;
  /** Share of COGS (0..100). */
  cogsShare: number;
  /** Number of orders that touch this supplier. */
  ordersCount: number;
  /** Composite dependency 0..100 (higher = more dependent). */
  dependencyScore: Score;
  reliabilityScore: Score;
  pressure: Pressure;
  read: string;
}

/* ─────────────────────────────────────────────────────────────────────────
   Logistics intelligence
   ───────────────────────────────────────────────────────────────────────── */

export interface LogisticsBucket {
  /** Canonical bucket name we map expense categories into. */
  bucket: "shipping" | "freight" | "customs" | "packaging" | "warehousing" | "insurance";
  total: number;
  share: number;            // 0..100 share of logistics spend
  trend: Direction;
  trendPct: number;         // PoP delta in %
}

export interface LogisticsSnapshot {
  total: number;
  /** Share of total operating spend (0..100). */
  shareOfOpex: number;
  buckets: LogisticsBucket[];
  trend: Direction;
  trendPct: number;          // headline PoP %
  pressure: Pressure;
  read: string;
}

/* ─────────────────────────────────────────────────────────────────────────
   Inventory adapter
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Inventory remains a separate app and may not always be connected.
 * The intelligence layer reads via this adapter shape so that wiring
 * is a future drop-in without rebuilding consumers.
 */
export interface InventorySnapshot {
  available: boolean;        // false when the adapter has no data
  totalSkus?: number;
  belowSafetyStock?: number;
  reservedForUnpaid?: number;     // value tied to unpaid orders
  agingInventoryValue?: number;   // value sitting > 90 days
  pressure: Pressure;
  read: string;
}

/* ─────────────────────────────────────────────────────────────────────────
   Cross-module correlation
   ───────────────────────────────────────────────────────────────────────── */

/**
 * A correlation links two or more operational events into a single
 * causal narrative. The relationship engine emits these; the dashboard
 * and Copilot consume them.
 */
export interface CrossModuleCorrelation {
  key: string;
  /** Originating event keys. */
  sources: string[];
  /** Affected module(s). */
  affects: ModuleKey[];
  severity: Severity;
  /** Short headline: "Logistics spike compressing margin." */
  headline: string;
  /** Full narrative — 1-2 sentences. */
  narrative: string;
  /** Optional money/percentage attached to the correlation. */
  magnitude?: number;
  /** Phase 2.0.1 — 0..1 confidence. Correlations below 0.55 are filtered. */
  confidence?: number;
  /** Phase 2.0.1 — supporting evidence count (signals that corroborate). */
  evidenceCount?: number;
  /** Phase 2.0.1 — lifecycle state if any source signal is persistent. */
  state?: SignalState;
}

/* ─────────────────────────────────────────────────────────────────────────
   Copilot context
   ───────────────────────────────────────────────────────────────────────── */

export interface CopilotHint {
  key: string;
  module: ModuleKey;
  severity: Severity;
  text: string;
  /** When the user expands or asks "tell me more", these are the
   *  related entity/event keys the Copilot should pull into context. */
  related?: {
    eventKeys?: string[];
    customerId?: string;
    supplierId?: string;
    orderId?: string;
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   Executive digest  (Phase 2.0.1)

   A curated 3–5 item list of the most consequential narratives for the
   period. Items are picked from events + correlations + behavior
   profiles via a discipline filter so the digest reads like an analyst
   briefing, not an analytics dump.
   ───────────────────────────────────────────────────────────────────── */

export type DigestKind =
  | "biggest_pressure"
  | "biggest_risk"
  | "biggest_dependency"
  | "biggest_improvement"
  | "biggest_opportunity";

export interface DigestItem {
  key: string;
  kind: DigestKind;
  severity: Severity;
  module: ModuleKey;
  headline: string;
  narrative: string;
  /** Optional money / percentage that anchors the item. */
  magnitude?: number;
  state?: SignalState;
  confidence?: number;
}

/* ─────────────────────────────────────────────────────────────────────────
   Approval operations (Phase 2.2.1)

   Operational read of the approval workflow — aging, backlog,
   reviewer workload, cycle velocity. The shape composes with the rest
   of the intelligence layer: events flow into the regular stream,
   health adds an "approval" dimension to BusinessHealth, and the
   dashboard renders a calm panel from this snapshot.
   ───────────────────────────────────────────────────────────────────── */

export type ApprovalAgingBucketKey = "lt_1d" | "1_3d" | "4_7d" | "8_14d" | "14_plus";

export interface ApprovalAgingBucket {
  key: ApprovalAgingBucketKey;
  label: string;
  count: number;
  totalValue: number;
}

export interface ReviewerWorkload {
  /** account id when known; "unassigned" when no reviewer has touched it. */
  reviewerId: string | "unassigned";
  reviewerName: string;
  /** Pending items currently waiting on this reviewer. */
  pendingCount: number;
  /** Total value of pending items on this reviewer. */
  pendingValue: number;
  /** Approved within the rolling window (for velocity scoring). */
  approvedCount: number;
  /** Rejected within the rolling window. */
  rejectedCount: number;
  /** Avg submit → approve days within the rolling window. */
  avgLatencyDays: number;
  /** Share of total backlog (0..1). */
  backlogShare: number;
}

export interface ApprovalCycleMetrics {
  /** Average days from submit to a terminal decision (approved/rejected). */
  avgCycleDays: number;
  /** Avg cycle in the prior comparable window. */
  priorAvgCycleDays: number;
  /** PoP percent change. Positive = slower. */
  trendPct: number;
  /** Share of decisions that were rejections (0..1). */
  rejectionRate: number;
  /** Share that landed in requires_changes at least once (approximated from current status). */
  changesRate: number;
}

/* ─────────────────────────────────────────────────────────────────────────
   Payment control snapshot (Phase 2.3)
   ───────────────────────────────────────────────────────────────────── */

export interface PaymentControlSnapshot {
  /** Materially-filtered events ready to merge into the global stream. */
  events: OperationalEvent[];
  /** Pending-approval summary. */
  pendingApproval: {
    count: number;
    totalValue: number;
    largestValue: number;
    oldestDays: number;
  };
  /** Reconciliation summary. */
  reconciliation: {
    unreconciledCount: number;
    unreconciledValue: number;
    mismatchCount: number;
    mismatchValue: number;
    disputedCount: number;
  };
  /** Evidence summary. */
  evidence: {
    missingCount: number;
    missingValue: number;
  };
  /** Failed-movement count (movement_status = failed). */
  failedCount: number;
  /** Composite 0..100 health. */
  healthScore: Score;
  pressure: Pressure;
  /** One-sentence operational read; "" if nothing material to say. */
  read: string;
}

/* ─────────────────────────────────────────────────────────────────────────
   Treasury (Phase 2.4)
   ───────────────────────────────────────────────────────────────────── */

export interface TreasuryTimelineItem {
  /** Stable key for React + dedupe. */
  key: string;
  /** ISO date the event happens / cleared. */
  date: string;
  /** Days from today; negative = past. */
  daysFromNow: number;
  /** "inflow" or "outflow" of cash. */
  direction: "inflow" | "outflow";
  /** Source — supplier_due, customer_collect, payroll, payment, movement, etc. */
  source: string;
  party: string;
  amount: number;
  currency: string;
  confidence: number;  // 0..1 — how sure we are it will land
}

export interface FXExposure {
  currency: string;
  totalValue: number;          // value in this currency (native units)
  reportingValue: number;       // value translated to reporting currency
  share: number;                // share of total treasury (0..1)
  /** True when this is the operator's reporting currency itself. */
  isReporting: boolean;
}

export interface CashProjection {
  d7:  number;
  d30: number;
  d60: number;
  /** Number of days until projected cash crosses zero; null = never within horizon. */
  runwayDays: number | null;
}

export interface BankAccountSnapshot {
  id: string;
  bankName: string;
  accountName: string;
  currency: string;
  available: number;
  pending: number;
  restricted: number;
  total: number;
  share: number;        // share of total treasury (reporting-currency-translated)
  unreconciledMovements: number;
}

export interface TreasurySnapshot {
  /** Materially-filtered events ready to merge into the global stream. */
  events: OperationalEvent[];
  /** Per-account snapshot in reporting currency. */
  accounts: BankAccountSnapshot[];
  /** Cash position totals (reporting currency). */
  totalCash: number;
  availableCash: number;
  restrictedCash: number;
  pendingCash: number;
  /** Forward projection. */
  projection: CashProjection;
  /** Currency-by-currency exposure. */
  currencyExposure: FXExposure[];
  /** Forward cash-event timeline. */
  timeline: TreasuryTimelineItem[];
  /** Largest single liquidity-risk item the operator should attend to. */
  largestCashRisk: { label: string; amount: number; daysFromNow: number } | null;
  /** Bank-concentration metric (largest account share, 0..1). */
  concentrationShare: number;
  /** Unreconciled movement count. */
  unreconciledMovements: number;
  /** Composite 0..100 treasury health. */
  healthScore: Score;
  pressure: Pressure;
  read: string;
}

export interface ApprovalIntelligenceSnapshot {
  /** Materially-filtered events ready to merge into the global stream. */
  events: OperationalEvent[];
  /** Per-bucket aging table. */
  aging: ApprovalAgingBucket[];
  /** Backlog summary (count + value + oldest waiting days). */
  backlog: {
    count: number;
    totalValue: number;
    oldestDays: number;
  };
  /** Reviewer-level distribution. Sorted by pendingCount desc. */
  workload: ReviewerWorkload[];
  cycle: ApprovalCycleMetrics;
  /** Composite 0..100 approval-operations health. */
  healthScore: Score;
  pressure: Pressure;
  /** One-sentence operational read; "" if nothing material to say. */
  read: string;
}
