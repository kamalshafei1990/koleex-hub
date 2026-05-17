import "server-only";

/* ===========================================================================
   Expense Report — INTERNAL · controller-ready.

   Phase R.2 expansion. Layout:
     · headline summary: total, paid, unpaid, approved-count, missing-evidence-count
     · expense by category (USD-equivalent share)
     · expense by vendor (supplier name when linked)
     · expense detail table — every expense in the window with payment
                              status, approval status, evidence status,
                              linked order
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

interface CategoryRow { id: string; name: string }
interface SupplierLite { id: string; name: string; company_name: string | null }
interface OrderLite    { id: string; order_no: string }

export async function buildExpenseReport(ctx: ReportBuildContext): Promise<ReportPayload> {
  const period = normalisePeriod(ctx.filters.date_from, ctx.filters.date_to);
  const tenant = await loadTenant(ctx.tenantId);
  const currency = ctx.filters.currency ?? tenant.currency;

  let q = supabaseServer
    .from("finance_expenses")
    .select(
      "id, title, amount, currency, expense_date, payment_status, approval_status, category_id, " +
      "linked_order_id, linked_supplier_id, evidence_status",
    )
    .eq("tenant_id", ctx.tenantId)
    .gte("expense_date", period.from)
    .lte("expense_date", period.to)
    .order("expense_date", { ascending: false });
  if (ctx.filters.category_id) q = q.eq("category_id", ctx.filters.category_id);
  if (ctx.filters.currency)    q = q.eq("currency", ctx.filters.currency);

  const exRes = await q;
  const rows = (exRes.data ?? []) as unknown as ExpenseRow[];

  /* Batched lookups for category + supplier + order names. */
  const categoryIds = Array.from(new Set(rows.map((r) => r.category_id).filter((x): x is string => !!x)));
  const supplierIds = Array.from(new Set(rows.map((r) => r.linked_supplier_id).filter((x): x is string => !!x)));
  const orderIds    = Array.from(new Set(rows.map((r) => r.linked_order_id).filter((x): x is string => !!x)));

  const [catRes, supRes, ordRes] = await Promise.all([
    categoryIds.length > 0
      ? supabaseServer.from("finance_expense_categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as CategoryRow[] }),
    supplierIds.length > 0
      ? supabaseServer.from("suppliers").select("id, name, company_name").eq("tenant_id", ctx.tenantId).in("id", supplierIds)
      : Promise.resolve({ data: [] as SupplierLite[] }),
    orderIds.length > 0
      ? supabaseServer.from("finance_orders").select("id, order_no").eq("tenant_id", ctx.tenantId).in("id", orderIds)
      : Promise.resolve({ data: [] as OrderLite[] }),
  ]);
  const catName = new Map(((catRes.data ?? []) as CategoryRow[]).map((c) => [c.id, c.name]));
  const supName = new Map(((supRes.data ?? []) as SupplierLite[]).map((s) => [s.id, s.company_name || s.name]));
  const ordNo   = new Map(((ordRes.data ?? []) as OrderLite[]).map((o) => [o.id, o.order_no]));

  /* ── Aggregates ────────────────────────────────────────────────── */
  const total       = sumNumeric(rows, "amount");
  const paidRows    = rows.filter((r) => r.payment_status === "paid");
  const paid        = sumNumeric(paidRows, "amount");
  const unpaid      = total - paid;
  const approvedCount     = rows.filter((r) => r.approval_status === "approved").length;
  const pendingApproval   = rows.filter((r) => r.approval_status === "submitted" || r.approval_status === "under_review").length;
  const missingEvidence   = rows.filter((r) => r.evidence_status === "missing" || !r.evidence_status).length;

  /* ── By Category ──────────────────────────────────────────────── */
  const byCat = new Map<string, { name: string; total: number; count: number }>();
  for (const r of rows) {
    const key = r.category_id ?? "uncategorised";
    const name = r.category_id ? (catName.get(r.category_id) ?? "Unknown") : "Uncategorised";
    const cur = byCat.get(key) ?? { name, total: 0, count: 0 };
    cur.total += Number(r.amount) || 0;
    cur.count += 1;
    byCat.set(key, cur);
  }
  const catColumns: ReportColumn[] = [
    { key: "category", label: "Category" },
    { key: "count",    label: "Items",    align: "right", format: "count",  width: "80px" },
    { key: "total",    label: "Total",    align: "right", format: "money",  width: "140px" },
    { key: "share",    label: "Share",    align: "right", format: "percent", width: "80px" },
  ];
  const catRows: Array<Record<string, ReportRowValue>> = Array.from(byCat.values())
    .sort((a, b) => b.total - a.total)
    .map((v) => ({
      category: v.name,
      count:    v.count,
      total:    v.total,
      share:    total > 0 ? (v.total / total) * 100 : 0,
    }));

  /* ── By Vendor / Supplier ─────────────────────────────────────── */
  const byVendor = new Map<string, { name: string; total: number; count: number }>();
  for (const r of rows) {
    if (!r.linked_supplier_id) continue;
    const name = supName.get(r.linked_supplier_id) ?? "Unknown supplier";
    const cur = byVendor.get(r.linked_supplier_id) ?? { name, total: 0, count: 0 };
    cur.total += Number(r.amount) || 0;
    cur.count += 1;
    byVendor.set(r.linked_supplier_id, cur);
  }
  const vendorRows: Array<Record<string, ReportRowValue>> = Array.from(byVendor.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)
    .map((v) => ({ vendor: v.name, count: v.count, total: v.total }));
  const vendorColumns: ReportColumn[] = [
    { key: "vendor", label: "Supplier / Vendor" },
    { key: "count",  label: "Items",  align: "right", format: "count", width: "80px" },
    { key: "total",  label: "Total",  align: "right", format: "money", width: "140px" },
  ];

  /* ── Detail table ─────────────────────────────────────────────── */
  const detailColumns: ReportColumn[] = [
    { key: "expense_date",    label: "Date",     format: "date", width: "92px" },
    { key: "title",           label: "Title" },
    { key: "category",        label: "Category", width: "130px" },
    { key: "vendor",          label: "Vendor",   width: "120px" },
    { key: "linked_order",    label: "Order",    width: "100px" },
    { key: "amount",          label: "Amount",   align: "right", format: "money", width: "100px" },
    { key: "currency",        label: "Ccy",      width: "44px" },
    { key: "payment_status",  label: "Paid?",    width: "76px" },
    { key: "approval_status", label: "Approval", width: "94px" },
    { key: "evidence_status", label: "Evidence", width: "78px" },
  ];
  const detailRows: Array<Record<string, ReportRowValue>> = rows.map((r) => ({
    expense_date:    r.expense_date,
    title:           r.title,
    category:        r.category_id ? (catName.get(r.category_id) ?? "Unknown") : "Uncategorised",
    vendor:          r.linked_supplier_id ? (supName.get(r.linked_supplier_id) ?? "—") : "—",
    linked_order:    r.linked_order_id ? (ordNo.get(r.linked_order_id) ?? "—") : "—",
    amount:          Number(r.amount) || 0,
    currency:        r.currency,
    payment_status:  r.payment_status,
    approval_status: r.approval_status ?? "—",
    evidence_status: r.evidence_status ?? "missing",
  }));

  const sections: ReportSection[] = [
    { kind: "table", title: "By Category",          columns: catColumns,   rows: catRows,    empty_state: "—" },
    ...(vendorRows.length > 0
      ? [{ kind: "table" as const, title: "By Vendor / Supplier", columns: vendorColumns, rows: vendorRows, empty_state: "—" }]
      : []),
    { kind: "table", title: "Detail",               columns: detailColumns, rows: detailRows, empty_state: "No expenses in this window." },
    {
      kind: "note",
      title: "Controller note",
      body:
        "Missing-evidence rows are expenses without an attached receipt or invoice and should be triaged before close. " +
        "Pending-approval count includes expenses in 'submitted' and 'under_review' states. Amounts are shown in their " +
        "native currency; consolidate via Treasury for a cross-currency view.",
    },
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
      { label: "Total Expenses",     value: total,     format: "money", tone: "negative" },
      { label: "Paid",               value: paid,      format: "money", tone: "neutral" },
      { label: "Unpaid",             value: unpaid,    format: "money", tone: unpaid > 0 ? "warning" : "neutral" },
      { label: "Missing Evidence",   value: missingEvidence, format: "count", tone: missingEvidence > 0 ? "warning" : "neutral" },
    ],
    sections,
    totals: [
      { label: "Approved Items",     value: approvedCount,   format: "count" },
      { label: "Pending Approval",   value: pendingApproval, format: "count" },
      { label: "Total Expenses",     value: total,           format: "money", emphasized: true },
    ],
    internal_warning: "INTERNAL — NOT FOR DISTRIBUTION",
    row_count: rows.length,
    total_amount: total,
  };
}
