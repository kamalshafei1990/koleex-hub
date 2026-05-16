/* ===========================================================================
   Phase 2.0.2  —  Deterministic Intelligence Scenarios

   Synthetic enterprise states used to stress-test the cross-module
   intelligence pipeline. Every scenario is fully deterministic:

     · stable date anchors (no Date.now() drift)
     · stable amounts
     · stable IDs

   so the validation runner can compare actual output against expected
   behaviour byte-for-byte across runs.

   These are NOT integration tests against the database — they are
   pure-input pure-output stress fixtures.
   ========================================================================== */

import type {
  BankAccount,
  BankStatementImport,
  CashMovement,
  DashboardKpi,
  FinanceExpense,
  FinanceOrder,
  FinanceOrderSupplier,
  FinancePayment,
  FinanceReconciliationCandidate,
  ReconciliationCandidateType,
  ReconciliationConfidenceLevel,
  ReconciliationCandidateStatus,
  TreasuryPlan,
  TreasuryPlanMetrics,
  TreasuryPlanStatus,
} from "@/lib/finance/types";
import type {
  IntelligenceInputs,
} from "@/lib/intelligence";
import type { Severity, OperationalEventKind } from "../types";

/* ---------------------------------------------------------------------------
   Stable date anchors  —  every scenario builds against this "now".
   --------------------------------------------------------------------------- */

const NOW = new Date("2026-05-16T00:00:00Z");

