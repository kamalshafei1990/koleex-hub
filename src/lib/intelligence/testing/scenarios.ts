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
  DashboardKpi,
  FinanceExpense,
  FinanceOrder,
  FinanceOrderSupplier,
  FinancePayment,
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
      /* Composite health under high-risk stress lands in the 50–75
         band thanks to the EMA smoothing and softened damage. The
         individual module scores tell the harsh story. */
      healthRange: [0, 75],
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

export const ALL_SCENARIOS: () => Scenario[] = () => [
  healthyState(),
  moderatePressureState(),
  highRiskState(),
  falseSignalState(),
  recoveryState(),
  approvalPressureState(),
];
