import "server-only";

/* ===========================================================================
   Phase A.6 — AR / AP aging + inventory valuation summary + gross profit.

   Pure-read functions. All four reuse data already produced by earlier
   phases:
     · AR aging       — open invoices (total − amount_paid) bucketed by
                         days past due_date
     · AP aging       — open vendor_bills (total − amount_paid) bucketed
                         by days past due_date
     · Inventory val  — wraps the O.5 valuation snapshot
     · Gross profit   — per-invoice: revenue from posted sales_revenue
                         entry, COGS from the linked shipment's posted
                         inventory_cogs entry; if either side is
                         missing we report what we have and let the
                         caller see the gap.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

/* ─── Aging buckets ───────────────────────────────────────────── */

export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

const BUCKETS: AgingBucket[] = ["current", "1-30", "31-60", "61-90", "90+"];

function bucketForDays(d: number): AgingBucket {
  if (d <= 0) return "current";
  if (d <= 30) return "1-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "90+";
}

function daysBetween(asOf: Date, dueIso: string | null): number {
  if (!dueIso) return 0;
  const due = new Date(dueIso);
  if (isNaN(due.getTime())) return 0;
  return Math.floor((asOf.getTime() - due.getTime()) / 86_400_000);
}

export interface AgingPartyRow {
  party_id: string | null;
  party_name: string | null;
  total_open: number;
  total_overdue: number;
  buckets: Record<AgingBucket, number>;
  currency: string;
}
export interface AgingReport {
  as_of: string;
  buckets: AgingBucket[];
  parties: AgingPartyRow[];
  totals: {
    by_bucket: Record<AgingBucket, number>;
    total_open: number;
    total_overdue: number;
  };
}

