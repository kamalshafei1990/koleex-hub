/* ---------------------------------------------------------------------------
   Finance App — shared TypeScript types

   These mirror the finance_* Postgres tables created by the
   `finance_app_phase1_foundation` migration. The shape is deliberately
   slim — pick fields, don't expose internal columns the API doesn't
   surface (e.g. tenant_id is never sent to the client; the API
   enforces tenant scoping server-side).
   --------------------------------------------------------------------------- */

export type Currency = "USD" | "EUR" | "CNY" | "EGP" | "GBP";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

export type OrderStatus =
  | "open"
  | "in_production"
  | "shipped"
  | "delivered"
  | "closed"
  | "cancelled";

export type CreditStatus = "good" | "watch" | "hold" | "blocked";

export type PaymentDirection = "in" | "out";
export type PartyType = "customer" | "supplier" | "other";

export type NotificationType = "collect" | "pay";
export type NotificationStatus = "scheduled" | "sent" | "snoozed" | "done" | "cancelled";

/* ── Expense Categories ─────────────────────────────────────────── */
export interface ExpenseCategory {
  id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  is_system: boolean;
  sort_order: number;
}

/* ── Orders ─────────────────────────────────────────────────────── */
export interface FinanceOrderSupplier {
  id: string;
  order_id: string;
  supplier_id: string | null;
  supplier_name: string;
  supplier_cost: number;
  currency: Currency | string;
  payment_status: PaymentStatus;
  paid_amount: number;
  due_date: string | null;
  notes: string | null;
}

export interface FinanceOrder {
  id: string;
  order_no: string;
  customer_id: string | null;
  customer_name: string;
  order_date: string;
  currency: Currency | string;
  selling_price: number;
  tax_refund_pct: number;
  tax_refund_value: number;
  /* Bank fees / L-C charges / FX / wire costs on this order. Phase 1
     reads it as 0 if the operator hasn't entered a value yet. */
  financial_charges: number;
  expected_profit: number | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_due_date: string | null;
  linked_quotation_id: string | null;
  linked_invoice_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: FinanceOrderSupplier[];
  /* ── Derived: accounting picture (computed server-side) ──────── */
  total_supplier_cost?: number;       // Σ supplier costs
  total_order_expenses?: number;      // Σ linked expense amounts
  gross_profit?: number;              // selling_price − supplier_cost
  net_profit?: number;                // gross − expenses + tax_refund − fin_charges
  net_profit_pct?: number;            // net_profit / selling_price × 100
  /* ── Derived: cash picture ──────────────────────────────────── */
  collected_amount?: number;          // Σ in-payments completed
  paid_supplier_amount?: number;      // Σ paid_amount on supplier lines
  paid_expenses?: number;             // Σ paid expense amounts
  realized_cash_position?: number;    // collected − paid_supplier − paid_expenses
  outstanding_receivable?: number;    // max(0, selling_price − collected)
  outstanding_payable?: number;       // unpaid supplier + unpaid linked expenses
}

/* ── Expenses ───────────────────────────────────────────────────── */
export interface FinanceExpense {
  id: string;
  category_id: string | null;
  subcategory_id: string | null;
  category_name?: string;
  title: string;
  amount: number;
  currency: Currency | string;
  expense_date: string;
  payment_status: PaymentStatus;
  due_date: string | null;
  linked_order_id: string | null;
  linked_supplier_id: string | null;
  linked_customer_id: string | null;
  linked_project_id: string | null;
  attachment_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Payments ───────────────────────────────────────────────────── */
export interface FinancePayment {
  id: string;
  direction: PaymentDirection;
  party_type: PartyType;
  party_id: string | null;
  party_name: string;
  amount: number;
  currency: Currency | string;
  payment_date: string;
  payment_method: string | null;
  reference_no: string | null;
  status: "pending" | "completed" | "cancelled" | "bounced";
  linked_order_id: string | null;
  linked_order_supplier_id: string | null;
  linked_expense_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Customer / Supplier accounts ──────────────────────────────── */
export interface FinanceCustomerAccount {
  id: string;
  customer_id: string;
  customer_name: string;
  payment_terms: string | null;
  credit_limit: number | null;
  credit_status: CreditStatus;
  default_currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /* Computed at API time */
  total_revenue?: number;
  paid_amount?: number;
  unpaid_amount?: number;
  overdue_amount?: number;
  outstanding_balance?: number;
  next_due_date?: string | null;
}

export interface FinanceSupplierAccount {
  id: string;
  supplier_id: string;
  supplier_name: string;
  payment_terms: string | null;
  default_currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /* Computed at API time */
  total_purchases?: number;
  paid_amount?: number;
  unpaid_amount?: number;
  outstanding_payable?: number;
  next_due_date?: string | null;
}

/* ── Notifications ──────────────────────────────────────────────── */
export interface FinanceNotification {
  id: string;
  type: NotificationType;
  reference_type: "order" | "order_supplier" | "expense" | "payment";
  reference_id: string;
  party_name: string;
  amount: number;
  currency: Currency | string;
  due_date: string;
  reminder_offset_days: number;
  remind_at: string;
  status: NotificationStatus;
  sent_at: string | null;
  notes: string | null;
  created_at: string;
}

/* ── Dashboard payload ──────────────────────────────────────────── */
export interface DashboardKpi {
  total_revenue: number;
  total_supplier_cost: number;
  total_expenses: number;
  total_tax_refund: number;
  total_financial_charges: number;
  gross_profit: number;
  net_profit: number;
  cash_in: number;
  cash_out: number;
  accounts_receivable: number;
  accounts_payable: number;
  /* Period-over-period delta percentages (current vs previous window) */
  delta: {
    revenue_pct: number | null;
    expenses_pct: number | null;
    gross_profit_pct: number | null;
    net_profit_pct: number | null;
    cash_in_pct: number | null;
    cash_out_pct: number | null;
  };
  /* Absolute deltas matching the percentages above */
  delta_value: {
    revenue: number;
    expenses: number;
    gross_profit: number;
    net_profit: number;
    cash_in: number;
    cash_out: number;
  };
  /* Trend buckets — points along the chosen period for a sparkline */
  trend: {
    label: string;
    revenue: number;
    expenses: number;
    net_profit: number;
  }[];
  /* Phase 1.1 — executive widgets */
  top_orders: {
    id: string;
    order_no: string;
    customer_name: string;
    selling_price: number;
    net_profit: number;
    net_profit_pct: number;
    currency: string;
  }[];
  top_expense_categories: {
    name: string;
    total: number;
    share_pct: number;
    count: number;
  }[];
  expected_vs_realized: {
    expected_net_profit: number;
    realized_cash_position: number;
    collected: number;
    paid_supplier: number;
    paid_expenses: number;
  };
}

export type DashboardPeriod = "week" | "quarter" | "year";
