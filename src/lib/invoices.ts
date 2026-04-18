"use client";

/* ---------------------------------------------------------------------------
   invoices — client-side fetchers + shared types for the Invoices app.
   Every call is cookie-authenticated via /api/invoices/*.
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

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string | null;
  qty: number;
  unit_price: number;
  tax_rate: number;
  line_discount_percent: number;
  line_total: number;
  sort_order: number;
}

export interface InvoicePayment {
  id: string;
  tenant_id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  method: string | null;
  reference: string | null;
  received_at: string;
  notes: string | null;
  recorded_by_account_id: string | null;
  created_at: string;
  updated_at: string;
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

export async function fetchInvoice(id: string): Promise<{ invoice: InvoiceRow; items: InvoiceItem[]; payments: InvoicePayment[] } | null> {
  const res = await fetch(`/api/invoices/${id}`, { credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()) as { invoice: InvoiceRow; items: InvoiceItem[]; payments: InvoicePayment[] };
}

export async function createInvoice(body: {
  customer_id?: string | null;
  currency?: string;
  issue_date?: string;
  due_date?: string | null;
  tax_rate?: number;
  discount_percent?: number;
  notes?: string | null;
  terms?: string | null;
  payment_terms?: string | null;
  linked_quotation_id?: string | null;
  linked_project_id?: string | null;
  lines?: Partial<InvoiceItem>[];
}): Promise<InvoiceRow | null> {
  const res = await fetch("/api/invoices", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const { invoice } = (await res.json()) as { invoice: InvoiceRow };
  return invoice;
}

export async function updateInvoice(
  id: string,
  patch: Partial<InvoiceRow>,
): Promise<InvoiceRow | null> {
  const res = await fetch(`/api/invoices/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const { invoice } = (await res.json()) as { invoice: InvoiceRow };
  return invoice;
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const res = await fetch(`/api/invoices/${id}`, { method: "DELETE", credentials: "include" });
  return res.ok;
}

export async function sendInvoice(id: string): Promise<InvoiceRow | null> {
  const res = await fetch(`/api/invoices/${id}/send`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const { invoice } = (await res.json()) as { invoice: InvoiceRow };
  return invoice;
}

export async function saveInvoiceLines(
  id: string,
  body: { lines: Partial<InvoiceItem>[]; tax_rate?: number; discount_percent?: number },
): Promise<{ invoice: InvoiceRow; items: InvoiceItem[] } | null> {
  const res = await fetch(`/api/invoices/${id}/lines`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return (await res.json()) as { invoice: InvoiceRow; items: InvoiceItem[] };
}

export async function recordPayment(
  id: string,
  body: { amount: number; method?: string | null; reference?: string | null; received_at?: string; notes?: string | null; currency?: string },
): Promise<InvoicePayment | null> {
  const res = await fetch(`/api/invoices/${id}/payments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const { payment } = (await res.json()) as { payment: InvoicePayment };
  return payment;
}

export async function invoiceFromQuotation(quotationId: string, dueDate?: string): Promise<InvoiceRow | null> {
  const res = await fetch("/api/invoices/from-quotation", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quotation_id: quotationId, due_date: dueDate }),
  });
  if (!res.ok) return null;
  const { invoice } = (await res.json()) as { invoice: InvoiceRow };
  return invoice;
}