function emptyBuckets(): Record<AgingBucket, number> {
  return { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
}

export async function buildArAging(tenantId: string, asOfIso?: string): Promise<AgingReport> {
  const asOf = asOfIso ? new Date(asOfIso) : new Date();
  const asOfDate = asOf.toISOString().slice(0, 10);

  const { data: invoices, error } = await supabaseServer
    .from("invoices")
    .select("id, customer_id, total, amount_paid, balance, due_date, currency, status, cancelled_at")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  const open = ((invoices ?? []) as Array<{
    id: string; customer_id: string | null; total: number; amount_paid: number; balance: number;
    due_date: string | null; currency: string; status: string; cancelled_at: string | null;
  }>).filter((i) => !i.cancelled_at && i.status !== "cancelled" && i.status !== "void" && i.status !== "draft");

  const customerIds = Array.from(new Set(open.map((i) => i.customer_id).filter(Boolean) as string[]));
  const custRes = customerIds.length
    ? await supabaseServer.from("customers").select("id, name").in("id", customerIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const custMap = new Map<string, string>();
  for (const c of (custRes.data ?? [])) custMap.set(c.id, c.name);

  const partyMap = new Map<string, AgingPartyRow>();
  for (const inv of open) {
    const due = Number(inv.balance) > 0 ? Number(inv.balance) : Number(inv.total) - Number(inv.amount_paid);
    if (due <= 0.0001) continue;
    const days = daysBetween(asOf, inv.due_date);
    const bucket = bucketForDays(days);
    const key = inv.customer_id ?? "—";
    const cur = partyMap.get(key) ?? {
      party_id: inv.customer_id,
      party_name: inv.customer_id ? custMap.get(inv.customer_id) ?? null : null,
      total_open: 0, total_overdue: 0,
      buckets: emptyBuckets(),
      currency: inv.currency || "USD",
    };
    cur.total_open    += due;
    cur.buckets[bucket] += due;
    if (bucket !== "current") cur.total_overdue += due;
    partyMap.set(key, cur);
  }

  const parties = Array.from(partyMap.values()).sort((a, b) => b.total_open - a.total_open);
  const totals = parties.reduce(
    (acc, p) => {
      for (const b of BUCKETS) acc.by_bucket[b] += p.buckets[b];
      acc.total_open    += p.total_open;
      acc.total_overdue += p.total_overdue;
      return acc;
    },
    { by_bucket: emptyBuckets(), total_open: 0, total_overdue: 0 },
  );

  return { as_of: asOfDate, buckets: BUCKETS, parties, totals };
}

export async function buildApAging(tenantId: string, asOfIso?: string): Promise<AgingReport> {
  const asOf = asOfIso ? new Date(asOfIso) : new Date();
  const asOfDate = asOf.toISOString().slice(0, 10);

  const { data: bills, error } = await supabaseServer
    .from("vendor_bills")
    .select("id, supplier_id, total, amount_paid, balance, due_date, currency, status")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  const open = ((bills ?? []) as Array<{
    id: string; supplier_id: string; total: number; amount_paid: number; balance: number;
    due_date: string | null; currency: string; status: string;
  }>).filter((b) => b.status !== "cancelled" && b.status !== "draft");

  const supplierIds = Array.from(new Set(open.map((b) => b.supplier_id).filter(Boolean)));
  const supRes = supplierIds.length
    ? await supabaseServer.from("contacts").select("id, display_name, company_name").in("id", supplierIds)
    : { data: [] as Array<{ id: string; display_name: string | null; company_name: string | null }> };
  const supMap = new Map<string, string>();
  for (const s of (supRes.data ?? [])) {
    supMap.set(s.id, s.company_name ?? s.display_name ?? s.id.slice(0, 8));
  }

  const partyMap = new Map<string, AgingPartyRow>();
  for (const b of open) {
    const due = Number(b.balance) > 0 ? Number(b.balance) : Number(b.total) - Number(b.amount_paid);
    if (due <= 0.0001) continue;
    const days = daysBetween(asOf, b.due_date);
    const bucket = bucketForDays(days);
    const key = b.supplier_id;
    const cur = partyMap.get(key) ?? {
      party_id: b.supplier_id,
      party_name: supMap.get(b.supplier_id) ?? null,
      total_open: 0, total_overdue: 0,
      buckets: emptyBuckets(),
      currency: b.currency || "USD",
    };
    cur.total_open    += due;
    cur.buckets[bucket] += due;
    if (bucket !== "current") cur.total_overdue += due;
    partyMap.set(key, cur);
  }

  const parties = Array.from(partyMap.values()).sort((a, b) => b.total_open - a.total_open);
  const totals = parties.reduce(
    (acc, p) => {
      for (const b of BUCKETS) acc.by_bucket[b] += p.buckets[b];
      acc.total_open    += p.total_open;
      acc.total_overdue += p.total_overdue;
      return acc;
    },
    { by_bucket: emptyBuckets(), total_open: 0, total_overdue: 0 },
  );

  return { as_of: asOfDate, buckets: BUCKETS, parties, totals };
}

/* ─── Inventory valuation summary (wraps O.5) ───────────────── */

export interface InventoryValuationRow {
  inventory_item_id: string;
  item_code: string;
  item_name: string | null;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  qty_on_hand: number;
  average_cost: number;
  inventory_value: number;
  currency: string;
}
export interface InventoryValuationSummary {
  as_of: string;
  rows: InventoryValuationRow[];
  totals: {
    total_qty: number;
    total_value: number;
    by_currency: Record<string, number>;
  };
}

export async function buildInventoryValuationSummary(tenantId: string): Promise<InventoryValuationSummary> {
  const { data: vals, error } = await supabaseServer
    .from("inventory_valuation")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  const rows = ((vals ?? []) as Array<{
    inventory_item_id: string; warehouse_id: string;
    qty_on_hand: number; average_cost: number; inventory_value: number; currency: string;
  }>).filter((r) => Number(r.qty_on_hand) > 0);
  if (rows.length === 0) {
    return {
      as_of: new Date().toISOString().slice(0, 10),
      rows: [],
      totals: { total_qty: 0, total_value: 0, by_currency: {} },
    };
  }

  const itemIds = Array.from(new Set(rows.map((r) => r.inventory_item_id)));
  const whIds   = Array.from(new Set(rows.map((r) => r.warehouse_id)));
  const [itemsRes, whRes] = await Promise.all([
    supabaseServer.from("inventory_items").select("id, item_code, item_name").in("id", itemIds),
    supabaseServer.from("inventory_warehouses").select("id, code, name").in("id", whIds),
  ]);
  const itemMap = new Map<string, { item_code: string; item_name: string }>();
  for (const i of (itemsRes.data ?? []) as Array<{ id: string; item_code: string; item_name: string }>) {
    itemMap.set(i.id, { item_code: i.item_code, item_name: i.item_name });
  }
  const whMap = new Map<string, { code: string; name: string }>();
  for (const w of (whRes.data ?? []) as Array<{ id: string; code: string; name: string }>) {
    whMap.set(w.id, { code: w.code, name: w.name });
  }

  const enriched: InventoryValuationRow[] = rows.map((r) => {
    const it = itemMap.get(r.inventory_item_id);
    const wh = whMap.get(r.warehouse_id) ?? { code: "?", name: "Unknown" };
    return {
      inventory_item_id: r.inventory_item_id,
      item_code: it?.item_code ?? "—",
      item_name: it?.item_name ?? null,
      warehouse_id: r.warehouse_id,
      warehouse_code: wh.code,
      warehouse_name: wh.name,
      qty_on_hand: Number(r.qty_on_hand) || 0,
      average_cost: Number(r.average_cost) || 0,
      inventory_value: Number(r.inventory_value) || 0,
      currency: r.currency || "USD",
    };
  });

  let totalQty = 0;
  let totalValue = 0;
  const byCurrency: Record<string, number> = {};
  for (const r of enriched) {
    totalQty += r.qty_on_hand;
    totalValue += r.inventory_value;
    byCurrency[r.currency] = (byCurrency[r.currency] ?? 0) + r.inventory_value;
  }

  return {
    as_of: new Date().toISOString().slice(0, 10),
    rows: enriched.sort((a, b) => b.inventory_value - a.inventory_value),
    totals: { total_qty: totalQty, total_value: totalValue, by_currency: byCurrency },
  };
}

/* ─── Gross Profit per invoice ─────────────────────────────────
   Pairs A.5 (revenue) with A.4 (COGS) — same SO ladder, opposite
   sides of the ledger. The pair-up is done through the SO that
   links the invoice to its shipments: revenue lives on the invoice,
   COGS lives on the shipment(s) for that SO. If multiple shipments
   exist we sum their COGS into a single row keyed on the invoice.

   If either side is unposted we still surface what we have so the
   operator can spot gaps. */

export interface GrossProfitRow {
  invoice_id: string;
  invoice_no: string | null;
  customer_id: string | null;
  customer_name: string | null;
  currency: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_pct: number;
  revenue_status: "posted" | "drafted" | "missing";
  cogs_status: "posted" | "drafted" | "missing" | "partial";
  /** All shipment numbers that contributed to COGS for this row. */
  shipment_nos: string[];
}
export interface GrossProfitReport {
  as_of: string;
  from: string | null;
  to: string | null;
  rows: GrossProfitRow[];
  totals: {
    revenue: number;
    cogs: number;
    gross_profit: number;
    margin_pct: number;
  };
}

export async function buildGrossProfit(opts: {
  tenantId: string;
  from?: string;
  to?: string;
}): Promise<GrossProfitReport> {
  const today = new Date().toISOString().slice(0, 10);

  /* Pull every invoice that isn't draft/cancelled in the window. */
  let q = supabaseServer
    .from("invoices")
    .select("id, inv_no, customer_id, currency, total, status, cancelled_at, issue_date, sales_order_id, accounting_status")
    .eq("tenant_id", opts.tenantId);
  if (opts.from) q = q.gte("issue_date", opts.from);
  if (opts.to)   q = q.lte("issue_date", opts.to);
  const { data: invoices, error } = await q;
  if (error) throw new Error(error.message);
  const invs = ((invoices ?? []) as Array<{
    id: string; inv_no: string | null; customer_id: string | null; currency: string;
    total: number; status: string; cancelled_at: string | null; issue_date: string;
    sales_order_id: string | null; accounting_status: string | null;
  }>).filter((i) => !i.cancelled_at && i.status !== "draft" && i.status !== "cancelled" && i.status !== "void");

  if (invs.length === 0) {
    return {
      as_of: today, from: opts.from ?? null, to: opts.to ?? null,
      rows: [],
      totals: { revenue: 0, cogs: 0, gross_profit: 0, margin_pct: 0 },
    };
  }

  /* Customer names for display. */
  const customerIds = Array.from(new Set(invs.map((i) => i.customer_id).filter(Boolean) as string[]));
  const custRes = customerIds.length
    ? await supabaseServer.from("customers").select("id, name").in("id", customerIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const custMap = new Map<string, string>();
  for (const c of (custRes.data ?? [])) custMap.set(c.id, c.name);

  /* For each invoice, find its shipments via sales_order_id and sum
     posted COGS entries (source_type='inventory_cogs'). */
  const soIds = Array.from(new Set(invs.map((i) => i.sales_order_id).filter(Boolean) as string[]));
  const { data: shipments } = soIds.length
    ? await supabaseServer
        .from("sales_shipments")
        .select("id, sales_order_id, shipment_no, status, accounting_status, accounting_entry_id")
        .in("sales_order_id", soIds)
        .eq("tenant_id", opts.tenantId)
    : { data: [] as Array<{ id: string; sales_order_id: string; shipment_no: string; status: string; accounting_status: string | null; accounting_entry_id: string | null }> };

  const shipmentsBySo = new Map<string, Array<{ id: string; shipment_no: string; status: string; accounting_status: string | null; accounting_entry_id: string | null }>>();
  for (const s of (shipments ?? [])) {
    const arr = shipmentsBySo.get(s.sales_order_id) ?? [];
    arr.push(s);
    shipmentsBySo.set(s.sales_order_id, arr);
  }

  /* Pull posted COGS journal lines (debit on 5400) for any of those
     shipments so we don't trust the operational status alone. */
  const cogsEntryIds = Array.from(new Set(
    Array.from(shipmentsBySo.values())
      .flat()
      .map((s) => s.accounting_entry_id)
      .filter(Boolean) as string[],
  ));
  const cogsLinesRes = cogsEntryIds.length
    ? await supabaseServer
        .from("accounting_journal_lines")
        .select("entry_id, debit")
        .in("entry_id", cogsEntryIds)
        .eq("tenant_id", opts.tenantId)
    : { data: [] as Array<{ entry_id: string; debit: number }> };
  const cogsLines = (cogsLinesRes.data ?? []) as Array<{ entry_id: string; debit: number }>;
  const cogsByEntry = new Map<string, number>();
  for (const l of cogsLines) {
    cogsByEntry.set(l.entry_id, (cogsByEntry.get(l.entry_id) ?? 0) + (Number(l.debit) || 0));
  }
  /* Status of each cogs entry. */
  const cogsEntriesRes = cogsEntryIds.length
    ? await supabaseServer
        .from("accounting_journal_entries")
        .select("id, status")
        .in("id", cogsEntryIds)
    : { data: [] as Array<{ id: string; status: string }> };
  const cogsStatusByEntry = new Map<string, string>();
  for (const e of (cogsEntriesRes.data ?? [])) cogsStatusByEntry.set(e.id, e.status);

  const rows: GrossProfitRow[] = invs.map((inv) => {
    const revenue = Number(inv.total) || 0;
    const ships = inv.sales_order_id ? shipmentsBySo.get(inv.sales_order_id) ?? [] : [];
    let cogs = 0;
    const cogsStatuses = new Set<string>();
    const shipNos: string[] = [];
    for (const s of ships) {
      shipNos.push(s.shipment_no);
      if (!s.accounting_entry_id) {
        cogsStatuses.add("missing");
        continue;
      }
      const status = cogsStatusByEntry.get(s.accounting_entry_id) ?? "missing";
      cogsStatuses.add(status);
      if (status === "posted" || status === "draft") {
        cogs += cogsByEntry.get(s.accounting_entry_id) ?? 0;
      }
    }
    const cogsStatus: GrossProfitRow["cogs_status"] =
      cogsStatuses.size === 0 ? "missing" :
      cogsStatuses.size === 1
        ? (cogsStatuses.has("posted") ? "posted" : cogsStatuses.has("draft") ? "drafted" : "missing")
        : "partial";
    const gp = revenue - cogs;
    const margin = revenue > 0 ? (gp / revenue) * 100 : 0;
    const revStatus: GrossProfitRow["revenue_status"] =
      inv.accounting_status === "posted" ? "posted" :
      inv.accounting_status === "drafted" ? "drafted" :
                                            "missing";
    return {
      invoice_id: inv.id, invoice_no: inv.inv_no,
      customer_id: inv.customer_id,
      customer_name: inv.customer_id ? custMap.get(inv.customer_id) ?? null : null,
      currency: inv.currency || "USD",
      revenue, cogs, gross_profit: gp, margin_pct: margin,
      revenue_status: revStatus, cogs_status: cogsStatus,
      shipment_nos: shipNos,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.revenue += r.revenue;
      acc.cogs    += r.cogs;
      acc.gross_profit += r.gross_profit;
      return acc;
    },
    { revenue: 0, cogs: 0, gross_profit: 0, margin_pct: 0 },
  );
  totals.margin_pct = totals.revenue > 0 ? (totals.gross_profit / totals.revenue) * 100 : 0;

  return {
    as_of: today, from: opts.from ?? null, to: opts.to ?? null,
    rows: rows.sort((a, b) => b.revenue - a.revenue),
    totals,
  };
}

/* ─── Cash flow summary (simple direct-method totals) ────────── */

export interface CashFlowSummary {
  from: string;
  to: string;
  cash_in: number;
  cash_out: number;
  net_change: number;
  /** Per-direction count of source rows for the UI. */
  counts: { in: number; out: number };
}

export async function buildCashFlowSummary(opts: {
  tenantId: string;
  from: string;
  to: string;
}): Promise<CashFlowSummary> {
  const { data: payments } = await supabaseServer
    .from("finance_payments")
    .select("direction, amount, status, payment_date")
    .eq("tenant_id", opts.tenantId)
    .gte("payment_date", opts.from)
    .lte("payment_date", opts.to)
    .eq("status", "completed");
  let cIn = 0, cOut = 0, nIn = 0, nOut = 0;
  for (const p of ((payments ?? []) as Array<{ direction: "in" | "out"; amount: number }>)) {
    const amt = Number(p.amount) || 0;
    if (p.direction === "in") { cIn += amt; nIn += 1; }
    else                       { cOut += amt; nOut += 1; }
  }
  return {
    from: opts.from, to: opts.to,
    cash_in: cIn, cash_out: cOut,
    net_change: cIn - cOut,
    counts: { in: nIn, out: nOut },
  };
}
