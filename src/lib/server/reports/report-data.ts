import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the numbers blocks (Phase 4B, owner's picks 25 Sep
   2026): the AUTHOR's own documents, read by the server, never typed.

     quotations      their quotations issued in the period (not drafts)
     orders          orders in the period they created, or that their own
                     quotations became (existing orders carry no creator)
     invoices        their invoices issued in the period (not draft / void /
                     cancelled)
     quotes_waiting  their quotations SENT and not yet an order — how many
                     days since they were sent (the status history's own
                     moment, not the date written on the quotation)
     receivables     their invoices with money still owed — days past due
     purchase_orders their purchase orders dated in the period (4C)
     receipts        goods received in the period against their own orders
     shortages       items of their open orders received only in part
     pos_late        their orders past the expected delivery, not delivered
     payables        their supplier bills with money still to pay
     expenses        their own expenses dated in a trip's days (4D; not rejected)

   Called only for the author (the draft's GET and its date move, and the
   send, which freezes the answer into the report). Each source needs its
   app (requireModuleAccess) — without it the block says so, empty. Every
   read is pinned to the author (`created_by` / `created_by_account_id`) or
   to ids taken from the author's own rows. Customers are the names written
   on the documents (they carry no customer record id); a supplier is its
   contact's name. Ids go to the database a hundred at a time — a long
   `.in()` list breaks the request URL. ⚠️ The status columns of quotations,
   invoices, purchase orders, receipts and bills are ENUMS: a value that is
   not in the type fails the whole query (22P02) — filters name only real
   values (read from the schema 25 Sep 2026).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAccess, type ServerAuthContext } from "@/lib/server/auth";
import { REPORT_LIMITS, periodFor, rangeEnd, reportTemplate, type ReportDataRow, type ReportDataSource, type ReportDataValue } from "@/lib/reports/templates";
import { DATA_MODULE } from "@/lib/reports/report-data";

const LIMIT = REPORT_LIMITS.dataRows;
const DAY = 86_400_000;

type Facts = { template_key: string; tenant_id: string | null; period_start: string | null; period_end: string | null };
type Ctx = { me: string; tenant: string | null; start: string; end: string; today: string };

const money = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const day = (iso: unknown): string | null => (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null);
const daysFrom = (fromYmd: string, toYmd: string) => Math.max(0, Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / DAY));
const nextDay = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
/** The customer as the document names it: the company, else the person. */
const who = (...names: unknown[]) => (names.find((x) => typeof x === "string" && x.trim()) as string | undefined)?.trim() ?? "";

type Q = { id: string; quote_no: string | null; status: string; currency: string | null; total: unknown; issue_date: string | null; valid_till?: string | null; created_at?: string; company: string | null; customer: string | null; history?: unknown };
type I = { id: string; inv_no: string | null; status?: string; currency: string | null; total?: unknown; amount_paid?: unknown; balance: unknown; issue_date?: string | null; due_date?: string | null; company: string | null; customer: string | null };
type O = { id: string; order_no: string | null; deal_no: number | string | null; status: string; currency: string | null; total: unknown; created_at: string; customer_name: string | null; company_name: string | null; customer_code: string | null };
type P = { id: string; po_no: string | null; supplier_id: string | null; status: string; order_date?: string | null; expected_delivery_date?: string | null; currency: string | null; total: unknown };

const chunks = <T,>(xs: T[], n = 100): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function listOf<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}

/** The suppliers' names, for supplier ids taken from the author's rows. */
async function supplierNames(c: Ctx, ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  const out = new Map<string, string>();
  for (const part of chunks(unique)) {
    let q = supabaseServer.from("contacts").select("id, display_name, company_name, full_name").in("id", part);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    for (const r of listOf<{ id: string; display_name: string | null; company_name: string | null; full_name: string | null }>(await q, "suppliers")) out.set(r.id, who(r.company_name, r.display_name, r.full_name));
  }
  return out;
}

/** The expense categories' names, for category ids taken from the author's rows. */
async function categoryNames(c: Ctx, ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  const out = new Map<string, string>();
  for (const part of chunks(unique)) {
    let q = supabaseServer.from("finance_expense_categories").select("id, name").in("id", part);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    for (const r of listOf<{ id: string; name: string | null }>(await q, "expense categories")) out.set(r.id, r.name ?? "");
  }
  return out;
}

/** The author's own purchase orders (id and number), for what came in
 *  against them; `open` leaves out the closed ones. */
