import "server-only";

/* ===========================================================================
   GET /api/accounting/queue?status=…&kind=…&limit=…&offset=…

   Every operational document that can reach the ledger, in one list:
   payments, expenses, bank movements, issued invoices (revenue), shipped
   orders (COGS), vendor bills, goods receipts, payroll runs and FX
   exchanges. Each row is normalised to one "queue item" shape and
   carries the accounting_status its source table mirrors.

   Query params:
     · status = pending | drafted | posted | failed | voided | all
                (default: pending, drafted, failed — the actionable set)
     · kind   = one SourceKind, or omitted for all
     · limit  = max rows per kind (default 100, ceiling 500)

   Counts by status come back in the same response, computed with HEAD
   count queries over the whole tenant (not just the rows returned), so
   the tab badges are exact and the page needs one round trip.

   Every query is tenant-scoped; cross-tenant access returns empty.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { SOURCE_KINDS, isSourceKind, sourceTableFor, type SourceKind } from "@/lib/accounting/posting";

export type QueueStatus = "pending" | "drafted" | "posted" | "failed" | "voided";

export interface QueueItem {
  kind: SourceKind;
  source_id: string;
  /** Document number when the source has one (INV-…, GR-…, BILL-…). */
  reference: string | null;
  description: string;
  party_name: string | null;
  amount: number;
  currency: string;
  source_date: string;
  accounting_status: QueueStatus;
  accounting_entry_id: string | null;
  accounting_last_error: string | null;
  accounting_posted_at: string | null;
  created_at: string;
  /** Deep link to the operational document. */
  href: string | null;
}

const ALL_STATUSES: QueueStatus[] = ["pending", "drafted", "posted", "failed", "voided"];
const ACTIONABLE_STATUSES: QueueStatus[] = ["pending", "drafted", "failed"];
const ACCOUNTING_COLS = "accounting_status, accounting_entry_id, accounting_last_error, accounting_posted_at, created_at";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v) || 0;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const embedded = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] as T) ?? null : ((v as T) ?? null));

/* Per kind: the columns to read, which rows are eligible at all (a draft
   invoice is not "pending recognition" — it is not a document yet), and
   how a row becomes a queue item. */
interface KindSpec {
  select: string;
  /** Narrow to rows that are ledger-eligible. */
  filter?: (q: ReturnType<typeof supabaseServer.from>["select"] extends (...a: never[]) => infer R ? R : never) => unknown;
  dateCol: string;
  map: (r: Row) => Omit<QueueItem, "kind" | "source_id" | "accounting_status" | "accounting_entry_id" | "accounting_last_error" | "accounting_posted_at" | "created_at">;
}

