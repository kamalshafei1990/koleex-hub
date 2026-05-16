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
  | "operations";

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
  | "revenue_decline";         // revenue down period-over-period

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
