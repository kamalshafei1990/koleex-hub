/* ---------------------------------------------------------------------------
   Reports — numbers from the apps (Phase 4B, owner's pick 25 Sep 2026):
   what each numbers block shows, pure — the composer, the reader, the print
   and the server read the same columns.

   A block lists the AUTHOR's own documents (owner's pick: "the report's
   writer only"): quotations, orders and invoices in the report's period,
   the quotations sent and still unanswered, the invoices with money still
   owed. The server computes the rows (src/lib/server/reports/report-data.ts)
   — fresh every time a draft opens, frozen into the report when it is sent —
   so a reader sees exactly what the author saw, and no figure is typed.

   Words: a column is `blk.dc.<id>`, a document status `blk.st.<status>`.
   --------------------------------------------------------------------------- */

import type { ReportDataSource, ReportDataValue, ReportLinkType, ReportSectionValue } from "./templates";

export type DataColumnType = "text" | "money" | "number" | "date" | "status";
export interface DataColumn { id: string; type: DataColumnType }

const NO: DataColumn = { id: "no", type: "text" };
const CUSTOMER: DataColumn = { id: "customer", type: "text" };

export const DATA_COLUMNS: Record<ReportDataSource, DataColumn[]> = {
  quotations: [NO, CUSTOMER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  orders: [NO, CUSTOMER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "status", type: "status" }],
  invoices: [NO, CUSTOMER, { id: "date", type: "date" }, { id: "amount", type: "money" }, { id: "paid", type: "money" }, { id: "balance", type: "money" }],
  quotes_waiting: [NO, CUSTOMER, { id: "sent", type: "date" }, { id: "days", type: "number" }, { id: "amount", type: "money" }, { id: "valid", type: "date" }],
  receivables: [NO, CUSTOMER, { id: "due", type: "date" }, { id: "overdue", type: "number" }, { id: "balance", type: "money" }],
};

/** The app a source belongs to — the author must hold it (requireModuleAccess). */
export const DATA_MODULE: Record<ReportDataSource, string> = {
  quotations: "Quotations", quotes_waiting: "Quotations", orders: "Orders", invoices: "Invoices", receivables: "Invoices",
};

/** What a row opens: the document in its own app. */
export const DATA_LINK: Record<ReportDataSource, ReportLinkType> = {
  quotations: "quotation", quotes_waiting: "quotation", orders: "order", invoices: "invoice", receivables: "invoice",
};

/** The document statuses that have words (anything else shows as written). */
export const DATA_STATUSES = ["draft", "sent", "accepted", "rejected", "expired", "open", "confirmed", "in_production", "shipped", "delivered", "completed", "closed", "cancelled", "paid", "partial", "overdue"] as const;

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
