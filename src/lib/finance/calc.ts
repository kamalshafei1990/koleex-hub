/* ---------------------------------------------------------------------------
   Finance App — pure calculation helpers

   All profit / margin math lives here so the API, the dashboard, and the
   order-detail page compute identical numbers. No I/O — these are
   stateless functions over typed inputs.

   PROFIT MODEL
   ─────────────
       gross_profit   = selling_price + tax_refund_value
                      − Σ supplier_cost (across all suppliers on the order)
       net_profit     = gross_profit − Σ linked_order_expenses
       net_profit_pct = net_profit / selling_price × 100      (if selling_price > 0)
       realized_profit
         = net_profit pro-rated by the share of the selling price that has
           actually been collected from the customer:
             customer_paid_share = total_customer_paid / selling_price (clamped 0..1)
             realized_profit     = net_profit × customer_paid_share

   The realized-profit concept is what differentiates "expected" (the
   number you booked when the order was sold) from "what we've actually
   banked so far" (revenue actually received minus costs actually paid).
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
  suppliers: Pick<FinanceOrderSupplier, "supplier_cost" | "paid_amount">[];
  linked_expenses: Pick<FinanceExpense, "amount" | "payment_status">[];
  customer_payments_total: number;
}

export interface ProfitOutputs {
  total_supplier_cost: number;
  total_order_expenses: number;
  gross_profit: number;
  net_profit: number;
  net_profit_pct: number;
  realized_profit: number;
  total_paid_to_suppliers: number;
  customer_paid_share: number;
}

export function computeOrderProfit(inputs: ProfitInputs): ProfitOutputs {
  const total_supplier_cost = inputs.suppliers.reduce(
    (s, x) => s + (Number(x.supplier_cost) || 0),
    0,
  );
  const total_paid_to_suppliers = inputs.suppliers.reduce(
    (s, x) => s + (Number(x.paid_amount) || 0),
    0,
  );
  const total_order_expenses = inputs.linked_expenses.reduce(
    (s, x) => s + (Number(x.amount) || 0),
    0,
  );

  const sellingPrice = Number(inputs.selling_price) || 0;
  const taxRefund = Number(inputs.tax_refund_value) || 0;

  const gross_profit =
    sellingPrice + taxRefund - total_supplier_cost;
  const net_profit = gross_profit - total_order_expenses;
  const net_profit_pct =
    sellingPrice > 0 ? (net_profit / sellingPrice) * 100 : 0;

  /* Realized profit = how much of the net profit we've actually banked,
     scaled by the customer's payment progress. A 70%-collected order has
     realized 70% of its booked net profit even if the rest of the order
     is still open. Clamp to [0,1] so an over-payment doesn't inflate
     realized profit past net_profit. */
  const customer_paid_share =
    sellingPrice > 0
      ? Math.max(0, Math.min(1, inputs.customer_payments_total / sellingPrice))
      : 0;
  const realized_profit = net_profit * customer_paid_share;

  return {
    total_supplier_cost: round2(total_supplier_cost),
    total_order_expenses: round2(total_order_expenses),
    gross_profit: round2(gross_profit),
    net_profit: round2(net_profit),
    net_profit_pct: round2(net_profit_pct),
    realized_profit: round2(realized_profit),
    total_paid_to_suppliers: round2(total_paid_to_suppliers),
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
