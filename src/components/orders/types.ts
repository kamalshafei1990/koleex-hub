/* Shared shapes for the Orders app — one definition, used by the list, the
   detail screen and the API's return type. */

export type OrderStatus = "open" | "shipped" | "closed" | "cancelled";

export interface OrderRow {
  id: string;
  deal_no: number;
  order_no: string;
  customer_id: string | null;
  customer_code: string | null;
  customer_name: string | null;
  company_name: string | null;
  status: OrderStatus;
  currency: string | null;
  total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** What a list row needs about a document: a number, a state, a value. Never
    the `doc` payload — that blob runs to megabytes with embedded images. */
export interface OrderDocSummary {
  id: string;
  number: string | null;
  status: string | null;
  total: number | null;
  currency: string | null;
  date: string | null;
}

export interface OrderDocuments {
  quotations: OrderDocSummary[];
  invoices: OrderDocSummary[];
  contracts: OrderDocSummary[];
  packingLists: OrderDocSummary[];
}

export interface OrderCustomer {
  id: string;
  name: string | null;
  company_name: string | null;
  customer_code: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
}

/** Day/Month/Year — the house rule. */
export function dmy(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function orderMoney(v: number | null | undefined, currency?: string | null): string {
  if (v == null) return "—";
  return `${currency ?? ""} ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`.trim();
}

/** The buyer as this order recorded them, falling back through the snapshot
    fields in the order a person would read them. */
export function orderParty(o: Pick<OrderRow, "company_name" | "customer_name" | "customer_code">): string {
  return o.company_name || o.customer_name || o.customer_code || "—";
}