async function myPurchaseOrders(c: Ctx, open: boolean): Promise<Array<{ id: string; po_no: string | null }>> {
  let q = supabaseServer.from("purchase_orders").select("id, po_no").eq("created_by_account_id", c.me)
    .not("status", "in", open ? "(draft,cancelled,closed)" : "(draft,cancelled)");
  if (c.tenant) q = q.eq("tenant_id", c.tenant);
  return listOf<{ id: string; po_no: string | null }>(await q.order("created_at", { ascending: false }).limit(500), "purchase orders (mine)");
}

/** When a quotation was really sent: its last "sent" in the status
 *  history, else the date written on it. */
function sentDay(q: Q): string | null {
  const h = Array.isArray(q.history) ? (q.history as Array<{ status?: unknown; at?: unknown }>) : [];
  for (let i = h.length - 1; i >= 0; i--) if (h[i]?.status === "sent" && day(h[i]?.at)) return day(h[i].at);
  return day(q.issue_date) ?? day(q.created_at);
}

const READ: Record<ReportDataSource, (c: Ctx) => Promise<ReportDataRow[]>> = {
  async quotations(c) {
    let q = supabaseServer.from("quotations")
      .select("id, quote_no, status, currency, total, issue_date, company:doc->>companyName, customer:doc->>customerName")
      .eq("created_by", c.me).neq("status", "draft").gte("issue_date", c.start).lte("issue_date", c.end);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    const rows = listOf<Q>(await q.order("issue_date", { ascending: true }).limit(LIMIT + 1), "quotations");
    return rows.map((q) => ({ key: q.id, currency: q.currency ?? undefined, cells: { no: q.quote_no ?? "—", customer: who(q.company, q.customer), date: day(q.issue_date), amount: money(q.total), status: q.status } }));
  },
  async orders(c) {
    /* The orders the author's own quotations became (ids from their rows). */
    let mq = supabaseServer.from("quotations").select("order_id").eq("created_by", c.me).not("order_id", "is", null);
    if (c.tenant) mq = mq.eq("tenant_id", c.tenant);
    const mine = listOf<{ order_id: string | null }>(await mq.limit(500), "orders (quotations)");
    const ids = Array.from(new Set(mine.map((x) => x.order_id).filter((x): x is string => !!x)));
    let q = supabaseServer.from("orders")
      .select("id, order_no, deal_no, status, currency, total, created_at, customer_name, company_name, customer_code")
      .or(ids.length ? `created_by.eq.${c.me},id.in.(${ids.join(",")})` : `created_by.eq.${c.me}`)
      .neq("status", "cancelled").gte("created_at", `${c.start}T00:00:00Z`).lt("created_at", `${nextDay(c.end)}T00:00:00Z`);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    const rows = listOf<O>(await q.order("created_at", { ascending: true }).limit(LIMIT + 1), "orders");
    return rows.map((o) => ({ key: o.id, currency: o.currency ?? undefined, cells: {
      no: o.order_no || (o.deal_no != null ? `#${o.deal_no}` : "—"), customer: who(o.company_name, o.customer_name, o.customer_code), date: day(o.created_at), amount: money(o.total), status: o.status,
    } }));
  },
  async invoices(c) {
    let q = supabaseServer.from("invoices")
      .select("id, inv_no, status, currency, total, amount_paid, balance, issue_date, company:doc->>companyName, customer:doc->>customerName")
      .eq("created_by_account_id", c.me).not("status", "in", "(draft,void,cancelled)").is("cancelled_at", null)
      .gte("issue_date", c.start).lte("issue_date", c.end);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    const rows = listOf<I>(await q.order("issue_date", { ascending: true }).limit(LIMIT + 1), "invoices");
    return rows.map((i) => ({ key: i.id, currency: i.currency ?? undefined, cells: {
      no: i.inv_no ?? "—", customer: who(i.company, i.customer), date: day(i.issue_date), amount: money(i.total), paid: money(i.amount_paid), balance: money(i.balance),
    } }));
  },
  async quotes_waiting(c) {
    let q = supabaseServer.from("quotations")
      .select("id, quote_no, status, currency, total, issue_date, valid_till, created_at, company:doc->>companyName, customer:doc->>customerName, history:doc->statusHistory")
      .eq("created_by", c.me).eq("status", "sent").is("order_id", null);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    const rows = listOf<Q>(await q.order("issue_date", { ascending: true }).limit(LIMIT + 1), "quotes waiting");
    return rows.map((q) => {
      const sent = sentDay(q);
      return { key: q.id, currency: q.currency ?? undefined, cells: {
        no: q.quote_no ?? "—", customer: who(q.company, q.customer), sent, days: sent ? daysFrom(sent, c.today) : null, amount: money(q.total), valid: day(q.valid_till),
      } };
    }).sort((a, b) => Number(b.cells.days ?? -1) - Number(a.cells.days ?? -1));
  },
  async receivables(c) {
    let q = supabaseServer.from("invoices")
      .select("id, inv_no, currency, balance, due_date, company:doc->>companyName, customer:doc->>customerName")
      .eq("created_by_account_id", c.me).not("status", "in", "(draft,void,cancelled)").is("cancelled_at", null).gt("balance", 0);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    const rows = listOf<I>(await q.order("due_date", { ascending: true, nullsFirst: false }).limit(LIMIT + 1), "receivables");
    return rows.map((i) => {
      const due = day(i.due_date);
      return { key: i.id, currency: i.currency ?? undefined, cells: { no: i.inv_no ?? "—", customer: who(i.company, i.customer), due, overdue: due ? daysFrom(due, c.today) : 0, balance: money(i.balance) } };
    }).sort((a, b) => Number(b.cells.overdue) - Number(a.cells.overdue) || String(a.cells.due ?? "9").localeCompare(String(b.cells.due ?? "9")));
  },
  async purchase_orders(c) {
    let q = supabaseServer.from("purchase_orders").select("id, po_no, supplier_id, status, order_date, currency, total")
      .eq("created_by_account_id", c.me).not("status", "in", "(draft,cancelled)").gte("order_date", c.start).lte("order_date", c.end);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    const rows = listOf<P>(await q.order("order_date", { ascending: true }).limit(LIMIT + 1), "purchase orders");
    const names = await supplierNames(c, rows.map((r) => r.supplier_id));
    return rows.map((p) => ({ key: p.id, currency: p.currency ?? undefined, cells: { no: p.po_no ?? "—", supplier: names.get(p.supplier_id ?? "") ?? "", date: day(p.order_date), amount: money(p.total), status: p.status } }));
  },
  async receipts(c) {
    const pos = await myPurchaseOrders(c, false);
    const poNo = new Map(pos.map((p) => [p.id, p.po_no ?? "—"]));
    type R = { id: string; gr_no: string | null; po_id: string; supplier_id: string | null; status: string; received_at: string | null };
    const rows: R[] = [];
    for (const part of chunks(pos.map((p) => p.id))) {
      let q = supabaseServer.from("purchase_receipts").select("id, gr_no, po_id, supplier_id, status, received_at").in("po_id", part)
        .not("status", "in", "(draft,cancelled,voided)").is("voided_at", null).gte("received_at", `${c.start}T00:00:00Z`).lt("received_at", `${nextDay(c.end)}T00:00:00Z`);
      if (c.tenant) q = q.eq("tenant_id", c.tenant);
      rows.push(...listOf<R>(await q.limit(LIMIT + 1), "receipts"));
    }
    rows.sort((a, b) => String(a.received_at).localeCompare(String(b.received_at)));
    const names = await supplierNames(c, rows.slice(0, LIMIT + 1).map((r) => r.supplier_id));
    return rows.map((r) => ({ key: r.id, cells: { no: r.gr_no ?? "—", supplier: names.get(r.supplier_id ?? "") ?? "", date: day(r.received_at), po: poNo.get(r.po_id) ?? "—", status: r.status } }));
  },
  async shortages(c) {
    const pos = await myPurchaseOrders(c, true);
    const poNo = new Map(pos.map((p) => [p.id, p.po_no ?? "—"]));
    type It = { id: string; po_id: string; description: string | null; qty: unknown; qty_received: unknown };
    const items: It[] = [];
    for (const part of chunks(pos.map((p) => p.id))) {
      /* The items carry no tenant of their own: their orders are the author's. */
      const q = supabaseServer.from("purchase_order_items").select("id, po_id, description, qty, qty_received").in("po_id", part).gt("qty_received", 0);
      items.push(...listOf<It>(await q.limit(500), "shortages"));
    }
    /* Received in part: what came is more than nothing and less than ordered. */
    return items.filter((i) => Number(i.qty_received) < Number(i.qty)).map((i) => ({ key: i.id, cells: {
      no: poNo.get(i.po_id) ?? "—", item: i.description ?? "—", ordered: money(i.qty), received: money(i.qty_received), missing: money(Number(i.qty) - Number(i.qty_received)),
    } })).sort((a, b) => Number(b.cells.missing) - Number(a.cells.missing));
  },
  async pos_late(c) {
    let q = supabaseServer.from("purchase_orders").select("id, po_no, supplier_id, status, expected_delivery_date, currency, total")
      .eq("created_by_account_id", c.me).not("status", "in", "(draft,cancelled,received,closed)").is("actual_delivery_date", null).lt("expected_delivery_date", c.today);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    const rows = listOf<P>(await q.order("expected_delivery_date", { ascending: true }).limit(LIMIT + 1), "late purchase orders");
    const names = await supplierNames(c, rows.map((r) => r.supplier_id));
    return rows.map((p) => {
      const expected = day(p.expected_delivery_date);
      return { key: p.id, currency: p.currency ?? undefined, cells: { no: p.po_no ?? "—", supplier: names.get(p.supplier_id ?? "") ?? "", expected, late: expected ? daysFrom(expected, c.today) : 0, amount: money(p.total), status: p.status } };
    }).sort((a, b) => Number(b.cells.late) - Number(a.cells.late));
  },
  async payables(c) {
    let q = supabaseServer.from("vendor_bills").select("id, bill_no, supplier_invoice_no, supplier_id, status, due_date, currency, balance")
      .eq("created_by_account_id", c.me).not("status", "in", "(draft,cancelled,paid)").gt("balance", 0);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    type B = { id: string; bill_no: string | null; supplier_invoice_no: string | null; supplier_id: string | null; status: string; due_date: string | null; currency: string | null; balance: unknown };
    const rows = listOf<B>(await q.order("due_date", { ascending: true, nullsFirst: false }).limit(LIMIT + 1), "supplier bills");
    const names = await supplierNames(c, rows.map((r) => r.supplier_id));
    return rows.map((b) => {
      const due = day(b.due_date);
      return { key: b.id, currency: b.currency ?? undefined, cells: { no: b.bill_no || b.supplier_invoice_no || "—", supplier: names.get(b.supplier_id ?? "") ?? "", due, overdue: due ? daysFrom(due, c.today) : 0, balance: money(b.balance) } };
    }).sort((a, b) => Number(b.cells.overdue) - Number(a.cells.overdue));
  },
  async expenses(c) {
    /* approval_status is plain text; a rejected expense was never spent. */
    let q = supabaseServer.from("finance_expenses").select("id, title, category_id, expense_date, amount, currency, approval_status")
      .eq("created_by_account_id", c.me).neq("approval_status", "rejected").gte("expense_date", c.start).lte("expense_date", c.end);
    if (c.tenant) q = q.eq("tenant_id", c.tenant);
    type E = { id: string; title: string | null; category_id: string | null; expense_date: string | null; amount: unknown; currency: string | null; approval_status: string | null };
    const rows = listOf<E>(await q.order("expense_date", { ascending: true }).limit(LIMIT + 1), "expenses");
    const cats = await categoryNames(c, rows.map((r) => r.category_id));
    return rows.map((e) => ({ key: e.id, currency: e.currency ?? undefined, cells: {
      title: e.title || "—", category: cats.get(e.category_id ?? "") ?? "", date: day(e.expense_date), amount: money(e.amount), status: e.approval_status,
    } }));
  },
};

