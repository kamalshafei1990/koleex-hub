/* ---------------------------------------------------------------------------
   Finance App — pure calculation helpers
   ===========================================================================

   PROFIT MODEL  (Phase 1 — corrected after Kamal's 2026-05-16 review)
   ──────────────────────────────────────────────────────────────────
   The chain is the standard international-trade P&L sequence:

     1. supplier_total_cost  = Σ supplier_cost across all order_suppliers
     2. GROSS PROFIT         = selling_price − supplier_total_cost
                                ⚠ Tax refund is NOT part of gross profit.
     3. order_expenses       = Σ amount of expenses linked to the order
     4. tax_refund_value     = % * selling_price OR a typed-in absolute,
                               appears separately AFTER expenses
     5. financial_charges    = bank / L-C / FX / wire charges on the
                               order. Phase 1 treats as 0 if not entered.
     6. NET PROFIT           = gross_profit − order_expenses
                                              + tax_refund_value
                                              − financial_charges
     7. net_profit_pct       = net_profit / selling_price × 100

   CASH MODEL (separate from profit)
   ──────────────────────────────────
   "Net profit" is the booked / expected number — it doesn't say what's
   actually in the bank yet. For that we report a CASH POSITION
   built from the actual money that has moved:

     collected_amount        = Σ in-payments completed for this order
     paid_supplier_amount    = Σ paid_amount on order_supplier rows
     paid_expenses           = Σ expense.amount where status='paid'
                               on expenses linked to the order
     realized_cash_position  = collected_amount
                               − paid_supplier_amount
                               − paid_expenses
                               (tax refund cash counted only if received —
                                Phase 1 keeps this conservative and
                                excludes it unless explicitly entered)

   Two derived metrics for the UI:
     outstanding_receivable  = max(0, selling_price − collected_amount)
     outstanding_payable     = max(0, supplier_total_cost − paid_supplier_amount)
                               + Σ unpaid order-linked expense amounts

   Why we removed the old "realized_profit = net × collected_ratio"
   shortcut: it presumed supplier + expense payments would scale 1:1 with
   customer payments, which is almost never true on T/T-deposit deals.
   Reporting raw cash is honest and unambiguous.
   --------------------------------------------------------------------------- */

import type {
  FinanceOrder,
  FinanceOrderSupplier,
  FinanceExpense,
  FinancePayment,
} from "./types";

export interface ProfitInputs {
  selling_price: number;
  tax_refund_value: number;
  financial_charges: number;
  suppliers: Pick<FinanceOrderSupplier, "supplier_cost" | "paid_amount">[];
  linked_expenses: Pick<FinanceExpense, "amount" | "payment_status">[];
  customer_payments_total: number;
}

export interface ProfitOutputs {
  /* The accounting picture */
  total_supplier_cost: number;
  total_order_expenses: number;
  tax_refund_value: number;
  financial_charges: number;
  gross_profit: number;
  net_profit: number;
  net_profit_pct: number;
  /* The cash picture */
  collected_amount: number;
  paid_supplier_amount: number;
  paid_expenses: number;
  realized_cash_position: number;
  outstanding_receivable: number;
  outstanding_payable: number;
  /* Convenience */
  customer_paid_share: number;
}

export function computeOrderProfit(inputs: ProfitInputs): ProfitOutputs {
  /* ── Profit chain (booked / expected) ────────────────────────── */
  const total_supplier_cost = inputs.suppliers.reduce(
    (s, x) => s + (Number(x.supplier_cost) || 0),
    0,
  );
  const total_order_expenses = inputs.linked_expenses.reduce(
    (s, x) => s + (Number(x.amount) || 0),
    0,
  );
  const sellingPrice = Number(inputs.selling_price) || 0;
  const taxRefund = Number(inputs.tax_refund_value) || 0;
  const finCharges = Number(inputs.financial_charges) || 0;

  /* GROSS PROFIT — tax refund is NOT included here. */
  const gross_profit = sellingPrice - total_supplier_cost;

  /* NET PROFIT — expenses subtracted, refund added back, finance
     charges (bank / L-C fees) subtracted. */
  const net_profit =
    gross_profit - total_order_expenses + taxRefund - finCharges;
  const net_profit_pct = sellingPrice > 0
    ? (net_profit / sellingPrice) * 100
    : 0;

  /* ── Cash chain (realized) ──────────────────────────────────── */
  const paid_supplier_amount = inputs.suppliers.reduce(
    (s, x) => s + (Number(x.paid_amount) || 0),
    0,
  );
  const paid_expenses = inputs.linked_expenses
    .filter((e) => e.payment_status === "paid")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const unpaid_expenses = inputs.linked_expenses
    .filter((e) => e.payment_status !== "paid")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const collected_amount = Math.max(0, Number(inputs.customer_payments_total) || 0);
  const realized_cash_position =
    collected_amount - paid_supplier_amount - paid_expenses;

  const outstanding_receivable = Math.max(0, sellingPrice - collected_amount);
  const outstanding_payable =
    Math.max(0, total_supplier_cost - paid_supplier_amount) + unpaid_expenses;

  const customer_paid_share = sellingPrice > 0
    ? Math.max(0, Math.min(1, collected_amount / sellingPrice))
    : 0;

  return {
    total_supplier_cost: round2(total_supplier_cost),
    total_order_expenses: round2(total_order_expenses),
    tax_refund_value: round2(taxRefund),
    financial_charges: round2(finCharges),
    gross_profit: round2(gross_profit),
    net_profit: round2(net_profit),
    net_profit_pct: round2(net_profit_pct),
    collected_amount: round2(collected_amount),
    paid_supplier_amount: round2(paid_supplier_amount),
    paid_expenses: round2(paid_expenses),
    realized_cash_position: round2(realized_cash_position),
    outstanding_receivable: round2(outstanding_receivable),
    outstanding_payable: round2(outstanding_payable),
    customer_paid_share: round4(customer_paid_share),
  };
}

