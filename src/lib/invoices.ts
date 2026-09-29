"use client";

/* ---------------------------------------------------------------------------
   invoices — the invoice list fetch + shared types, for the invoice strip
   on a contact (EntityInvoicesStrip). Cookie-authenticated via /api/invoices.
   The Invoices app itself is the document editor (components/invoices-doc).
   --------------------------------------------------------------------------- */

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "issued"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled"
  | "void";

export interface InvoiceRow {
  id: string;
  tenant_id: string;
  inv_no: string | null;
  customer_id: string | null;
  status: InvoiceStatus;
  currency: string;
  issue_date: string;
  due_date: string | null;
  payment_terms: string | null;
  tax_rate: number;
  discount_percent: number;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  amount_paid: number;
  balance: number;
  notes: string | null;
  terms: string | null;
  linked_quotation_id: string | null;
  linked_project_id: string | null;
  created_by_account_id: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  customer?: {
    id: string;
    display_name: string | null;
    company_name: string | null;
    emails?: unknown;
    phones?: unknown;
    addresses?: unknown;
  } | null;
}

export const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft:     "#94a3b8",
  sent:      "#60a5fa",
  issued:    "#60a5fa",
  partial:   "#fbbf24",
  paid:      "#34d399",
  overdue:   "#f87171",
  cancelled: "#475569",
  void:      "#475569",
};

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount ?? 0));
  } catch {
    return `${currency} ${Number(amount ?? 0).toFixed(2)}`;
  }
}

export function isOverdue(invoice: Pick<InvoiceRow, "due_date" | "status" | "balance">): boolean {
  if (!invoice.due_date) return false;
  if (["paid", "cancelled", "void"].includes(invoice.status)) return false;
  if (invoice.balance <= 0) return false;
  return new Date(invoice.due_date) < new Date(new Date().toDateString());
}

/* ── Invoices ─────────────────────────────────────── */

export async function fetchInvoices(params: {
  status?: InvoiceStatus | "all";
  customer_id?: string;
  search?: string;
  from?: string;
  to?: string;
} = {}): Promise<InvoiceRow[]> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.set(k, String(v));
  });
  const res = await fetch(`/api/invoices?${q.toString()}`, { credentials: "include" });
  if (!res.ok) return [];
  const { invoices } = (await res.json()) as { invoices: InvoiceRow[] };
  return invoices ?? [];
}