const SPECS: Record<SourceKind, KindSpec> = {
  payment: {
    select: `id, direction, party_name, amount, currency, payment_date, reference_no, status, approval_status, ${ACCOUNTING_COLS}`,
    dateCol: "payment_date",
    map: (r) => ({
      reference: str(r.reference_no),
      description: r.direction === "in" ? "Customer collection" : "Supplier payment",
      party_name: str(r.party_name), amount: num(r.amount), currency: String(r.currency ?? ""),
      source_date: String(r.payment_date ?? ""), href: "/finance/payments",
    }),
  },
  expense: {
    select: `id, title, amount, currency, expense_date, payment_status, approval_status, ${ACCOUNTING_COLS}`,
    dateCol: "expense_date",
    map: (r) => ({
      reference: null, description: String(r.title ?? "Expense"), party_name: null,
      amount: num(r.amount), currency: String(r.currency ?? ""), source_date: String(r.expense_date ?? ""), href: "/finance/expenses",
    }),
  },
  cash_movement: {
    select: `id, direction, amount, currency, movement_date, bank_reference, counterparty_name, ${ACCOUNTING_COLS}`,
    dateCol: "movement_date",
    map: (r) => ({
      reference: str(r.bank_reference),
      description: r.direction === "inflow" ? "Bank inflow" : "Bank outflow",
      party_name: str(r.counterparty_name), amount: num(r.amount), currency: String(r.currency ?? ""),
      source_date: String(r.movement_date ?? ""), href: "/finance/reconciliation",
    }),
  },
  sales_revenue: {
    select: `id, inv_no, total, currency, issue_date, status, customer:customer_id ( name ), ${ACCOUNTING_COLS}`,
    dateCol: "issue_date",
    map: (r) => ({
      reference: str(r.inv_no), description: "Invoice issued",
      party_name: embedded<{ name?: string }>(r.customer)?.name ?? null,
      amount: num(r.total), currency: String(r.currency ?? ""), source_date: String(r.issue_date ?? ""), href: "/invoices",
    }),
  },
  inventory_cogs: {
    select: `id, shipment_no, status, shipped_at, sales_order_id, ${ACCOUNTING_COLS}`,
    dateCol: "shipped_at",
    map: (r) => ({
      reference: str(r.shipment_no), description: "Goods shipped (cost of sales)", party_name: null,
      amount: 0, currency: "", source_date: String(r.shipped_at ?? r.created_at ?? "").slice(0, 10),
      href: r.sales_order_id ? `/sales/orders/${r.sales_order_id}` : "/sales/orders",
    }),
  },
  vendor_bill: {
    select: `id, bill_no, supplier_invoice_no, total, currency, bill_date, status, supplier:supplier_id ( name, company_name ), ${ACCOUNTING_COLS}`,
    dateCol: "bill_date",
    map: (r) => {
      const s = embedded<{ name?: string; company_name?: string }>(r.supplier);
      return {
        reference: str(r.bill_no) ?? str(r.supplier_invoice_no), description: "Vendor bill",
        party_name: s?.company_name || s?.name || null, amount: num(r.total), currency: String(r.currency ?? ""),
        source_date: String(r.bill_date ?? ""), href: "/purchase",
      };
    },
  },
  inventory_receipt: {
    select: `id, gr_no, status, received_at, supplier:supplier_id ( name, company_name ), ${ACCOUNTING_COLS}`,
    dateCol: "received_at",
    map: (r) => {
      const s = embedded<{ name?: string; company_name?: string }>(r.supplier);
      return {
        reference: str(r.gr_no), description: "Goods received", party_name: s?.company_name || s?.name || null,
        amount: 0, currency: "", source_date: String(r.received_at ?? r.created_at ?? "").slice(0, 10), href: "/purchase",
      };
    },
  },
  payroll: {
    select: `id, period, country, status, total_gross, currency, ${ACCOUNTING_COLS}`,
    dateCol: "period",
    map: (r) => ({
      reference: `${r.period}${r.country ? ` · ${r.country}` : ""}`, description: "Payroll run", party_name: null,
      amount: num(r.total_gross), currency: String(r.currency ?? ""), source_date: `${r.period}-01`, href: "/hr/payroll",
    }),
  },
  fx_exchange: {
    select: `id, exchange_no, exchange_date, from_currency, to_currency, from_amount, to_amount, status, ${ACCOUNTING_COLS}`,
    dateCol: "exchange_date",
    map: (r) => ({
      reference: str(r.exchange_no), description: `FX ${r.from_currency} → ${r.to_currency}`, party_name: null,
      amount: num(r.from_amount), currency: String(r.from_currency ?? ""), source_date: String(r.exchange_date ?? ""), href: "/finance/fx-rates",
    }),
  },
};

/* Rows that are not documents yet never enter the queue: a draft invoice,
   an unshipped shipment, a draft payroll run, a cancelled bill. Applied to
   both the list and the counts so the badges agree with the table. */
