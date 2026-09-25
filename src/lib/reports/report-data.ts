/* ---------------------------------------------------------------------------
   Reports — numbers from the apps (Phase 4B, owner's pick 25 Sep 2026):
   what each numbers block shows, pure — the composer, the reader, the print
   and the server read the same columns.

   A block lists the AUTHOR's own documents (owner's pick: "the report's
   writer only"): quotations, orders and invoices in the report's period,
   the quotations sent and still unanswered, the invoices with money still
   owed — and (4C) their purchase orders and receipts in the period, the
   items still short on a partly received order, the orders past their
   delivery date, the supplier bills still to pay — and (4D) their own
   expenses in a trip's days. The server computes the
   rows (src/lib/server/reports/report-data.ts) — fresh every time a draft
   opens, frozen into the report when it is sent — so a reader sees exactly
   what the author saw, and no figure is typed.

   Words: a column is `blk.dc.<id>`, a document status `blk.st.<status>`.
   --------------------------------------------------------------------------- */

import type { ReportDataSource, ReportDataValue, ReportSectionValue } from "./templates";
import { entityHref } from "./link-targets";

export type DataColumnType = "text" | "money" | "number" | "date" | "status";
export interface DataColumn { id: string; type: DataColumnType }

const NO: DataColumn = { id: "no", type: "text" };
const CUSTOMER: DataColumn = { id: "customer", type: "text" };
const SUPPLIER: DataColumn = { id: "supplier", type: "text" };

export const DATA_COLUMNS: Record<ReportDataSource, DataColumn[]> = {
  quotations: [NO, CUSTOMER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  orders: [NO, CUSTOMER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  invoices: [NO, CUSTOMER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "paid", type: "money" }, { id: "balance", type: "money" }],
  quotes_waiting: [NO, CUSTOMER, { id: "sent", type: "date" }, { id: "days", type: "number" }, { id: "amount", type: "money" }, { id: "valid", type: "date" }],
  receivables: [NO, CUSTOMER, { id: "due", type: "date" }, { id: "overdue", type: "number" }, { id: "balance", type: "money" }],
  purchase_orders: [NO, SUPPLIER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  receipts: [NO, SUPPLIER, { id: "date", type: "date" }, { id: "po", type: "text" }, { id: "status", type: "status" }],
  shortages: [NO, { id: "item", type: "text" }, { id: "ordered", type: "number" }, { id: "received", type: "number" }, { id: "missing", type: "number" }],
  pos_late: [NO, SUPPLIER, { id: "expected", type: "date" }, { id: "late", type: "number" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  payables: [NO, SUPPLIER, { id: "due", type: "date" }, { id: "overdue", type: "number" }, { id: "balance", type: "money" }],
  expenses: [{ id: "title", type: "text" }, { id: "category", type: "text" }, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
};

/** The app a source belongs to — the author must hold it (requireModuleAccess). */
export const DATA_MODULE: Record<ReportDataSource, string> = {
  quotations: "Quotations", quotes_waiting: "Quotations", orders: "Orders", invoices: "Invoices", receivables: "Invoices",
  purchase_orders: "Purchase", receipts: "Purchase", shortages: "Purchase", pos_late: "Purchase", payables: "Purchase",
  expenses: "Expenses",
};

/** What a row opens: the document in its own app — a quotation or an
 *  invoice in its editor, an order on its page; the Purchase app opens no
 *  single document by link, so a purchasing row opens its list. */
export function dataRowHref(source: ReportDataSource, key: string): string | null {
  switch (source) {
    case "quotations": case "quotes_waiting": return entityHref("quotation", key);
    case "invoices": case "receivables": return entityHref("invoice", key);
    case "orders": return entityHref("order", key);
    case "purchase_orders": case "shortages": case "pos_late": return "/purchase/orders";
    case "receipts": return "/purchase/receipts";
    case "payables": return "/purchase/bills";
    case "expenses": return "/finance/expenses";
    default: return null;
  }
}

/** The document statuses that have words (anything else shows as written). */
export const DATA_STATUSES = [
  "draft", "sent", "accepted", "rejected", "expired", "open", "confirmed", "in_production", "shipped", "delivered", "completed", "closed", "cancelled", "paid", "partial", "overdue",
  "pending", "approved", "received", "posted", "void", "issued", "final", "complete", "voided",
  "submitted", "changes_requested",
] as const;

/** A status's word: "partial" is partly RECEIVED on a purchase order or a
 *  receipt, partly PAID on an invoice or a bill. Null: show it as written. */
export function statusWordKey(source: ReportDataSource, status: string): string | null {
  if (status === "partial" && (source === "purchase_orders" || source === "receipts" || source === "pos_late")) return "blk.st.partial_received";
  return (DATA_STATUSES as readonly string[]).includes(status) ? `blk.st.${status}` : null;
}

export interface DataTotal { col: string; currency: string; value: number }

/** Each money column's total PER CURRENCY: a USD quotation and a CNY one
 *  are never added together. Only when two or more rows carry money. */
export function dataTotals(v: ReportDataValue | undefined): DataTotal[] {
  if (!v || v.rows.length < 2) return [];
  const out: DataTotal[] = [];
  for (const col of DATA_COLUMNS[v.source].filter((c) => c.type === "money")) {
    const byCur = new Map<string, number>();
    for (const r of v.rows) {
      const n = r.cells[col.id];
      if (typeof n !== "number" || !Number.isFinite(n)) continue;
      const cur = r.currency || "—";
      byCur.set(cur, (byCur.get(cur) ?? 0) + n);
    }
    for (const [currency, value] of byCur) out.push({ col: col.id, currency, value: Math.round(value * 100) / 100 });
  }
  return out;
}

/** A draft's sections with the numbers the server just computed (the
 *  composer shows them, the print prints them); on a sent report the
 *  frozen numbers are already in its sections. */
export function withBlockData(sections: ReportSectionValue[], data: Record<string, ReportDataValue> | undefined): ReportSectionValue[] {
  if (!data) return sections;
  return sections.map((s) => (data[s.id] ? { ...s, data: data[s.id] } : s));
}