/* Tax refund value can be either typed manually OR derived from a % */
export function deriveTaxRefundValue(
  sellingPrice: number,
  taxRefundPct: number,
  manualValue: number | null | undefined,
): number {
  if (manualValue && manualValue > 0) return Number(manualValue);
  if (!sellingPrice || !taxRefundPct) return 0;
  return round2((Number(sellingPrice) * Number(taxRefundPct)) / 100);
}

/* ── Customer / Supplier account totals ─────────────────────────── */

export interface CustomerTotalsInputs {
  orders: Pick<FinanceOrder, "selling_price" | "payment_status" | "payment_due_date">[];
  payments: Pick<FinancePayment, "amount" | "direction" | "status">[];
}
export interface CustomerTotals {
  total_revenue: number;
  paid_amount: number;
  unpaid_amount: number;
  overdue_amount: number;
  outstanding_balance: number;
}

export function computeCustomerTotals(inputs: CustomerTotalsInputs): CustomerTotals {
  const total_revenue = inputs.orders.reduce(
    (s, o) => s + (Number(o.selling_price) || 0),
    0,
  );
  const paid_amount = inputs.payments
    .filter((p) => p.direction === "in" && p.status === "completed")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const unpaid_amount = Math.max(0, total_revenue - paid_amount);
  const today = new Date().toISOString().slice(0, 10);
  const overdue_amount = inputs.orders
    .filter(
      (o) =>
        o.payment_status !== "paid" &&
        o.payment_due_date &&
        o.payment_due_date < today,
    )
    .reduce((s, o) => s + (Number(o.selling_price) || 0), 0);
  return {
    total_revenue: round2(total_revenue),
    paid_amount: round2(paid_amount),
    unpaid_amount: round2(unpaid_amount),
    overdue_amount: round2(overdue_amount),
    outstanding_balance: round2(unpaid_amount),
  };
}

export interface SupplierTotalsInputs {
  order_supplier_costs: Pick<FinanceOrderSupplier, "supplier_cost" | "paid_amount" | "due_date" | "payment_status">[];
  /* Standalone bills (linked to supplier but not to an order line) */
  expenses: Pick<FinanceExpense, "amount" | "payment_status" | "due_date">[];
  payments: Pick<FinancePayment, "amount" | "direction" | "status">[];
}
export interface SupplierTotals {
  total_purchases: number;
  paid_amount: number;
  unpaid_amount: number;
  outstanding_payable: number;
}

export function computeSupplierTotals(inputs: SupplierTotalsInputs): SupplierTotals {
  const order_purchases = inputs.order_supplier_costs.reduce(
    (s, x) => s + (Number(x.supplier_cost) || 0),
    0,
  );
  const order_paid = inputs.order_supplier_costs.reduce(
    (s, x) => s + (Number(x.paid_amount) || 0),
    0,
  );
  const expense_purchases = inputs.expenses.reduce(
    (s, x) => s + (Number(x.amount) || 0),
    0,
  );
  const expense_paid = inputs.expenses
    .filter((x) => x.payment_status === "paid")
    .reduce((s, x) => s + (Number(x.amount) || 0), 0);

  const total_purchases = order_purchases + expense_purchases;
  const paid_amount = order_paid + expense_paid;
  const unpaid_amount = Math.max(0, total_purchases - paid_amount);
  return {
    total_purchases: round2(total_purchases),
    paid_amount: round2(paid_amount),
    unpaid_amount: round2(unpaid_amount),
    outstanding_payable: round2(unpaid_amount),
  };
}

/* ── Numeric helpers ────────────────────────────────────────────── */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/* ── Money formatter ────────────────────────────────────────────── */
export function fmtMoney(
  n: number,
  currency: string = "USD",
  opts?: { compact?: boolean },
): string {
  if (!Number.isFinite(n)) n = 0;
  if (opts?.compact && Math.abs(n) >= 10000) {
    const abs = Math.abs(n);
    let v: string;
    if (abs >= 1_000_000) v = (n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
    else if (abs >= 1_000) v = (n / 1_000).toFixed(abs >= 10_000 ? 1 : 2) + "K";
    else v = n.toFixed(2);
    return `${v} ${currency}`;
  }
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: Math.abs(n) < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

export function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}
