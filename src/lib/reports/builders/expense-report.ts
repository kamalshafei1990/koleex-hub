import "server-only";

/* ===========================================================================
   Expense Report — INTERNAL.
   Expenses in a window, optionally filtered by category. Shows
   per-expense detail plus a category roll-up. Internal-only — exposes
   linked order ids, approval status, evidence flags, etc.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  ReportBuildContext,
  ReportColumn,
  ReportPayload,
  ReportRowValue,
  ReportSection,
} from "../types";
import { generateReportNo, loadTenant, normalisePeriod, sumNumeric } from "../shared";

interface ExpenseRow {
  id: string;
  title: string;
  amount: number | string;
  currency: string;
  expense_date: string;
  payment_status: string;
  approval_status: string | null;
  category_id: string | null;
  linked_order_id: string | null;
  linked_supplier_id: string | null;
  evidence_status: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
}

export async function buildExpenseReport(ctx: ReportBuildContext): Promise<ReportPayload> {
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);
  const tenant = await loadTenant(ctx.tenantId);
  const currency = ctx.filters.currency ?? tenant.currency;

  let q = supabaseServer
    .from("finance_expenses")
    .select("id, title, amount, currency, expense_date, payment_status, approval_status, category_id, linked_order_id, linked_supplier_id, evidence_status")
    .eq("tenant_id", ctx.tenantId)
    .gte("expense_date", period.from)
    .lte("expense_date", period.to)
    .order("expense_date", { ascending: false });
  if (ctx.filters.category_id) q = q.eq("category_id", ctx.filters.category_id);
  if (ctx.filters.currency) q = q.eq("currency", ctx.filters.currency);

  const [exRes, catRes] = await Promise.all([
    q,
    supabaseServer.from("finance_expense_categories").select("id, name").eq("tenant_id", ctx.tenantId),
  ]);

  const rows = (exRes.data ?? []) as ExpenseRow[];
  const cats = (catRes.data ?? []) as CategoryRow[];
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  const total = sumNumeric(rows, "amount");
  const paid = sumNumeric(rows.filter((r) => r.payment_status === "paid"), "amount");
  const unpaid = total - paid;
  const approved = rows.filter((r) => r.approval_status === "approved").length;

  /* Per-category roll-up. */
  const byCat = new Map<string, number>();
  for (const r of rows) {
    const k = r.category_id ?? "uncategorised";
    byCat.set(k, (byCat.get(k) ?? 0) + (Number(r.amount) || 0));
  }
  const catColumns: ReportColumn[] = [
    { key: "category", label: "Category" },
    { key: "total", label: "Total", align: "right", format: "money", width: "140px" },
    { key: "share", label: "Share", align: "right", format: "percent", width: "80px" },
  ];
  const catRows: Array<Record<string, ReportRowValue>> = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({
      category: k === "uncategorised" ? "Uncategorised" : (catName.get(k) ?? "Unknown"),
      total: v,
      share: total > 0 ? (v / total) * 100 : 0,
    }));

  const detailColumns: ReportColumn[] = [
    { key: "expense_date", label: "Date", format: "date", width: "92px" },
    { key: "title", label: "Title" },
    { key: "category", label: "Category", width: "140px" },
    { key: "amount", label: "Amount", align: "right", format: "money", width: "110px" },
    { key: "currency", label: "Ccy", width: "44px" },
    { key: "payment_status", label: "Paid?", width: "82px" },
    { key: "approval_status", label: "Approval", width: "100px" },
  ];
  const detailRows: Array<Record<string, ReportRowValue>> = rows.map((r) => ({
    expense_date: r.expense_date,
    title: r.title,
    category: r.category_id ? (catName.get(r.category_id) ?? "Unknown") : "Uncategorised",
    amount: Number(r.amount) || 0,
    currency: r.currency,
    payment_status: r.payment_status,
    approval_status: r.approval_status ?? "—",
  }));

  const sections: ReportSection[] = [
    { kind: "table", title: "By Category", columns: catColumns, rows: catRows, empty_state: "—" },
    { kind: "spacer" },
    { kind: "table", title: "Detail", columns: detailColumns, rows: detailRows, empty_state: "No expenses in window." },
  ];

  return {
    meta: {
      report_type: "expense_report",
      visibility: "internal",
      title: "Expense Report",
      generated_at: new Date().toISOString(),
      generated_by_name: ctx.generatedByName,
      period,
      currency,
      report_no: generateReportNo("KX-EXP"),
      tenant_name: tenant.name,
      locale: "en-US",
    },
    summary: [
      { label: "Total Expenses", value: total, format: "money", tone: "negative" },
      { label: "Paid", value: paid, format: "money", tone: "neutral" },
      { label: "Unpaid", value: unpaid, format: "money", tone: unpaid > 0 ? "warning" : "neutral" },
      { label: "Approved Count", value: approved, format: "count", tone: "positive" },
    ],
    sections,
    internal_warning: "INTERNAL — NOT FOR DISTRIBUTION",
    row_count: rows.length,
    total_amount: total,
  };
}