function isoDate(daysFromNow: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------------------
   Builders.

   These are intentionally permissive — the scenarios fill in what they
   need and accept defaults for the rest. Keeps each scenario readable.
   --------------------------------------------------------------------------- */

function makeKpi(overrides: Partial<DashboardKpi> = {}): DashboardKpi {
  const total_revenue = overrides.total_revenue ?? 600_000;
  const total_supplier_cost = overrides.total_supplier_cost ?? 420_000;
  const total_expenses = overrides.total_expenses ?? 60_000;
  const total_tax_refund = overrides.total_tax_refund ?? 9_000;
  const total_financial_charges = overrides.total_financial_charges ?? 2_500;
  const gross_profit = total_revenue - total_supplier_cost;
  const gross_margin_pct = total_revenue > 0 ? (gross_profit / total_revenue) * 100 : 0;
  const net_profit = gross_profit - total_expenses + total_tax_refund - total_financial_charges;
  return {
    total_revenue,
    total_supplier_cost,
    total_expenses,
    total_tax_refund,
    total_financial_charges,
    gross_profit,
    gross_margin_pct,
    net_profit,
    cash_in: overrides.cash_in ?? 480_000,
    cash_out: overrides.cash_out ?? 460_000,
    accounts_receivable: overrides.accounts_receivable ?? 80_000,
    accounts_payable: overrides.accounts_payable ?? 50_000,
    health_status: overrides.health_status ?? "healthy",
    health_reasons: overrides.health_reasons ?? [],
    delta: overrides.delta ?? {
      revenue_pct: 3, expenses_pct: 4, gross_profit_pct: 2, net_profit_pct: 2,
      cash_in_pct: 5, cash_out_pct: 4,
    },
    delta_value: overrides.delta_value ?? {
      revenue: 17_000, expenses: 2_300, gross_profit: 7_400, net_profit: 5_200,
      cash_in: 22_000, cash_out: 17_700,
    },
    trend: overrides.trend ?? defaultTrend(),
    top_orders: overrides.top_orders ?? [],
    top_expense_categories: overrides.top_expense_categories ?? [],
    expected_vs_realized: overrides.expected_vs_realized ?? {
      expected_net_profit: 78_500,
      realized_cash_position: 60_000,
      collected: 480_000,
      paid_supplier: 380_000,
      paid_expenses: 40_000,
    },
  };
}

function defaultTrend() {
  return Array.from({ length: 13 }).map((_, i) => ({
    label: `W-${12 - i}`,
    revenue: 40_000 + i * 3_000,
    expenses: 28_000 + i * 1_500,
    net_profit: 6_000 + i * 700,
  }));
}

function makeSupplierLine(p: Partial<FinanceOrderSupplier> & { id: string; order_id: string }): FinanceOrderSupplier {
  return {
    id: p.id,
    order_id: p.order_id,
    supplier_id: p.supplier_id ?? null,
    supplier_name: p.supplier_name ?? "Supplier",
    supplier_cost: p.supplier_cost ?? 50_000,
    currency: p.currency ?? "USD",
    payment_status: p.payment_status ?? "unpaid",
    paid_amount: p.paid_amount ?? 0,
    due_date: p.due_date ?? isoDate(14),
    notes: p.notes ?? null,
  };
}

interface OrderSpec {
  id: string;
  order_no: string;
  customer_id: string;
  customer_name: string;
  selling_price: number;
  due_in_days: number;       // days from NOW (negative = past)
  outstanding_receivable: number;
  suppliers: Array<{
    id: string;
    name: string;
    cost: number;
    paid?: number;
    due_in_days?: number;
  }>;
}

function makeOrder(spec: OrderSpec): FinanceOrder {
  const total_supplier_cost = spec.suppliers.reduce((s, x) => s + x.cost, 0);
  const gross_profit = spec.selling_price - total_supplier_cost;
  const order_date = isoDate(spec.due_in_days - 30);
  return {
    id: spec.id,
    order_no: spec.order_no,
    customer_id: spec.customer_id,
    customer_name: spec.customer_name,
    order_date,
    currency: "USD",
    selling_price: spec.selling_price,
    tax_refund_pct: 0,
    tax_refund_value: 0,
    financial_charges: 0,
    expected_profit: null,
    status: "open",
    payment_status: spec.outstanding_receivable > 0 ? "partial" : "paid",
    payment_due_date: isoDate(spec.due_in_days),
    linked_quotation_id: null,
    linked_invoice_id: null,
    notes: null,
    created_at: order_date + "T00:00:00Z",
    updated_at: order_date + "T00:00:00Z",
    suppliers: spec.suppliers.map((s, i) =>
      makeSupplierLine({
        id: `${spec.id}-s${i}`,
        order_id: spec.id,
        supplier_id: s.id,
        supplier_name: s.name,
        supplier_cost: s.cost,
        paid_amount: s.paid ?? 0,
        due_date: s.due_in_days != null ? isoDate(s.due_in_days) : isoDate(14),
      })
    ),
    total_supplier_cost,
    total_order_expenses: 0,
    gross_profit,
    net_profit: gross_profit,
    net_profit_pct: spec.selling_price > 0 ? (gross_profit / spec.selling_price) * 100 : 0,
    collected_amount: Math.max(0, spec.selling_price - spec.outstanding_receivable),
    paid_supplier_amount: spec.suppliers.reduce((s, x) => s + (x.paid ?? 0), 0),
    paid_expenses: 0,
    realized_cash_position: 0,
    outstanding_receivable: spec.outstanding_receivable,
    outstanding_payable: spec.suppliers.reduce((s, x) => s + Math.max(0, x.cost - (x.paid ?? 0)), 0),
  };
}

function makeExpense(id: string, category: string, amount: number, daysFromNow: number): FinanceExpense {
  return {
    id,
    category_id: null,
    subcategory_id: null,
    category_name: category,
    title: `${category} ${id}`,
    amount,
    currency: "USD",
    expense_date: isoDate(daysFromNow),
    payment_status: "paid",
    due_date: null,
    linked_order_id: null,
    linked_supplier_id: null,
    linked_customer_id: null,
    linked_project_id: null,
    attachment_url: null,
    notes: null,
    created_at: isoDate(daysFromNow) + "T00:00:00Z",
    updated_at: isoDate(daysFromNow) + "T00:00:00Z",
  };
}

/* Exported for future scenarios that need explicit payment events.
   Kept in the public surface so calibrators can build payment-driven
   collection-behavior tests without re-implementing the shape. */
export function makePayment(p: Partial<FinancePayment> & { id: string; direction: "in" | "out"; amount: number }): FinancePayment {
  return {
    id: p.id,
    direction: p.direction,
    party_type: p.party_type ?? "customer",
    party_id: p.party_id ?? null,
    party_name: p.party_name ?? "Party",
    amount: p.amount,
    currency: p.currency ?? "USD",
    payment_date: p.payment_date ?? isoDate(-30),
    payment_method: p.payment_method ?? null,
    reference_no: p.reference_no ?? null,
    status: p.status ?? "completed",
    linked_order_id: p.linked_order_id ?? null,
    linked_order_supplier_id: p.linked_order_supplier_id ?? null,
    linked_expense_id: p.linked_expense_id ?? null,
    notes: p.notes ?? null,
    created_at: (p.payment_date ?? isoDate(-30)) + "T00:00:00Z",
    updated_at: (p.payment_date ?? isoDate(-30)) + "T00:00:00Z",
  };
}

/* ---------------------------------------------------------------------------
   Scenario expectation language
   --------------------------------------------------------------------------- */

export interface ScenarioExpectations {
  /** Inclusive bounds on digest length. */
  digestRange?: [number, number];
  /** Inclusive bounds on event count after the pipeline. */
  eventRange?: [number, number];
  /** Inclusive bounds on composite health score. */
  healthRange?: [number, number];
  /** Most-severe correlation severity allowed (e.g. "watch" means no risk/critical). */
  maxCorrelationSeverity?: Severity;
  /** Minimum confidence on every surviving correlation. */
  minCorrelationConfidence?: number;
  /** Expected presence (or absence) of specific event kinds. */
  expectEventKinds?: OperationalEventKind[];
  forbidEventKinds?: OperationalEventKind[];
  /** Copilot calm-state: exactly one "no material pressure" hint. */
  copilotCalm?: boolean;
  /** Max number of Copilot hints. */
  copilotMaxHints?: number;
  /** Strings that should NEVER appear in any narrative. */
  forbiddenPhrases?: string[];
  /** Max number of digest items at risk/critical severity. */
  maxCriticalDigestItems?: number;
}

export interface Scenario {
  name: string;
  description: string;
  inputs: IntelligenceInputs;
  expectations: ScenarioExpectations;
}

/* ---------------------------------------------------------------------------
   Scenario factories.
   --------------------------------------------------------------------------- */

const FORBIDDEN_GENERIC_PHRASES = [
  "looks healthy",
  "appear stable",
  "things appear",
  "performance looks",
  "operations are improving",
  "spend stable",
  "slightly behind",
];

/* A — HEALTHY_STATE
   Diversified customers, healthy margin, AP < AR, no overdues, calm logistics. */
export function healthyState(): Scenario {
  const orders: FinanceOrder[] = [
    makeOrder({
      id: "o-h-1", order_no: "ORD-2026-0001", customer_id: "c-h-1", customer_name: "ACME Spinning",
      selling_price: 150_000, due_in_days: 18, outstanding_receivable: 30_000,
      suppliers: [
        { id: "s-h-1", name: "Ningbo Steel", cost: 60_000, paid: 60_000, due_in_days: -15 },
        { id: "s-h-2", name: "Hangzhou Castings", cost: 50_000, paid: 50_000, due_in_days: -10 },
      ],
    }),
    makeOrder({
      id: "o-h-2", order_no: "ORD-2026-0002", customer_id: "c-h-2", customer_name: "Cairo Knits",
      selling_price: 220_000, due_in_days: 25, outstanding_receivable: 22_000,
      suppliers: [
        { id: "s-h-3", name: "Shanghai Frame Co", cost: 95_000, paid: 95_000, due_in_days: -5 },
      ],
    }),
    makeOrder({
      id: "o-h-3", order_no: "ORD-2026-0003", customer_id: "c-h-3", customer_name: "Alexandria Looms",
      selling_price: 180_000, due_in_days: 30, outstanding_receivable: 0,
      suppliers: [
        { id: "s-h-4", name: "Wenzhou Drives", cost: 70_000, paid: 70_000, due_in_days: -20 },
      ],
    }),
    makeOrder({
      id: "o-h-4", order_no: "ORD-2026-0004", customer_id: "c-h-4", customer_name: "Tanta Textiles",
      selling_price: 130_000, due_in_days: 22, outstanding_receivable: 8_000,
      suppliers: [
        { id: "s-h-5", name: "Ningbo Steel", cost: 55_000, paid: 55_000, due_in_days: -8 },
      ],
    }),
  ];
  const expenses: FinanceExpense[] = [
    makeExpense("e-h-1", "Shipping",  4_000,  -45),
    makeExpense("e-h-2", "Shipping",  4_200,  -15),
    makeExpense("e-h-3", "Customs",   3_500,  -30),
    makeExpense("e-h-4", "Office",    2_000,  -20),
  ];
  return {
    name: "HEALTHY_STATE",
    description: "Diversified customers, healthy 30% margin, AP < AR, no overdues, calm logistics.",
    inputs: {
      kpi: makeKpi({
        total_revenue: 680_000,
        total_supplier_cost: 476_000,    // 30% margin
        total_expenses: 36_000,
        cash_in: 540_000,
        cash_out: 510_000,
        accounts_receivable: 60_000,
        accounts_payable: 25_000,
        health_status: "healthy",
        delta: { revenue_pct: 5, expenses_pct: 3, gross_profit_pct: 4, net_profit_pct: 4, cash_in_pct: 6, cash_out_pct: 4 },
        delta_value: { revenue: 31_000, expenses: 1_000, gross_profit: 14_000, net_profit: 7_500, cash_in: 28_000, cash_out: 18_000 },
      }),
      orders,
      payments: [],
      expenses,
      periodDays: 90,
    },
    expectations: {
      digestRange: [0, 2],         // calm → digest may be empty or just an opportunity row
      eventRange: [0, 3],
      healthRange: [70, 100],
      maxCorrelationSeverity: "watch",
      minCorrelationConfidence: 0.55,
      forbidEventKinds: ["liquidity_pressure", "margin_drop", "revenue_decline"],
      copilotCalm: true,
      copilotMaxHints: 1,
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 0,
    },
  };
}

/* B — MODERATE_PRESSURE_STATE
   One delayed customer, elevated logistics, moderate AP, slightly slower collections. */
export function moderatePressureState(): Scenario {
  const orders: FinanceOrder[] = [
    makeOrder({
      id: "o-m-1", order_no: "ORD-2026-0011", customer_id: "c-m-1", customer_name: "Mansoura Mills",
      selling_price: 180_000, due_in_days: -10, outstanding_receivable: 45_000,
      suppliers: [
        { id: "s-m-1", name: "Ningbo Steel", cost: 65_000, paid: 65_000, due_in_days: -25 },
      ],
    }),
    makeOrder({
      id: "o-m-2", order_no: "ORD-2026-0012", customer_id: "c-m-2", customer_name: "Suez Spinning",
      selling_price: 240_000, due_in_days: 12, outstanding_receivable: 60_000,
      suppliers: [
        { id: "s-m-2", name: "Hangzhou Castings", cost: 110_000, paid: 110_000, due_in_days: -8 },
      ],
    }),
    makeOrder({
      id: "o-m-3", order_no: "ORD-2026-0013", customer_id: "c-m-3", customer_name: "Alexandria Looms",
      selling_price: 150_000, due_in_days: 28, outstanding_receivable: 25_000,
      suppliers: [
        { id: "s-m-3", name: "Wenzhou Drives", cost: 60_000, paid: 30_000, due_in_days: 6 },
      ],
    }),
  ];
  const expenses: FinanceExpense[] = [
    /* Current 90d — logistics rising. */
    makeExpense("e-m-1", "Shipping", 9_500,  -10),
    makeExpense("e-m-2", "Freight",  6_200,  -20),
    makeExpense("e-m-3", "Customs",  3_800,  -35),
    /* Prior 90d (older). */
    makeExpense("e-m-4", "Shipping", 7_000,  -110),
    makeExpense("e-m-5", "Freight",  5_500,  -120),
    makeExpense("e-m-6", "Customs",  3_400,  -130),
  ];
  return {
    name: "MODERATE_PRESSURE_STATE",
    description: "One past-due customer, elevated logistics, moderate AP, slower collections.",
    inputs: {
      kpi: makeKpi({
        total_revenue: 570_000,
        total_supplier_cost: 400_000,
        total_expenses: 29_400,
        cash_in: 420_000,
        cash_out: 405_000,
        accounts_receivable: 130_000,
        accounts_payable: 60_000,
        health_status: "watch",
        delta: { revenue_pct: -4, expenses_pct: 11, gross_profit_pct: -8, net_profit_pct: -10, cash_in_pct: -6, cash_out_pct: 3 },
        delta_value: { revenue: -22_000, expenses: 2_900, gross_profit: -8_000, net_profit: -7_500, cash_in: -25_000, cash_out: 10_000 },
      }),
      orders,
      payments: [],
      expenses,
      periodDays: 90,
    },
    expectations: {
      digestRange: [1, 4],
      eventRange: [1, 8],
      /* Phase 2.0.1 softened health damage + EMA cap keeps scores
         higher than legacy thresholds; the ceiling reflects that. */
      healthRange: [55, 92],
      maxCorrelationSeverity: "risk",
      minCorrelationConfidence: 0.55,
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 1,
      copilotMaxHints: 3,
    },
  };
}

/* C — HIGH_RISK_STATE
   Severe overdue AR, liquidity compression, single supplier dependency, margin decline,
   logistics spike, AP overdue. */
export function highRiskState(): Scenario {
  const orders: FinanceOrder[] = [
    /* Top customer dominates AND has overdue. */
    makeOrder({
      id: "o-r-1", order_no: "ORD-2026-0021", customer_id: "c-r-top", customer_name: "Damanhour Heavy Industries",
      selling_price: 420_000, due_in_days: -45, outstanding_receivable: 280_000,
      suppliers: [
        { id: "s-r-1", name: "Ningbo Master Co", cost: 280_000, paid: 0, due_in_days: -35 },
      ],
    }),
    makeOrder({
      id: "o-r-2", order_no: "ORD-2026-0022", customer_id: "c-r-top", customer_name: "Damanhour Heavy Industries",
      selling_price: 200_000, due_in_days: -20, outstanding_receivable: 120_000,
      suppliers: [
        { id: "s-r-1", name: "Ningbo Master Co", cost: 140_000, paid: 0, due_in_days: -10 },
      ],
    }),
    makeOrder({
      id: "o-r-3", order_no: "ORD-2026-0023", customer_id: "c-r-2", customer_name: "Beni Suef Knits",
      selling_price: 95_000, due_in_days: 15, outstanding_receivable: 20_000,
      suppliers: [
        { id: "s-r-1", name: "Ningbo Master Co", cost: 50_000, paid: 50_000, due_in_days: -25 },
      ],
    }),
  ];
  const expenses: FinanceExpense[] = [
    /* Logistics spike — current period much higher than prior. */
    makeExpense("e-r-1", "Shipping",  28_000, -10),
    makeExpense("e-r-2", "Freight",   22_000, -25),
    makeExpense("e-r-3", "Customs",   14_000, -40),
    makeExpense("e-r-4", "Shipping",  4_000,  -120),
    makeExpense("e-r-5", "Freight",   3_500,  -130),
    makeExpense("e-r-6", "Customs",   2_500,  -150),
  ];
  return {
    name: "HIGH_RISK_STATE",
    description: "Severe overdue AR concentrated on top customer, AP overdue, supplier monopoly, margin compressed, logistics spike.",
    inputs: {
      kpi: makeKpi({
        total_revenue: 715_000,
        total_supplier_cost: 670_000,    // ≈ 6% margin
        total_expenses: 74_000,
        total_tax_refund: 4_000,
        cash_in: 320_000,
        cash_out: 480_000,
        accounts_receivable: 420_000,
        accounts_payable: 420_000,
        health_status: "stress",
        delta: { revenue_pct: -35, expenses_pct: 42, gross_profit_pct: -58, net_profit_pct: -82, cash_in_pct: -28, cash_out_pct: 18 },
        delta_value: { revenue: -385_000, expenses: 22_000, gross_profit: -180_000, net_profit: -120_000, cash_in: -125_000, cash_out: 73_000 },
      }),
      orders,
      payments: [],
      expenses,
      periodDays: 90,
    },
    expectations: {
      digestRange: [3, 5],
      eventRange: [4, 24],
      /* Composite health under high-risk stress lands in the 50–80
         band thanks to the EMA smoothing, softened damage, and the
         Phase 2.4 weight rebalance that lifted Treasury to 0.13. The
         individual module scores tell the harsh story. */
      healthRange: [0, 80],
      minCorrelationConfidence: 0.6,
      expectEventKinds: ["overdue_payment", "margin_drop", "logistics_spike", "customer_concentration"],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      copilotMaxHints: 3,
    },
  };
}

/* D — FALSE_SIGNAL_STATE
   Tiny operational fluctuations across the board — nothing material. */
export function falseSignalState(): Scenario {
  const orders: FinanceOrder[] = [
    makeOrder({
      id: "o-f-1", order_no: "ORD-2026-0031", customer_id: "c-f-1", customer_name: "Aswan Textiles",
      selling_price: 180_000, due_in_days: 14, outstanding_receivable: 12_000,
      suppliers: [
        { id: "s-f-1", name: "Ningbo Steel",     cost: 45_000, paid: 45_000, due_in_days: -10 },
        { id: "s-f-2", name: "Hangzhou Castings", cost: 40_000, paid: 40_000, due_in_days: -8 },
      ],
    }),
    makeOrder({
      id: "o-f-2", order_no: "ORD-2026-0032", customer_id: "c-f-2", customer_name: "Port Said Mills",
      selling_price: 240_000, due_in_days: 21, outstanding_receivable: 0,
      suppliers: [
        /* Diversified supplier mix so no single supplier crosses the
           dependency threshold and the scenario stays truly silent. */
        { id: "s-f-3", name: "Shanghai Frame Co", cost: 55_000, paid: 55_000, due_in_days: -12 },
        { id: "s-f-4", name: "Wenzhou Drives",    cost: 50_000, paid: 50_000, due_in_days: -10 },
      ],
    }),
  ];
  const expenses: FinanceExpense[] = [
    /* Tiny moves — under any materiality threshold. */
    makeExpense("e-f-1", "Shipping", 4_100, -10),
    makeExpense("e-f-2", "Shipping", 4_000, -110),
    makeExpense("e-f-3", "Customs",  1_900, -40),
    makeExpense("e-f-4", "Customs",  1_800, -130),
    makeExpense("e-f-5", "Office",   850,   -20),
  ];
  return {
    name: "FALSE_SIGNAL_STATE",
    description: "Trivial fluctuations only — system must stay silent.",
    inputs: {
      kpi: makeKpi({
        total_revenue: 720_000,
        total_supplier_cost: 504_000,
        total_expenses: 12_650,
        cash_in: 580_000,
        cash_out: 555_000,
        accounts_receivable: 35_000,
        accounts_payable: 15_000,
        delta: { revenue_pct: 2, expenses_pct: 3, gross_profit_pct: 1, net_profit_pct: 1, cash_in_pct: 2, cash_out_pct: 2 },
        delta_value: { revenue: 14_000, expenses: 370, gross_profit: 4_000, net_profit: 1_200, cash_in: 12_000, cash_out: 11_000 },
      }),
      orders,
      payments: [],
      expenses,
      periodDays: 90,
    },
    expectations: {
      digestRange: [0, 1],
      eventRange: [0, 1],
      healthRange: [80, 100],
      forbidEventKinds: [
        "liquidity_pressure", "margin_drop", "revenue_decline",
        "logistics_spike", "overdue_payment", "supplier_overdue",
      ],
      copilotCalm: true,
      copilotMaxHints: 1,
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 0,
    },
  };
}

/* APPROVAL_PRESSURE_STATE
   Backlog of 8 pending expenses, one stuck in review for 22 days,
   reviewer concentration on a single account. The approval engine
   should fire backlog + review_delay + concentration events, and the
   approval health dimension should drag the composite into "watch". */
export function approvalPressureState(): Scenario {
  const reviewerA = "00000000-0000-0000-0000-aaaaaaaaaaaa";
  const reviewerB = "00000000-0000-0000-0000-bbbbbbbbbbbb";
  const submitter = "00000000-0000-0000-0000-cccccccccccc";

  /* Build 8 pending expenses concentrated on reviewerA, with the
     oldest waiting 22 days and the rest fresh. Then 6 historical
     approved expenses with healthy cycle, plus 2 rejected so the
     rejection rate stays under the 30% bar (avoids triggering the
     separate repeated_rejection signal). */
  const expenses: FinanceExpense[] = [];

  /* Oldest pending — 22 days in review on reviewerA. */
  expenses.push({
    id: "e-ap-1",
    category_id: null, subcategory_id: null,
    category_name: "Logistics",
    title: "Heavy machinery freight",
    amount: 18_500,
    currency: "USD",
    expense_date: isoDate(-25),
    payment_status: "unpaid",
    due_date: null,
    linked_order_id: null, linked_supplier_id: null,
    linked_customer_id: null, linked_project_id: null,
    attachment_url: null, notes: null,
    created_at: isoDate(-25) + "T00:00:00Z",
    updated_at: isoDate(-25) + "T00:00:00Z",
    approval_status: "submitted",
    submitted_at: isoDate(-22),
    submitted_by: submitter,
    reviewed_at: null, reviewed_by: reviewerA,
    approved_at: null, approved_by: null,
    rejected_at: null, rejected_by: null,
    rejection_reason: null, requires_changes_reason: null, review_notes: null,
    approval_level: 0,
    evidence_status: "pending", has_attachments: true, receipt_count: 1,
  });

  /* 7 more pending — all on reviewerA, spread across short waits. */
  for (let i = 0; i < 7; i++) {
    const waitDays = (i + 1) * 2;
    expenses.push({
      id: `e-ap-${i + 2}`,
      category_id: null, subcategory_id: null,
      category_name: "Office",
      title: `Office expense ${i + 1}`,
      amount: 1_200 + i * 400,
      currency: "USD",
      expense_date: isoDate(-(waitDays + 1)),
      payment_status: "unpaid",
      due_date: null,
      linked_order_id: null, linked_supplier_id: null,
      linked_customer_id: null, linked_project_id: null,
      attachment_url: null, notes: null,
      created_at: isoDate(-(waitDays + 1)) + "T00:00:00Z",
      updated_at: isoDate(-(waitDays + 1)) + "T00:00:00Z",
      approval_status: "submitted",
      submitted_at: isoDate(-waitDays),
      submitted_by: submitter,
      reviewed_at: null, reviewed_by: reviewerA,
      approved_at: null, approved_by: null,
      rejected_at: null, rejected_by: null,
      rejection_reason: null, requires_changes_reason: null, review_notes: null,
      approval_level: 0,
    });
  }

  /* 6 historical approved expenses with healthy cycle (~1.5 d). */
  for (let i = 0; i < 6; i++) {
    const submitted = -(30 + i * 4);
    const approved  = submitted + 2;
    expenses.push({
      id: `e-ap-h-${i}`,
      category_id: null, subcategory_id: null,
      category_name: "Office",
      title: `Prior approved ${i + 1}`,
      amount: 800 + i * 200,
      currency: "USD",
      expense_date: isoDate(submitted - 1),
      payment_status: "paid",
      due_date: null,
      linked_order_id: null, linked_supplier_id: null,
      linked_customer_id: null, linked_project_id: null,
      attachment_url: null, notes: null,
      created_at: isoDate(submitted - 1) + "T00:00:00Z",
      updated_at: isoDate(approved) + "T00:00:00Z",
      approval_status: "approved",
      submitted_at: isoDate(submitted),
      submitted_by: submitter,
      reviewed_at: isoDate(approved),
      reviewed_by: reviewerB,
      approved_at: isoDate(approved),
      approved_by: reviewerB,
      rejected_at: null, rejected_by: null,
      rejection_reason: null, requires_changes_reason: null, review_notes: null,
      approval_level: 0,
    });
  }

  /* Build a base healthy KPI shape so the rest of the engine stays calm. */
  const base = healthyState().inputs.kpi!;

  return {
    name: "APPROVAL_PRESSURE_STATE",
    description: "Backlog of 8 pending reviews, one 22 days old, concentrated on a single reviewer.",
    inputs: {
      kpi: base,
      orders: [],
      payments: [],
      expenses,
      periodDays: 90,
    },
    expectations: {
      digestRange: [1, 5],
      eventRange: [1, 12],
      /* Approval is one of six health dimensions with a ~7.5% weight,
         so isolated approval pressure cannot drag the composite into
         the lower bands while everything else stays healthy. The
         signal lives in the events + digest, not in the headline
         number — which is exactly the discipline this phase enforces. */
      healthRange: [60, 98],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 2,
      copilotMaxHints: 3,
      expectEventKinds: ["approval_backlog", "review_delay", "approval_concentration"],
    },
  };
}

/* E — RECOVERY_STATE
   Previously bad signals are now de-escalating. We simulate "prior memory"
   by attaching it through the IntelligenceInputs.memory channel. */
export function recoveryState(): Scenario {
  /* Reuse the moderate-pressure shape but with milder current signals
     AND a prior-memory snapshot showing the same signals were worse. */
  const base = moderatePressureState();
  /* Build a prior-run memory blob mirroring "things were worse a run ago".
     Severities typed via Record<string, Severity> so TS doesn't infer
     each run's per-key literal shape (which mismatches RunSnapshot). */
  const severitiesA: Record<string, Severity> = {
    "overdue-o-m-1": "risk",
    "fin-liquidity": "risk",
    "logistics-spike": "risk",
    "fin-margin-drop": "watch",
  };
  const severitiesB: Record<string, Severity> = {
    "overdue-o-m-1": "watch",
    "fin-liquidity": "watch",
    "logistics-spike": "watch",
  };
  const memory = {
    version: 1 as const,
    runs: [
      { ts: NOW.getTime() - 3 * 86_400_000, severities: severitiesA },
      { ts: NOW.getTime() - 1 * 86_400_000, severities: severitiesB },
    ],
    lastHealthScore: 62,
  };
  return {
    name: "RECOVERY_STATE",
    description: "Previously bad signals improving; persistence-aware recovery messaging expected.",
    inputs: {
      ...base.inputs,
      memory,
    },
    expectations: {
      digestRange: [0, 5],
      eventRange: [0, 12],
      healthRange: [50, 85],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 1,
      copilotMaxHints: 3,
    },
  };
}

/* PAYMENT_CONTROL_STATE
   - one approved supplier payment not reconciled (USD 12K)
   - one customer payment received with a USD 600 mismatch
   - one USD 30K payment pending approval (large_unapproved)
   - one paid payment missing evidence
   - other dimensions calm so the panel + digest must explicitly
     surface payment-control narratives rather than ride along on
     general pressure. */
export function paymentControlState(): Scenario {
  const base = healthyState();
  const payments: FinancePayment[] = [
    /* 1) Approved supplier payment, paid 10 days ago, unreconciled. */
    {
      id: "p-pc-1",
      direction: "out",
      party_type: "supplier",
      party_id: "supplier-1",
      party_name: "Ningbo Steel",
      amount: 12_000,
      currency: "USD",
      payment_date: isoDate(-10),
      payment_method: "T/T",
      reference_no: "REF-001",
      status: "completed",
      linked_order_id: null,
      linked_order_supplier_id: null,
      linked_expense_id: null,
      notes: null,
      created_at: isoDate(-12) + "T00:00:00Z",
      updated_at: isoDate(-10) + "T00:00:00Z",
      movement_status: "paid",
      reconciliation_status: "unreconciled",
      approval_status: "approved",
      submitted_at: isoDate(-12),
      submitted_by: "u-sub",
      approved_at: isoDate(-11),
      approved_by: "u-mgr",
      reviewed_at: isoDate(-11),
      reviewed_by: "u-mgr",
      expected_amount: 12_000,
      actual_amount: null,
      payment_evidence_count: 0,
      has_payment_evidence: false,
    },
    /* 2) Customer payment received, mismatched USD 600. */
    {
      id: "p-pc-2",
      direction: "in",
      party_type: "customer",
      party_id: "customer-1",
      party_name: "Cairo Knits",
      amount: 8_400,
      currency: "USD",
      payment_date: isoDate(-5),
      payment_method: "T/T",
      reference_no: "REF-002",
      status: "completed",
      linked_order_id: null,
      linked_order_supplier_id: null,
      linked_expense_id: null,
      notes: null,
      created_at: isoDate(-7) + "T00:00:00Z",
      updated_at: isoDate(-5) + "T00:00:00Z",
      movement_status: "received",
      reconciliation_status: "mismatch",
      approval_status: "approved",
      submitted_at: isoDate(-7),
      submitted_by: "u-sub",
      approved_at: isoDate(-6),
      approved_by: "u-mgr",
      reviewed_at: isoDate(-6),
      reviewed_by: "u-mgr",
      expected_amount: 9_000,
      actual_amount: 8_400,
      difference_amount: -600,
      bank_reference: "MT103-XX",
      payment_evidence_count: 1,
      has_payment_evidence: true,
    },
    /* 3) USD 30K supplier payment pending approval — large_unapproved. */
    {
      id: "p-pc-3",
      direction: "out",
      party_type: "supplier",
      party_id: "supplier-2",
      party_name: "Hangzhou Castings",
      amount: 30_000,
      currency: "USD",
      payment_date: isoDate(3),
      payment_method: "T/T",
      reference_no: "REF-003",
      status: "pending",
      linked_order_id: null,
      linked_order_supplier_id: null,
      linked_expense_id: null,
      notes: null,
      created_at: isoDate(-3) + "T00:00:00Z",
      updated_at: isoDate(-3) + "T00:00:00Z",
      movement_status: "scheduled",
      reconciliation_status: "unreconciled",
      approval_status: "submitted",
      submitted_at: isoDate(-3),
      submitted_by: "u-sub",
      reviewed_at: null,
      reviewed_by: null,
      approved_at: null,
      approved_by: null,
      expected_amount: 30_000,
      actual_amount: null,
      payment_evidence_count: 0,
      has_payment_evidence: false,
    },
    /* 4) Paid expense payment, missing evidence (paid 7 days ago, no upload). */
    {
      id: "p-pc-4",
      direction: "out",
      party_type: "other",
      party_id: null,
      party_name: "Customs broker",
      amount: 2_200,
      currency: "USD",
      payment_date: isoDate(-7),
      payment_method: "T/T",
      reference_no: "REF-004",
      status: "completed",
      linked_order_id: null,
      linked_order_supplier_id: null,
      linked_expense_id: null,
      notes: null,
      created_at: isoDate(-9) + "T00:00:00Z",
      updated_at: isoDate(-7) + "T00:00:00Z",
      movement_status: "paid",
      reconciliation_status: "unreconciled",
      approval_status: "approved",
      submitted_at: isoDate(-9),
      submitted_by: "u-sub",
      approved_at: isoDate(-8),
      approved_by: "u-mgr",
      expected_amount: 2_200,
      actual_amount: 2_200,
      payment_evidence_count: 0,
      has_payment_evidence: false,
    },
    /* 5) Another paid one missing evidence so the missing_evidence
          threshold (≥ 2 lines) fires. */
    {
      id: "p-pc-5",
      direction: "out",
      party_type: "other",
      party_id: null,
      party_name: "Shipping line",
      amount: 1_800,
      currency: "USD",
      payment_date: isoDate(-6),
      payment_method: "T/T",
      reference_no: "REF-005",
      status: "completed",
      linked_order_id: null,
      linked_order_supplier_id: null,
      linked_expense_id: null,
      notes: null,
      created_at: isoDate(-8) + "T00:00:00Z",
      updated_at: isoDate(-6) + "T00:00:00Z",
      movement_status: "paid",
      reconciliation_status: "unreconciled",
      approval_status: "approved",
      submitted_at: isoDate(-8),
      submitted_by: "u-sub",
      approved_at: isoDate(-7),
      approved_by: "u-mgr",
      expected_amount: 1_800,
      actual_amount: 1_800,
      payment_evidence_count: 0,
      has_payment_evidence: false,
    },
  ];
  return {
    name: "PAYMENT_CONTROL_STATE",
    description: "One unreconciled supplier payment, one mismatched customer payment, one USD 30K pending approval, two paid lines missing evidence.",
    inputs: {
      ...base.inputs,
      payments,
    },
    expectations: {
      digestRange: [1, 5],
      eventRange: [2, 12],
      /* Payment dimension at 10% weight; isolated payment pressure
         can move the composite into the 80s but rarely below. */
      healthRange: [60, 98],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 2,
      copilotMaxHints: 3,
      expectEventKinds: [
        "large_unapproved_payment",
        "payment_mismatch",
        "unreconciled_payment",
        "missing_payment_evidence",
      ],
    },
  };
}

/* ---------------------------------------------------------------------------
   Phase 2.4 — Treasury scenarios

   Five deterministic states stress-test the treasury intelligence
   pipeline. Reused helpers below build bank accounts and cash
   movements in the same calm, IDs-only style as the rest of the suite.
   --------------------------------------------------------------------------- */

function makeBankAccount(spec: Partial<BankAccount> & { id: string; bank_name: string; currency: string }): BankAccount {
  return {
    id: spec.id,
    bank_name: spec.bank_name,
    account_name: spec.account_name ?? `${spec.bank_name} Main`,
    account_number: spec.account_number ?? null,
    iban: spec.iban ?? null,
    swift_code: spec.swift_code ?? null,
    currency: spec.currency,
    country: spec.country ?? null,
    opening_balance: spec.opening_balance ?? 0,
    current_balance: spec.current_balance ?? spec.available_balance ?? 0,
    available_balance: spec.available_balance ?? 0,
    pending_balance: spec.pending_balance ?? 0,
    restricted_balance: spec.restricted_balance ?? 0,
    status: spec.status ?? "active",
    is_primary: spec.is_primary ?? false,
    last_reconciled_at: spec.last_reconciled_at ?? null,
    metadata: spec.metadata ?? {},
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  };
}

function makeMovement(spec: Partial<CashMovement> & {
  id: string; bank_account_id: string;
  movement_type: CashMovement["movement_type"];
  direction: CashMovement["direction"];
  amount: number; currency: string; movement_date: string;
}): CashMovement {
  return {
    id: spec.id,
    bank_account_id: spec.bank_account_id,
    related_payment_id: spec.related_payment_id ?? null,
    movement_type: spec.movement_type,
    direction: spec.direction,
    currency: spec.currency,
    amount: spec.amount,
    exchange_rate: spec.exchange_rate ?? null,
    reporting_amount: spec.reporting_amount ?? null,
    bank_reference: spec.bank_reference ?? null,
    external_reference: spec.external_reference ?? null,
    counterparty_name: spec.counterparty_name ?? null,
    movement_date: spec.movement_date,
    cleared_at: spec.cleared_at ?? null,
    reconciliation_status: spec.reconciliation_status ?? "unreconciled",
    evidence_status: spec.evidence_status ?? "missing",
    notes: spec.notes ?? null,
    metadata: spec.metadata ?? {},
    created_by: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  };
}

/* TREASURY_HEALTHY_STATE
   Two accounts, healthy buffer, no movements outstanding. The treasury
   layer should be silent. */
export function treasuryHealthyState(): Scenario {
  const base = healthyState();
  return {
    name: "TREASURY_HEALTHY_STATE",
    description: "Healthy bank position across two reporting-currency accounts. Treasury layer should stay calm.",
    inputs: {
      ...base.inputs,
      bankAccounts: [
        makeBankAccount({
          id: "ba-th-1", bank_name: "First National", currency: "USD",
          available_balance: 240_000, is_primary: true,
          last_reconciled_at: isoDate(-2),
        }),
        makeBankAccount({
          id: "ba-th-2", bank_name: "Citi Operating", currency: "USD",
          available_balance: 120_000,
        }),
      ],
      cashMovements: [],
    },
    expectations: {
      digestRange: [0, 1],
      eventRange: [0, 1],
      healthRange: [80, 100],
      copilotCalm: true,
      copilotMaxHints: 1,
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      forbidEventKinds: [
        "low_cash_buffer", "negative_runway", "liquidity_gap",
        "overdraft_risk", "transfer_failure",
      ],
      maxCriticalDigestItems: 0,
    },
  };
}

/* LIQUIDITY_PRESSURE_STATE
   Available cash is thin AND a USD 50K supplier payment is due in
   8 days that the timeline projects negatively. */
export function liquidityPressureState(): Scenario {
  const base = healthyState();
  const supplierDueOrder = makeOrder({
    id: "o-lp-1",
    order_no: "ORD-2026-0061",
    customer_id: "c-lp-1",
    customer_name: "Aswan Heavy",
    selling_price: 50_000,
    due_in_days: 18,
    outstanding_receivable: 18_000,
    suppliers: [
      { id: "s-lp-1", name: "Ningbo Cast Co", cost: 38_000, paid: 0, due_in_days: 8 },
    ],
  });
  return {
    name: "LIQUIDITY_PRESSURE_STATE",
    description: "Thin cash buffer with a USD 38K supplier obligation due in 8 days. Liquidity-gap signal expected.",
    inputs: {
      ...base.inputs,
      orders: [...base.inputs.orders, supplierDueOrder],
      bankAccounts: [
        makeBankAccount({
          id: "ba-lp-1", bank_name: "First National", currency: "USD",
          available_balance: 12_000, is_primary: true,
        }),
      ],
      cashMovements: [],
    },
    expectations: {
      digestRange: [1, 5],
      eventRange: [1, 12],
      healthRange: [40, 92],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 2,
      copilotMaxHints: 3,
      expectEventKinds: ["low_cash_buffer"],
    },
  };
}

/* FX_EXPOSURE_STATE
   70% of treasury sits in CNY across two large accounts; reporting
   currency is USD. Expected: fx_exposure event surfaces; composite
   health still healthy because cash exists. */
export function fxExposureState(): Scenario {
  const base = healthyState();
  return {
    name: "FX_EXPOSURE_STATE",
    description: "70% of cash held in CNY with reporting currency USD. FX exposure event expected.",
    inputs: {
      ...base.inputs,
      bankAccounts: [
        makeBankAccount({
          id: "ba-fx-1", bank_name: "ICBC Ningbo", currency: "CNY",
          available_balance: 6_500_000, is_primary: true,
          country: "CN",
        }),
        makeBankAccount({
          id: "ba-fx-2", bank_name: "BoC Hangzhou", currency: "CNY",
          available_balance: 2_800_000,
        }),
        makeBankAccount({
          id: "ba-fx-3", bank_name: "First National", currency: "USD",
          available_balance: 380_000, is_primary: true,
        }),
      ],
      cashMovements: [],
    },
    expectations: {
      digestRange: [0, 4],
      eventRange: [1, 6],
      healthRange: [70, 100],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 1,
      copilotMaxHints: 3,
      expectEventKinds: ["fx_exposure"],
    },
  };
}

/* BANK_MISMATCH_STATE
   Several unreconciled cash movements older than 7 days. Expected:
   unreconciled_bank_activity + a digest entry. */
export function bankMismatchState(): Scenario {
  const base = healthyState();
  const accountId = "ba-bm-1";
  const movements: CashMovement[] = [];
  for (let i = 0; i < 5; i++) {
    movements.push(makeMovement({
      id: `cm-bm-${i + 1}`,
      bank_account_id: accountId,
      movement_type: i % 2 === 0 ? "outgoing" : "incoming",
      direction: i % 2 === 0 ? "outflow" : "inflow",
      amount: 4_000 + i * 1_500,
      currency: "USD",
      movement_date: isoDate(-(10 + i * 2)),
      bank_reference: `MT-${1000 + i}`,
      counterparty_name: i % 2 === 0 ? "Ningbo Steel" : "Cairo Knits",
    }));
  }
  return {
    name: "BANK_MISMATCH_STATE",
    description: "Five cash movements unreconciled, all older than 7 days. unreconciled_bank_activity expected.",
    inputs: {
      ...base.inputs,
      bankAccounts: [
        makeBankAccount({
          id: accountId, bank_name: "First National", currency: "USD",
          available_balance: 180_000, is_primary: true,
        }),
      ],
      cashMovements: movements,
    },
    expectations: {
      digestRange: [1, 5],
      eventRange: [1, 12],
      healthRange: [55, 100],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 2,
      copilotMaxHints: 3,
      expectEventKinds: ["unreconciled_bank_activity"],
    },
  };
}

/* NEGATIVE_RUNWAY_STATE
   Available cash low AND a USD 200K supplier payment due in 5 days.
   The projection should cross zero within the horizon.
   negative_runway event expected (likely critical/risk). */
export function negativeRunwayState(): Scenario {
  const base = healthyState();
  const supplierDueOrder = makeOrder({
    id: "o-nr-1",
    order_no: "ORD-2026-0071",
    customer_id: "c-nr-1",
    customer_name: "Tanta Mills",
    selling_price: 250_000,
    due_in_days: 60,
    outstanding_receivable: 250_000,
    suppliers: [
      { id: "s-nr-1", name: "Hangzhou Castings", cost: 200_000, paid: 0, due_in_days: 5 },
    ],
  });
  return {
    name: "NEGATIVE_RUNWAY_STATE",
    description: "Cash low, USD 200K supplier payment due in 5 days, AR not until day 60. Negative runway expected.",
    inputs: {
      ...base.inputs,
      orders: [...base.inputs.orders, supplierDueOrder],
      bankAccounts: [
        makeBankAccount({
          id: "ba-nr-1", bank_name: "First National", currency: "USD",
          available_balance: 40_000, is_primary: true,
        }),
      ],
      cashMovements: [],
    },
    expectations: {
      digestRange: [1, 5],
      eventRange: [2, 12],
      healthRange: [10, 90],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 3,
      copilotMaxHints: 3,
      expectEventKinds: ["negative_runway"],
    },
  };
}

/* ---------------------------------------------------------------------------
   Reconciliation candidate fixture builder (Phase 2.5).
   --------------------------------------------------------------------------- */

function makeCandidate(spec: {
  id: string;
  payment_id: string;
  cash_movement_id: string;
  confidence: number;
  confidence_level: ReconciliationConfidenceLevel;
  candidate_type: ReconciliationCandidateType;
  status?: ReconciliationCandidateStatus;
  match_reason_summary?: string;
  rejected_at?: string | null;
}): FinanceReconciliationCandidate {
  return {
    id: spec.id,
    tenant_id: "tenant-test",
    payment_id: spec.payment_id,
    cash_movement_id: spec.cash_movement_id,
    confidence: spec.confidence,
    confidence_level: spec.confidence_level,
    candidate_type: spec.candidate_type,
    match_reason_summary:
      spec.match_reason_summary ?? `${Math.round(spec.confidence * 100)}% confidence.`,
    matched_factors: [
      { key: "amount", label: "Same amount", score: 1 },
      { key: "direction", label: "Same direction", score: 1 },
    ],
    warnings: [],
    status: spec.status ?? "suggested",
    suggested_at: isoDate(-1) + "T09:00:00Z",
    confirmed_at: null,
    confirmed_by: null,
    rejected_at: spec.rejected_at ?? null,
    rejected_by: null,
    rejection_reason: null,
    metadata: {},
    created_at: isoDate(-1) + "T09:00:00Z",
    updated_at: isoDate(-1) + "T09:00:00Z",
  };
}

/* AUTO_RECONCILIATION_STATE — Phase 2.5
   The reconciliation engine has emitted:
     · one EXACT high-confidence match (suggested, awaiting confirm)
     · one PARTIAL match (suggested, partial settlement)
     · one DUPLICATE-RISK candidate (suggested)
     · one REJECTED candidate (must NOT reappear in suggested set)
     · one LOW-confidence pair that the engine never promoted to a row
       at all (i.e. it was below the 0.35 floor — the harness asserts
       the digest stays calm and Copilot doesn't echo noise).

   Expectations:
     · expectEventKinds includes high_confidence_unconfirmed_match,
       partial_match_pressure, duplicate_cash_movement_risk
     · forbidEventKinds does NOT need to forbid noise kinds — the
       materiality gate handles them. Test that rejected pair does
       not produce a new event by keeping pending counts within the
       expected band.
     · health remains in a calm-to-watch band (reconciliation pressure
       alone is not a critical signal)
     · copilot surfaces useful hints; we cap at 3 (default). */
export function autoReconciliationState(): Scenario {
  const base = healthyState();
  const movements: CashMovement[] = [
    /* High-confidence exact match — same amount + reference + date. */
    makeMovement({
      id: "cm-rec-1",
      bank_account_id: "ba-rec-1",
      movement_type: "incoming",
      direction: "inflow",
      amount: 22_000,
      currency: "USD",
      movement_date: isoDate(-2),
      bank_reference: "TT-EXACT-001",
      counterparty_name: "ACME Spinning",
    }),
    /* Partial settlement — bank received only 60% of expected. */
    makeMovement({
      id: "cm-rec-2",
      bank_account_id: "ba-rec-1",
      movement_type: "incoming",
      direction: "inflow",
      amount: 18_000,
      currency: "USD",
      movement_date: isoDate(-3),
      bank_reference: "TT-PARTIAL-002",
      counterparty_name: "Cairo Knits",
    }),
    /* Duplicate movement — same as cm-rec-3, different id. */
    makeMovement({
      id: "cm-rec-3",
      bank_account_id: "ba-rec-1",
      movement_type: "outgoing",
      direction: "outflow",
      amount: 12_000,
      currency: "USD",
      movement_date: isoDate(-4),
      bank_reference: "TT-DUP-003",
      counterparty_name: "Ningbo Steel",
    }),
    makeMovement({
      id: "cm-rec-4",
      bank_account_id: "ba-rec-1",
      movement_type: "outgoing",
      direction: "outflow",
      amount: 12_000,
      currency: "USD",
      movement_date: isoDate(-4),
      bank_reference: "TT-DUP-003",
      counterparty_name: "Ningbo Steel",
    }),
  ];
  const payments: FinancePayment[] = [
    /* Match for cm-rec-1 (exact, high confidence). */
    makePayment({
      id: "p-rec-1",
      direction: "in",
      party_type: "customer",
      party_name: "ACME Spinning",
      amount: 22_000,
      currency: "USD",
      payment_date: isoDate(-2),
      reference_no: "TT-EXACT-001",
    }),
    /* Match for cm-rec-2 (partial — expected 30K, bank got 18K). */
    makePayment({
      id: "p-rec-2",
      direction: "in",
      party_type: "customer",
      party_name: "Cairo Knits",
      amount: 30_000,
      currency: "USD",
      payment_date: isoDate(-3),
      reference_no: "TT-PARTIAL-002",
    }),
    /* The supplier-side payment behind the duplicate-risk pair. */
    makePayment({
      id: "p-rec-3",
      direction: "out",
      party_type: "supplier",
      party_name: "Ningbo Steel",
      amount: 12_000,
      currency: "USD",
      payment_date: isoDate(-4),
      reference_no: "TT-DUP-003",
    }),
    /* Rejected pair — payment that operator already said "no" to. */
    makePayment({
      id: "p-rec-4-rejected",
      direction: "in",
      party_type: "customer",
      party_name: "Tanta Textiles",
      amount: 9_500,
      currency: "USD",
      payment_date: isoDate(-8),
      reference_no: "TT-REJ-004",
    }),
  ];
  const candidates: FinanceReconciliationCandidate[] = [
    /* 1. Exact high-confidence — suggested. */
    makeCandidate({
      id: "rec-1",
      payment_id: "p-rec-1",
      cash_movement_id: "cm-rec-1",
      confidence: 0.94,
      confidence_level: "high",
      candidate_type: "exact",
      match_reason_summary:
        "94% confidence, same amount, same USD, reference match, same-day movement.",
    }),
    /* 2. Partial — suggested. */
    makeCandidate({
      id: "rec-2",
      payment_id: "p-rec-2",
      cash_movement_id: "cm-rec-2",
      confidence: 0.72,
      confidence_level: "medium",
      candidate_type: "partial",
      match_reason_summary:
        "72% confidence; partial settlement — bank received 60% of expected.",
    }),
    /* 3. Partial — second one so partial_match_pressure threshold (≥3) trips. */
    makeCandidate({
      id: "rec-2b",
      payment_id: "p-rec-2",
      cash_movement_id: "cm-rec-1",
      confidence: 0.66,
      confidence_level: "medium",
      candidate_type: "partial",
      match_reason_summary: "66% confidence; partial settlement.",
    }),
    /* 4. Partial — third one. */
    makeCandidate({
      id: "rec-2c",
      payment_id: "p-rec-3",
      cash_movement_id: "cm-rec-3",
      confidence: 0.62,
      confidence_level: "medium",
      candidate_type: "underpayment",
      match_reason_summary: "62% confidence; bank short of payment.",
    }),
    /* 5. Duplicate-risk — suggested. */
    makeCandidate({
      id: "rec-3",
      payment_id: "p-rec-3",
      cash_movement_id: "cm-rec-4",
      confidence: 0.91,
      confidence_level: "high",
      candidate_type: "duplicate_risk",
      match_reason_summary:
        "91% confidence; possible duplicate bank movement on Ningbo Steel.",
    }),
    /* 6. Rejected pair — operator already said no. The matcher's
          rescan path skips it; the validator confirms it is NOT in
          the suggested counts. */
    makeCandidate({
      id: "rec-4-rejected",
      payment_id: "p-rec-4-rejected",
      cash_movement_id: "cm-rec-1",
      confidence: 0.61,
      confidence_level: "medium",
      candidate_type: "exact",
      status: "rejected",
      rejected_at: isoDate(-1) + "T11:00:00Z",
      match_reason_summary: "61% confidence; rejected by operator.",
    }),
    /* 7. Second rejection on the same pair so the "repeat-rejection"
          signal threshold is exercised (but the materiality gate keeps
          it from over-firing — the harness only checks the recon
          snapshot remains internally consistent). */
    makeCandidate({
      id: "rec-4-rejected-b",
      payment_id: "p-rec-4-rejected",
      cash_movement_id: "cm-rec-1",
      confidence: 0.55,
      confidence_level: "medium",
      candidate_type: "exact",
      status: "rejected",
      rejected_at: isoDate(-2) + "T08:00:00Z",
      match_reason_summary: "55% confidence; rejected by operator (earlier).",
    }),
    /* 8. NOTE: the low-confidence pair (0.30) is deliberately NOT a
          candidate row here — the engine never persisted it because
          it was below the 0.35 floor. The validator therefore asserts
          on absence of any low-confidence signal getting through. */
  ];
  return {
    name: "AUTO_RECONCILIATION_STATE",
    description:
      "One exact high-confidence match, partial / underpayment matches, a duplicate-risk movement, " +
      "a previously-rejected pair, and a low-confidence pair that must remain suppressed.",
    inputs: {
      ...base.inputs,
      payments: [...base.inputs.payments, ...payments],
      bankAccounts: [
        makeBankAccount({
          id: "ba-rec-1",
          bank_name: "First National",
          currency: "USD",
          available_balance: 220_000,
          is_primary: true,
        }),
      ],
      cashMovements: movements,
      reconciliationCandidates: candidates,
    },
    expectations: {
      digestRange: [0, 5],
      eventRange: [1, 14],
      healthRange: [60, 100],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 2,
      copilotMaxHints: 3,
      expectEventKinds: [
        "high_confidence_unconfirmed_match",
        "duplicate_cash_movement_risk",
        "partial_match_pressure",
      ],
    },
  };
}

/* ---------------------------------------------------------------------------
   Bank-statement import fixture builder (Phase 2.6).
   --------------------------------------------------------------------------- */

function makeBankImport(spec: {
  id: string;
  bank_account_id: string;
  status: BankStatementImport["status"];
  row_count?: number;
  imported_count?: number;
  duplicate_count?: number;
  error_count?: number;
  uploaded_days_ago?: number;
  confirmed_days_ago?: number;
  file_name?: string;
  file_type?: BankStatementImport["file_type"];
}): BankStatementImport {
  const uploaded = spec.uploaded_days_ago != null ? isoDate(-spec.uploaded_days_ago) + "T08:00:00Z" : isoDate(-1) + "T08:00:00Z";
  const confirmed = spec.confirmed_days_ago != null ? isoDate(-spec.confirmed_days_ago) + "T09:00:00Z" : null;
  return {
    id: spec.id,
    tenant_id: "tenant-test",
    bank_account_id: spec.bank_account_id,
    file_name: spec.file_name ?? "statement.csv",
    file_type: spec.file_type ?? "csv",
    file_size: 4096,
    storage_path: `tenant-test/bank-statements/${spec.id}/statement.csv`,
    status: spec.status,
    row_count: spec.row_count ?? 0,
    imported_count: spec.imported_count ?? 0,
    duplicate_count: spec.duplicate_count ?? 0,
    error_count: spec.error_count ?? 0,
    uploaded_by: null,
    uploaded_at: uploaded,
    confirmed_by: null,
    confirmed_at: confirmed,
    notes: null,
    metadata: {},
    created_at: uploaded,
    updated_at: uploaded,
  };
}

/* BANK_IMPORT_STATE — Phase 2.6
   Mixes real-life import outcomes:
     · one confirmed import that produced many unreconciled movements
       within the last 7 days → large_unreconciled_import
     · one failed import within the last 30 days → bank_import_failed
     · one duplicate-heavy import → duplicate_statement_rows
     · one bank account that has not received a statement in 21+ days
       → bank_statement_import_gap
     · 3 new cash movements from the recent import
     · 1 duplicate row, 1 possible duplicate (modelled implicitly via
       the import's duplicate_count + duplicate-flagged movements)
     · 1 rejected reconciliation candidate that must remain rejected */
export function bankImportState(): Scenario {
  const base = healthyState();
  const acctActive  = "ba-bi-1";
  const acctIdle    = "ba-bi-2";

  const accounts: BankAccount[] = [
    makeBankAccount({
      id: acctActive, bank_name: "First National", currency: "USD",
      available_balance: 320_000, is_primary: true,
    }),
    makeBankAccount({
      id: acctIdle, bank_name: "ICBC Ningbo", currency: "CNY",
      available_balance: 2_400_000,
    }),
  ];

  /* 12 unreconciled movements on the active account, all from the
     recent confirmed import → triggers large_unreconciled_import. */
  const importedMovements: CashMovement[] = [];
  for (let i = 0; i < 12; i++) {
    importedMovements.push(makeMovement({
      id: `cm-bi-${i + 1}`,
      bank_account_id: acctActive,
      movement_type: i % 2 === 0 ? "incoming" : "outgoing",
      direction: i % 2 === 0 ? "inflow" : "outflow",
      amount: 4_000 + i * 250,
      currency: "USD",
      movement_date: isoDate(-(2 + i)),
      bank_reference: `IMP-${1000 + i}`,
      counterparty_name: i % 2 === 0 ? "ACME Spinning" : "Ningbo Steel",
      reconciliation_status: "unreconciled",
      metadata: { bank_import_id: "imp-confirmed-recent" },
    }));
  }

  /* Existing rejected candidate that must not reappear in suggested. */
  const candidates: FinanceReconciliationCandidate[] = [
    {
      id: "rec-rej-1",
      tenant_id: "tenant-test",
      payment_id: "p-existing",
      cash_movement_id: "cm-bi-1",
      confidence: 0.62,
      confidence_level: "medium",
      candidate_type: "exact",
      match_reason_summary: "62% confidence; rejected by operator.",
      matched_factors: [],
      warnings: [],
      status: "rejected",
      suggested_at: isoDate(-3) + "T08:00:00Z",
      confirmed_at: null,
      confirmed_by: null,
      rejected_at: isoDate(-1) + "T08:00:00Z",
      rejected_by: null,
      rejection_reason: null,
      metadata: {},
      created_at: isoDate(-3) + "T08:00:00Z",
      updated_at: isoDate(-1) + "T08:00:00Z",
    },
  ];

  const imports: BankStatementImport[] = [
    /* Recent confirmed import — produces 12 unreconciled movements
       → large_unreconciled_import event. */
    makeBankImport({
      id: "imp-confirmed-recent",
      bank_account_id: acctActive,
      status: "confirmed",
      row_count: 14,
      imported_count: 12,
      duplicate_count: 1,        // 1 hard duplicate not booked
      error_count: 1,            // 1 parse error
      uploaded_days_ago: 2,
      confirmed_days_ago: 2,
      file_name: "Apr-USD-statement.csv",
    }),
    /* Failed import — operator must hear about it. */
    makeBankImport({
      id: "imp-failed",
      bank_account_id: acctActive,
      status: "failed",
      row_count: 0,
      uploaded_days_ago: 5,
      file_name: "May-malformed.xlsx",
      file_type: "xlsx",
    }),
    /* Duplicate-heavy import — 6 of 12 rows were duplicates. */
    makeBankImport({
      id: "imp-dup-heavy",
      bank_account_id: acctActive,
      status: "confirmed",
      row_count: 12,
      imported_count: 6,
      duplicate_count: 6,
      uploaded_days_ago: 9,
      confirmed_days_ago: 9,
      file_name: "Apr-USD-resend.csv",
    }),
    /* No import for acctIdle in 25 days → bank_statement_import_gap. */
    makeBankImport({
      id: "imp-old-cny",
      bank_account_id: acctIdle,
      status: "confirmed",
      row_count: 20,
      imported_count: 20,
      uploaded_days_ago: 25,
      confirmed_days_ago: 25,
      file_name: "Mar-CNY-statement.csv",
    }),
  ];

  return {
    name: "BANK_IMPORT_STATE",
    description:
      "One confirmed import landed 12 unreconciled movements; one import failed; one was duplicate-heavy; one CNY account has no statement in 25 days. Rejected candidates must NOT reappear.",
    inputs: {
      ...base.inputs,
      bankAccounts: accounts,
      cashMovements: importedMovements,
      reconciliationCandidates: candidates,
      bankStatementImports: imports,
    },
    expectations: {
      digestRange: [0, 6],
      eventRange: [1, 18],
      healthRange: [50, 100],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 3,
      copilotMaxHints: 3,
      expectEventKinds: [
        "bank_import_failed",
        "large_unreconciled_import",
        "duplicate_statement_rows",
        "bank_statement_import_gap",
      ],
    },
  };
}

/* ---------------------------------------------------------------------------
   Phase 2.8 — Treasury Forecast scenarios.
   --------------------------------------------------------------------------- */

/* TREASURY_FORECAST_BASE_STATE
   Healthy treasury position. Forecast layer should stay silent — no
   forecast_negative_cash, no forecast_runway_risk. */
export function treasuryForecastBaseState(): Scenario {
  const base = healthyState();
  return {
    name: "TREASURY_FORECAST_BASE_STATE",
    description:
      "Strong cash position + balanced supplier and customer expectations. Forecast layer must stay calm.",
    inputs: {
      ...base.inputs,
      bankAccounts: [
        makeBankAccount({
          id: "ba-fc-1",
          bank_name: "First National",
          currency: "USD",
          available_balance: 380_000,
          is_primary: true,
        }),
      ],
      cashMovements: [],
    },
    expectations: {
      digestRange: [0, 4],
      eventRange: [0, 6],
      healthRange: [80, 100],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 1,
      copilotMaxHints: 3,
      /* Calm baseline — forecast events should NOT fire here. */
      forbidEventKinds: ["forecast_negative_cash", "forecast_runway_risk"],
    },
  };
}

/* TREASURY_FORECAST_STRESS_STATE
   Customer delay + thin starting cash + a big supplier obligation
   together produce a negative-cash projection. The forecast layer
   must surface forecast_negative_cash + customer_delay_cash_risk. */
export function treasuryForecastStressState(): Scenario {
  const base = healthyState();
  /* Big future supplier obligation in 5 days. */
  const supplierDueOrder = makeOrder({
    id: "o-fs-1",
    order_no: "ORD-2026-0099",
    customer_id: "c-fs-1",
    customer_name: "Tanta Mills",
    selling_price: 200_000,
    /* Customer pays in 50 days. */
    due_in_days: 50,
    outstanding_receivable: 200_000,
    suppliers: [
      { id: "s-fs-1", name: "Hangzhou Castings", cost: 240_000, paid: 0, due_in_days: 5 },
    ],
  });
  return {
    name: "TREASURY_FORECAST_STRESS_STATE",
    description:
      "Thin cash + customer collection delayed 30d + a 240K supplier obligation due in 5d. Forecast crosses zero.",
    inputs: {
      ...base.inputs,
      orders: [...base.inputs.orders, supplierDueOrder],
      bankAccounts: [
        makeBankAccount({
          id: "ba-fs-1",
          bank_name: "First National",
          currency: "USD",
          available_balance: 60_000,
          is_primary: true,
        }),
      ],
      cashMovements: [],
      forecastAssumptions: { customerDelay: { days: 30 } },
    },
    expectations: {
      digestRange: [1, 6],
      eventRange: [1, 12],
      healthRange: [40, 95],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 3,
      copilotMaxHints: 3,
      expectEventKinds: ["forecast_negative_cash", "customer_delay_cash_risk"],
    },
  };
}

/* FX_SHOCK_STATE
   Material CNY cash flows in the 90-day window. A −10% FX shock on
   non-USD flows produces a reporting-currency hit large enough to
   fire fx_shock_cash_risk. (Distinct from FX_EXPOSURE_STATE which
   tests the Phase 2.4 static fx_exposure event.) */
export function fxShockState(): Scenario {
  const base = healthyState();
  /* Several CNY cash movements scheduled into the forecast horizon
     (unreconciled so the engine treats them as forward events). */
  const cnyMovements: CashMovement[] = [];
  for (let i = 0; i < 6; i += 1) {
    cnyMovements.push(makeMovement({
      id: `cm-fx-${i + 1}`,
      bank_account_id: "ba-fx-1",
      movement_type: i % 2 === 0 ? "outgoing" : "incoming",
      direction: i % 2 === 0 ? "outflow" : "inflow",
      amount: 600_000 + i * 120_000,
      currency: "CNY",
      movement_date: isoDate(10 + i * 6),
      bank_reference: `CNY-FX-${i + 1}`,
      counterparty_name: i % 2 === 0 ? "Ningbo Steel" : "Cairo Knits",
    }));
  }
  return {
    name: "FX_SHOCK_STATE",
    description:
      "Six CNY cash movements scheduled in the next 60 days. A −10% FX shock on CNY flows reduces 90-day reporting cash materially.",
    inputs: {
      ...base.inputs,
      bankAccounts: [
        makeBankAccount({ id: "ba-fx-1", bank_name: "ICBC Ningbo",   currency: "CNY", available_balance: 6_000_000, is_primary: true, country: "CN" }),
        makeBankAccount({ id: "ba-fx-2", bank_name: "First National", currency: "USD", available_balance: 300_000, is_primary: true }),
      ],
      cashMovements: cnyMovements,
      forecastAssumptions: { fxShock: { pct: 10 } },
    },
    expectations: {
      digestRange: [0, 6],
      eventRange: [1, 14],
      healthRange: [55, 100],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 2,
      copilotMaxHints: 3,
      expectEventKinds: ["fx_shock_cash_risk"],
    },
  };
}

/* SUPPLIER_ACCELERATION_STATE
   Pulling supplier payments 15 days earlier compresses the cash
   buffer enough to surface supplier_acceleration_risk + erode
   runway. */
export function supplierAccelerationState(): Scenario {
  const base = healthyState();
  /* Several supplier payments scheduled across the next 60 days. */
  const heavyAp1 = makeOrder({
    id: "o-sa-1",
    order_no: "ORD-2026-0200",
    customer_id: "c-sa-1",
    customer_name: "Alexandria Looms",
    selling_price: 180_000,
    due_in_days: 45,
    outstanding_receivable: 180_000,
    suppliers: [
      { id: "s-sa-1", name: "Hangzhou Castings", cost: 90_000, paid: 0, due_in_days: 35 },
    ],
  });
  const heavyAp2 = makeOrder({
    id: "o-sa-2",
    order_no: "ORD-2026-0201",
    customer_id: "c-sa-2",
    customer_name: "Tanta Textiles",
    selling_price: 90_000,
    due_in_days: 55,
    outstanding_receivable: 90_000,
    suppliers: [
      { id: "s-sa-2", name: "Wenzhou Drives", cost: 70_000, paid: 0, due_in_days: 40 },
    ],
  });
  return {
    name: "SUPPLIER_ACCELERATION_STATE",
    description:
      "Two supplier obligations in the 30-45 day window. Accelerating them by 15d pulls 160K USD forward and erodes runway.",
    inputs: {
      ...base.inputs,
      orders: [...base.inputs.orders, heavyAp1, heavyAp2],
      bankAccounts: [
        makeBankAccount({
          id: "ba-sa-1",
          bank_name: "First National",
          currency: "USD",
          available_balance: 140_000,
          is_primary: true,
        }),
      ],
      cashMovements: [],
      forecastAssumptions: { supplierAcceleration: { days: 15 } },
    },
    expectations: {
      digestRange: [0, 6],
      eventRange: [1, 12],
      healthRange: [55, 100],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 2,
      copilotMaxHints: 3,
      expectEventKinds: ["supplier_acceleration_risk"],
    },
  };
}

/* ---------------------------------------------------------------------------
   Phase 2.9 — Treasury Plans scenarios.
   --------------------------------------------------------------------------- */

function makeTreasuryPlan(spec: {
  id: string;
  name: string;
  status: TreasuryPlanStatus;
  metrics: TreasuryPlanMetrics;
  approvedDaysAgo?: number;
  updatedDaysAgo?: number;
}): TreasuryPlan {
  const approved = spec.approvedDaysAgo != null
    ? isoDate(-spec.approvedDaysAgo) + "T08:00:00Z"
    : null;
  const updated = isoDate(-(spec.updatedDaysAgo ?? 0)) + "T08:00:00Z";
  return {
    id: spec.id,
    tenant_id: "tenant-test",
    name: spec.name,
    description: null,
    base_forecast_snapshot: {},
    scenario_assumptions: {},
    projected_metrics: spec.metrics,
    confidence: 0.7,
    forecast_window_days: 90,
    status: spec.status,
    created_by: null,
    reviewed_by: null,
    approved_by: spec.status === "approved" ? "u-1" : null,
    approved_at: approved,
    review_notes: null,
    metadata: {},
    created_at: updated,
    updated_at: updated,
    deleted_at: null,
  };
}

/* TREASURY_PLAN_HEALTHY_STATE
   An approved plan that matches today's treasury reality. The
   divergence event must NOT fire; stale event must NOT fire. */
export function treasuryPlanHealthyState(): Scenario {
  const base = healthyState();
  /* Build the plan with metrics close to what the current forecast
     will produce given base.inputs. Healthy state has ~680K cash. */
  const plan = makeTreasuryPlan({
    id: "tp-healthy",
    name: "Approved plan · healthy",
    status: "approved",
    approvedDaysAgo: 5,
    updatedDaysAgo: 5,
    metrics: {
      startingCash: 320_000,
      d7: 322_000,
      d30: 350_000,
      d60: 360_000,
      d90: 360_000,
      lowestProjected: 320_000,
      lowestProjectedDate: isoDate(2),
      firstNegativeDate: null,
      runwayDays: null,
      totalInflow: 80_000,
      totalOutflow: 40_000,
    },
  });
  return {
    name: "TREASURY_PLAN_HEALTHY_STATE",
    description: "Approved treasury plan aligned with actual state. Plan-divergence + plan-expired events must NOT fire.",
    inputs: {
      ...base.inputs,
      bankAccounts: [
        makeBankAccount({ id: "ba-tp-1", bank_name: "First National", currency: "USD", available_balance: 320_000, is_primary: true }),
      ],
      cashMovements: [],
      treasuryPlans: [plan],
    },
    expectations: {
      digestRange: [0, 4],
      eventRange: [0, 6],
      healthRange: [80, 100],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 1,
      copilotMaxHints: 3,
      forbidEventKinds: [
        "treasury_plan_expired",
        "treasury_plan_vs_actual_divergence",
        "unreviewed_treasury_plan",
      ],
    },
  };
}

/* TREASURY_PLAN_DIVERGENCE_STATE
   Plan locked in a healthy 90-day projection; actual treasury has
   since deteriorated. Engine must surface
   treasury_plan_vs_actual_divergence. */
export function treasuryPlanDivergenceState(): Scenario {
  /* Start from the stress scenario where the live forecast crosses
     zero — but freeze a plan that thought d90 = 200K. */
  const stress = treasuryForecastStressState();
  const plan = makeTreasuryPlan({
    id: "tp-divergence",
    name: "Approved plan · pre-crisis",
    status: "approved",
    approvedDaysAgo: 14,
    updatedDaysAgo: 14,
    metrics: {
      startingCash: 60_000,
      d7: 70_000,
      d30: 150_000,
      d60: 200_000,
      d90: 200_000,
      lowestProjected: 50_000,
      lowestProjectedDate: isoDate(3),
      firstNegativeDate: null,
      runwayDays: null,
      totalInflow: 250_000,
      totalOutflow: 50_000,
    },
  });
  return {
    name: "TREASURY_PLAN_DIVERGENCE_STATE",
    description: "Approved plan stored a positive 200K d90 prediction; live forecast now negative. Divergence must fire.",
    inputs: {
      ...stress.inputs,
      treasuryPlans: [plan],
    },
    expectations: {
      digestRange: [1, 6],
      eventRange: [1, 12],
      healthRange: [40, 95],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 3,
      copilotMaxHints: 3,
      expectEventKinds: ["treasury_plan_vs_actual_divergence"],
    },
  };
}

/* TREASURY_PLAN_STALE_STATE
   Approved plan ≥ 30 days old. Engine must fire treasury_plan_expired
   regardless of whether the plan is aligned with actual state. */
export function treasuryPlanStaleState(): Scenario {
  const base = healthyState();
  const plan = makeTreasuryPlan({
    id: "tp-stale",
    name: "Approved plan · 45 days old",
    status: "approved",
    approvedDaysAgo: 45,
    updatedDaysAgo: 45,
    metrics: {
      startingCash: 320_000,
      d7: 322_000,
      d30: 350_000,
      d60: 360_000,
      d90: 360_000,
      lowestProjected: 320_000,
      lowestProjectedDate: isoDate(-43),
      firstNegativeDate: null,
      runwayDays: null,
      totalInflow: 80_000,
      totalOutflow: 40_000,
    },
  });
  return {
    name: "TREASURY_PLAN_STALE_STATE",
    description: "Approved plan is 45 days old — operator must be nudged to refresh. Stale event must fire.",
    inputs: {
      ...base.inputs,
      bankAccounts: [
        makeBankAccount({ id: "ba-tps-1", bank_name: "First National", currency: "USD", available_balance: 320_000, is_primary: true }),
      ],
      cashMovements: [],
      treasuryPlans: [plan],
    },
    expectations: {
      digestRange: [0, 4],
      eventRange: [1, 8],
      healthRange: [80, 100],
      forbiddenPhrases: FORBIDDEN_GENERIC_PHRASES,
      maxCriticalDigestItems: 1,
      copilotMaxHints: 3,
      expectEventKinds: ["treasury_plan_expired"],
    },
  };
}

export const ALL_SCENARIOS: () => Scenario[] = () => [
  healthyState(),
  moderatePressureState(),
  highRiskState(),
  falseSignalState(),
  recoveryState(),
  approvalPressureState(),
  paymentControlState(),
  treasuryHealthyState(),
  liquidityPressureState(),
  fxExposureState(),
  bankMismatchState(),
  negativeRunwayState(),
  autoReconciliationState(),
  bankImportState(),
  treasuryForecastBaseState(),
  treasuryForecastStressState(),
  fxShockState(),
  supplierAccelerationState(),
  treasuryPlanHealthyState(),
  treasuryPlanDivergenceState(),
  treasuryPlanStaleState(),
];