function eligible(kind: SourceKind, q: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (kind) {
    case "sales_revenue":     return q.in("status", ["sent", "partial", "paid", "overdue", "cancelled", "void"]);
    case "inventory_cogs":    return q.eq("status", "shipped");
    case "payroll":           return q.neq("status", "draft");
    case "vendor_bill":       return q.not("status", "in", "(draft)");
    case "inventory_receipt": return q.in("status", ["posted", "voided"]);
    case "payment":           return q.eq("status", "completed");
    default:                  return q;
  }
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const kindParam = url.searchParams.get("kind");
  const reqLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(reqLimit) && reqLimit > 0 ? Math.min(reqLimit, 500) : 100;

  const statuses: QueueStatus[] = statusParam === "all"
    ? ALL_STATUSES
    : statusParam
      ? statusParam.split(",").filter((s): s is QueueStatus => (ALL_STATUSES as string[]).includes(s))
      : ACTIONABLE_STATUSES;
  if (statuses.length === 0) return NextResponse.json({ error: "No valid status" }, { status: 400 });

  const kinds: SourceKind[] = isSourceKind(kindParam) ? [kindParam] : [...SOURCE_KINDS];

  /* Posted / voided history is unbounded; the queue shows the last 14
     days of it. Actionable states are always shown in full. */
  const sinceIso = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const historical = statuses.every((s) => s === "posted" || s === "voided");

  const tenantFilter = (kind: SourceKind, q: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
    kind === "payroll" ? q.or(`tenant_id.eq.${auth.tenant_id},tenant_id.is.null`) : q.eq("tenant_id", auth.tenant_id);

  const listQ = (kind: SourceKind) => {
    const table = sourceTableFor(kind)!;
    let q = tenantFilter(kind, supabaseServer.from(table).select(SPECS[kind].select)).in("accounting_status", statuses);
    q = eligible(kind, q);
    if (historical) q = q.gte("created_at", sinceIso);
    return q.order("created_at", { ascending: false }).limit(limit);
  };
  const countQ = (kind: SourceKind, status: QueueStatus) => {
    const table = sourceTableFor(kind)!;
    let q = tenantFilter(kind, supabaseServer.from(table).select("id", { count: "exact", head: true })).eq("accounting_status", status);
    q = eligible(kind, q);
    if (status === "posted" || status === "voided") q = q.gte("created_at", sinceIso);
    return q;
  };

  type Counted = { k: SourceKind; s: QueueStatus; n: number };
  const [lists, counted] = await Promise.all([
    Promise.all(kinds.map((k) => listQ(k))),
    Promise.all(kinds.flatMap((k) => ALL_STATUSES.map((s): Promise<Counted> =>
      (countQ(k, s) as Promise<{ count: number | null }>).then((r) => ({ k, s, n: r.count ?? 0 }))))),
  ]);

  const items: QueueItem[] = [];
  kinds.forEach((kind, i) => {
    const res = lists[i] as { data: Row[] | null; error: { message: string } | null };
    if (res.error) { console.warn(`[accounting/queue] ${kind}:`, res.error.message); return; }
    for (const r of res.data ?? []) {
      items.push({
        kind,
        source_id: String(r.id),
        ...SPECS[kind].map(r),
        accounting_status: (r.accounting_status as QueueStatus) ?? "pending",
        accounting_entry_id: str(r.accounting_entry_id),
        accounting_last_error: str(r.accounting_last_error),
        accounting_posted_at: str(r.accounting_posted_at),
        created_at: String(r.created_at ?? ""),
      });
    }
  });
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const counts: Record<QueueStatus, number> = { pending: 0, drafted: 0, posted: 0, failed: 0, voided: 0 };
  const countsByKind: Partial<Record<SourceKind, number>> = {};
  for (const c of counted) {
    counts[c.s] += c.n;
    if (ACTIONABLE_STATUSES.includes(c.s)) countsByKind[c.k] = (countsByKind[c.k] ?? 0) + c.n;
  }

  return NextResponse.json({ items, counts, counts_by_kind: countsByKind, kinds: SOURCE_KINDS });
}