/** The numbers blocks of the author's report, by section id — for the
 *  report's own period, or for `date`'s period when the draft moves (a
 *  range template — a trip — from `date` to `to`). */
export async function loadReportData(row: Facts, auth: ServerAuthContext, date?: string | null, to?: string | null): Promise<Record<string, ReportDataValue>> {
  const tpl = reportTemplate(row.template_key);
  const secs = (tpl?.sections ?? []).filter((s) => s.kind === "data" && s.source);
  if (!tpl || !secs.length) return {};
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const period = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? (tpl.range ? { start: date, end: rangeEnd(date, to) } : periodFor(tpl.cadence, date))
    : { start: row.period_start ?? today, end: row.period_end ?? row.period_start ?? today };
  const c: Ctx = { me: auth.account_id, tenant: auth.tenant_id ?? null, start: period.start, end: period.end, today };
  const sources = Array.from(new Set(secs.map((s) => s.source!)));
  const answers = new Map(await Promise.all(sources.map(async (src): Promise<[ReportDataSource, ReportDataValue]> => {
    const capturedAt = now.toISOString();
    if (await requireModuleAccess(auth, DATA_MODULE[src])) return [src, { source: src, rows: [], capturedAt, denied: true }];
    try {
      const rows = await READ[src](c);
      return [src, rows.length > LIMIT ? { source: src, rows: rows.slice(0, LIMIT), capturedAt, truncated: true } : { source: src, rows, capturedAt }];
    } catch (e) {
      /* Said as such — a failed read never passes for "nothing in this period". */
      console.error(`[reports] numbers ${src}:`, e instanceof Error ? e.message : e);
      return [src, { source: src, rows: [], capturedAt, failed: true }];
    }
  })));
  return Object.fromEntries(secs.map((s) => [s.id, answers.get(s.source!)!]));
}
