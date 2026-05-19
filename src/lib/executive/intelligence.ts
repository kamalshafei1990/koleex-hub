import "server-only";

/* ===========================================================================
   Executive Intelligence — read-only KPI snapshot for the board view.

   Pure aggregation on top of existing data sources. We do NOT introduce
   new accounting engines, forecasting, ML, or warehouses. Everything
   below comes from posted journals (statements / aging), inventory
   valuation, bank balances, and the last-90-day operational windows.

   Exports:
     · buildExecutiveSnapshot   — single-call dashboard payload
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import {
  buildProfitLoss, buildCashFlow,
  type Period, type ProfitLoss,
} from "@/lib/accounting/statements";
import { buildArAging, buildApAging, buildInventoryValuationSummary } from "@/lib/accounting/aging";
import { resolveBaseCurrency, convertToBase } from "@/lib/finance/currency";

/* ─── Public types ─────────────────────────────────────────────── */

export interface ExecKpi {
  label: string;
  value: number;
  hint?: string;
  tone: "neutral" | "positive" | "warning" | "info";
  /** Suggested drill-down route. */
  href: string;
}

export interface ExecMonthlyPoint {
  month: string;          // 'YYYY-MM'
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expense: number;
  net_profit: number;
}

export interface ExecTopRow {
  id: string | null;
  label: string;
  amount: number;
  /** Optional drill-down hint (route or null). */
  href?: string;
}

export interface ExecFxExposure {
  base_currency: string;
  exposed: Array<{ currency: string; receivable: number; payable: number; net_base: number }>;
  total_net_base_abs: number;
}

export interface ExecutiveSnapshot {
  base_currency: string;
  period: Period;                     // current YTD-ish window
  kpis: {
    revenue:        ExecKpi;
    gross_profit:   ExecKpi;
    net_profit:     ExecKpi;
    cash_position:  ExecKpi;
    inventory:      ExecKpi;
    receivables:    ExecKpi;
    payables:       ExecKpi;
    fx_exposure:    ExecKpi;
  };
  monthly:    ExecMonthlyPoint[];    // last 12 months
  top_markets:   ExecTopRow[];       // sales by customer country
  top_customers: ExecTopRow[];
  top_products:  ExecTopRow[];
  inventory_intel: {
    highest_value: ExecTopRow[];     // top 5 SKUs by value
    slow_moving:   ExecTopRow[];     // qty>0 with no movement in 90 days
    low_stock:     ExecTopRow[];     // qty below reorder_point (or qty=0)
    dead_stock:    ExecTopRow[];     // qty>0 with no movement in 180 days
  };
  fx: ExecFxExposure;
}

/* ─── Period helpers ───────────────────────────────────────────── */

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function isoNDaysAgo(n: number): string {
  const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
}
function monthOf(iso: string): string { return iso.slice(0, 7); }
function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i -= 1) {
    const dd = new Date(d);
    dd.setUTCMonth(dd.getUTCMonth() - i);
    out.push(dd.toISOString().slice(0, 7));
  }
  return out;
}

/* ─── Cash position from bank accounts (fallback to GL cash). ─── */

async function cashPositionBase(tenantId: string, baseCurrency: string): Promise<number> {
  const { data } = await supabaseServer
    .from("finance_bank_accounts")
    .select("currency, current_balance")
    .eq("tenant_id", tenantId);
  const rows = ((data ?? []) as Array<{ currency: string; current_balance: number }>);
  let sum = 0;
  for (const r of rows) {
    const c = r.currency || baseCurrency;
    if (c === baseCurrency) { sum += Number(r.current_balance) || 0; continue; }
    try {
      const conv = await convertToBase({ tenantId, amount: Number(r.current_balance) || 0, currency: c });
      sum += conv.base_amount;
    } catch { sum += Number(r.current_balance) || 0; }
  }
  return sum;
}

/* ─── Monthly P&L series (last 12 months). ────────────────────── */

async function monthlySeries(tenantId: string): Promise<ExecMonthlyPoint[]> {
  const months = lastNMonths(12);
  const out: ExecMonthlyPoint[] = [];
  for (const ym of months) {
    const from = `${ym}-01`;
    const [y, m] = ym.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const to = `${ym}-${String(lastDay).padStart(2, "0")}`;
    const pl: ProfitLoss = await buildProfitLoss(tenantId, { from, to });
    out.push({
      month: ym,
      revenue: pl.revenue.amount,
      cogs: pl.cost_of_sales.amount,
      gross_profit: pl.gross_profit,
      operating_expense: pl.operating_expenses.amount,
      net_profit: pl.net_profit,
    });
  }
  return out;
}

/* ─── Sales rollups (top markets / customers / products). ──────
   Use posted invoices in the last 365 days. Base-converted via the
   already-stored base_amount/base_currency snapshot. */

interface InvoiceRollupRow {
  id: string;
  customer_id: string | null;
  base_amount: number | null;
  total: number;
  base_currency: string | null;
}

async function salesRollups(tenantId: string, baseCurrency: string) {
  const since = isoNDaysAgo(365);
  const { data: invs } = await supabaseServer
    .from("invoices")
    .select("id, customer_id, total, base_amount, base_currency, status, cancelled_at, issued_at, issue_date")
    .eq("tenant_id", tenantId)
    .gte("issue_date", since);
  const rows = ((invs ?? []) as Array<{
    id: string; customer_id: string | null; total: number; base_amount: number | null;
    base_currency: string | null; status: string; cancelled_at: string | null;
  }>).filter((i) => !i.cancelled_at && i.status !== "cancelled" && i.status !== "void" && i.status !== "draft");

  /* Customer map + country. */
  const custIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[]));
  const custRes = custIds.length
    ? await supabaseServer.from("customers")
        .select("id, name, company_name, country").in("id", custIds)
    : { data: [] as Array<{ id: string; name: string; company_name: string | null; country: string | null }> };
  const custMap = new Map<string, { name: string; country: string | null }>();
  for (const c of (custRes.data ?? [])) {
    custMap.set(c.id, { name: c.company_name ?? c.name, country: c.country });
  }

  /* Per-invoice base amount. */
  const invoiceBase: Array<InvoiceRollupRow & { base: number }> = rows.map((r) => ({
    id: r.id, customer_id: r.customer_id,
    base_amount: r.base_amount, total: r.total, base_currency: r.base_currency,
    base: Number(r.base_amount) || Number(r.total) || 0,
  }));

  /* Top customers + top markets. */
  const customerTotals = new Map<string, number>();
  const countryTotals  = new Map<string, number>();
  for (const inv of invoiceBase) {
    const cid = inv.customer_id ?? "—";
    customerTotals.set(cid, (customerTotals.get(cid) ?? 0) + inv.base);
    const country = (inv.customer_id ? custMap.get(inv.customer_id)?.country : null) || "Unspecified";
    countryTotals.set(country, (countryTotals.get(country) ?? 0) + inv.base);
  }
  const top_customers: ExecTopRow[] = Array.from(customerTotals.entries())
    .map(([cid, amt]) => ({
      id: cid === "—" ? null : cid,
      label: cid === "—" ? "Unassigned" : (custMap.get(cid)?.name ?? cid.slice(0, 8)),
      amount: amt,
      href: cid === "—" ? "/customers" : `/customers/${cid}`,
    }))
    .sort((a, b) => b.amount - a.amount).slice(0, 8);
  const top_markets: ExecTopRow[] = Array.from(countryTotals.entries())
    .map(([country, amt]) => ({
      id: country, label: country, amount: amt, href: `/customers?country=${encodeURIComponent(country)}`,
    }))
    .sort((a, b) => b.amount - a.amount).slice(0, 8);

  /* Top products — uses invoice lines if present, else SO items.
     Cheap path: aggregate sales_order_items linked to invoiced SOs.
     Falls back gracefully when the line tables are empty. */
  const invIds = invoiceBase.map((i) => i.id);
  let top_products: ExecTopRow[] = [];
  if (invIds.length > 0) {
    const { data: lines } = await supabaseServer
      .from("invoice_items")
      .select("invoice_id, description, line_total, product_id")
      .in("invoice_id", invIds);
    type LineRow = {
      invoice_id: string; description: string | null; line_total: number;
      inventory_item_id: string | null; product_id: string | null;
    };
    const productTotals = new Map<string, { label: string; amount: number; itemId: string | null }>();
    for (const l of (lines ?? []) as LineRow[]) {
      const key = l.inventory_item_id ?? l.product_id ?? (l.description ?? "Unspecified");
      const cur = productTotals.get(key) ?? { label: l.description ?? "Item", amount: 0, itemId: l.inventory_item_id };
      cur.amount += Number(l.line_total) || 0;
      if (l.description && !cur.label) cur.label = l.description;
      productTotals.set(key, cur);
    }
    /* Enrich inventory_item names. */
    const itemIds = Array.from(new Set(
      Array.from(productTotals.values()).map((p) => p.itemId).filter(Boolean) as string[]
    ));
    if (itemIds.length > 0) {
      const itemsRes = await supabaseServer
        .from("inventory_items").select("id, item_name, item_code").in("id", itemIds);
      const nameMap = new Map<string, string>();
      for (const it of (itemsRes.data ?? []) as Array<{ id: string; item_name: string; item_code: string }>) {
        nameMap.set(it.id, it.item_name ?? it.item_code);
      }
      for (const p of productTotals.values()) {
        if (p.itemId && nameMap.has(p.itemId)) p.label = nameMap.get(p.itemId)!;
      }
    }
    top_products = Array.from(productTotals.entries())
      .map(([key, p]) => ({
        id: p.itemId ?? key, label: p.label, amount: p.amount,
        href: p.itemId ? `/inventory/items/${p.itemId}` : "/inventory",
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }

  return { top_customers, top_markets, top_products };
}

/* ─── Inventory intelligence. ────────────────────────────────── */

async function inventoryIntel(tenantId: string) {
  const [valRes, itemsRes, movesRes] = await Promise.all([
    supabaseServer.from("inventory_valuation").select("inventory_item_id, qty_on_hand, inventory_value")
      .eq("tenant_id", tenantId),
    supabaseServer.from("inventory_items")
      .select("id, item_code, item_name, reorder_point, status").eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabaseServer.from("inventory_stock_movements")
      .select("inventory_item_id, movement_date").eq("tenant_id", tenantId)
      .gte("movement_date", new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10)),
  ]);

  type Val  = { inventory_item_id: string; qty_on_hand: number; inventory_value: number };
  type Item = { id: string; item_code: string; item_name: string; reorder_point: number | null; status: string };
  type Move = { inventory_item_id: string; movement_date: string };

  const vals  = ((valRes.data  ?? []) as Val[]);
  const items = ((itemsRes.data ?? []) as Item[]);
  const moves = ((movesRes.data ?? []) as Move[]);

  /* Per-item aggregates. */
  const qtyByItem = new Map<string, number>();
  const valByItem = new Map<string, number>();
  for (const v of vals) {
    qtyByItem.set(v.inventory_item_id, (qtyByItem.get(v.inventory_item_id) ?? 0) + Number(v.qty_on_hand || 0));
    valByItem.set(v.inventory_item_id, (valByItem.get(v.inventory_item_id) ?? 0) + Number(v.inventory_value || 0));
  }
  const lastMove = new Map<string, number>();   // ms epoch
  for (const m of moves) {
    const t = new Date(m.movement_date).getTime();
    const prev = lastMove.get(m.inventory_item_id) ?? 0;
    if (t > prev) lastMove.set(m.inventory_item_id, t);
  }
  const now = Date.now();

  const itemMap = new Map<string, Item>();
  for (const it of items) itemMap.set(it.id, it);

  function nameOf(id: string): string {
    const it = itemMap.get(id);
    return it ? (it.item_name ?? it.item_code ?? id.slice(0, 8)) : id.slice(0, 8);
  }

  const highest_value: ExecTopRow[] = Array.from(valByItem.entries())
    .map(([id, amount]) => ({ id, label: nameOf(id), amount, href: `/inventory/items/${id}` }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount).slice(0, 5);

  const slow_moving: ExecTopRow[] = Array.from(qtyByItem.entries())
    .filter(([id, qty]) => qty > 0 && (now - (lastMove.get(id) ?? 0)) > 90 * 86_400_000)
    .map(([id]) => ({ id, label: nameOf(id), amount: valByItem.get(id) ?? 0, href: `/inventory/items/${id}` }))
    .sort((a, b) => b.amount - a.amount).slice(0, 5);

  const dead_stock: ExecTopRow[] = Array.from(qtyByItem.entries())
    .filter(([id, qty]) => qty > 0 && (now - (lastMove.get(id) ?? 0)) > 180 * 86_400_000)
    .map(([id]) => ({ id, label: nameOf(id), amount: valByItem.get(id) ?? 0, href: `/inventory/items/${id}` }))
    .sort((a, b) => b.amount - a.amount).slice(0, 5);

  const low_stock: ExecTopRow[] = items
    .filter((it) => {
      const qty = qtyByItem.get(it.id) ?? 0;
      const reorder = Number(it.reorder_point) || 0;
      return qty <= 0 || (reorder > 0 && qty <= reorder);
    })
    .slice(0, 50)
    .map((it) => ({
      id: it.id, label: it.item_name ?? it.item_code,
      amount: qtyByItem.get(it.id) ?? 0,
      href: `/inventory/items/${it.id}`,
    }))
    .sort((a, b) => a.amount - b.amount).slice(0, 5);

  return { highest_value, slow_moving, low_stock, dead_stock };
}

/* ─── FX exposure. ───────────────────────────────────────────── */

async function fxExposure(tenantId: string, baseCurrency: string): Promise<ExecFxExposure> {
  const [invRes, billRes] = await Promise.all([
    supabaseServer.from("invoices")
      .select("currency, base_amount, balance, total, amount_paid, status, cancelled_at")
      .eq("tenant_id", tenantId),
    supabaseServer.from("vendor_bills")
      .select("currency, base_amount, balance, total, amount_paid, status").eq("tenant_id", tenantId),
  ]);
  type Inv = { currency: string; base_amount: number | null; balance: number; total: number;
               amount_paid: number; status: string; cancelled_at: string | null };
  type Bill = { currency: string; base_amount: number | null; balance: number; total: number;
                amount_paid: number; status: string };
  const invs  = ((invRes.data  ?? []) as Inv[])
    .filter((i) => !i.cancelled_at && i.status !== "cancelled" && i.status !== "void" && i.status !== "draft");
  const bills = ((billRes.data ?? []) as Bill[])
    .filter((b) => b.status !== "cancelled" && b.status !== "draft");

  const byCur = new Map<string, { receivable: number; payable: number; ratio: number }>();
  for (const i of invs) {
    if (!i.currency || i.currency === baseCurrency) continue;
    const open = Number(i.balance) > 0 ? Number(i.balance) : Number(i.total) - Number(i.amount_paid);
    if (open <= 0.0001) continue;
    const ratio = i.base_amount && i.total ? Number(i.base_amount) / Number(i.total) : 1;
    const cur = byCur.get(i.currency) ?? { receivable: 0, payable: 0, ratio };
    cur.receivable += open;
    cur.ratio = ratio || cur.ratio;
    byCur.set(i.currency, cur);
  }
  for (const b of bills) {
    if (!b.currency || b.currency === baseCurrency) continue;
    const open = Number(b.balance) > 0 ? Number(b.balance) : Number(b.total) - Number(b.amount_paid);
    if (open <= 0.0001) continue;
    const ratio = b.base_amount && b.total ? Number(b.base_amount) / Number(b.total) : 1;
    const cur = byCur.get(b.currency) ?? { receivable: 0, payable: 0, ratio };
    cur.payable += open;
    cur.ratio = ratio || cur.ratio;
    byCur.set(b.currency, cur);
  }

  const exposed = Array.from(byCur.entries())
    .map(([currency, v]) => {
      const net = v.receivable - v.payable;
      return { currency, receivable: v.receivable, payable: v.payable, net_base: net * v.ratio };
    })
    .sort((a, b) => Math.abs(b.net_base) - Math.abs(a.net_base));
  const total_net_base_abs = exposed.reduce((s, e) => s + Math.abs(e.net_base), 0);
  return { base_currency: baseCurrency, exposed, total_net_base_abs };
}

/* ─── Main snapshot. ─────────────────────────────────────────── */

export async function buildExecutiveSnapshot(tenantId: string): Promise<ExecutiveSnapshot> {
  const baseCurrency = await resolveBaseCurrency(tenantId);
  /* YTD period for headline P&L. */
  const year = new Date().getUTCFullYear();
  const period: Period = { from: `${year}-01-01`, to: todayIso() };

  const [pl, cf, ar, ap, invVal, monthly, sales, intel, fx, cash] = await Promise.all([
    buildProfitLoss(tenantId, period, { currency: baseCurrency }),
    buildCashFlow(tenantId, period).catch(() => null),
    buildArAging(tenantId),
    buildApAging(tenantId),
    buildInventoryValuationSummary(tenantId),
    monthlySeries(tenantId),
    salesRollups(tenantId, baseCurrency),
    inventoryIntel(tenantId),
    fxExposure(tenantId, baseCurrency),
    cashPositionBase(tenantId, baseCurrency),
  ]);

  void cf;   // closing_cash already reflected in cashPositionBase

  const kpis: ExecutiveSnapshot["kpis"] = {
    revenue: {
      label: "Revenue (YTD)", value: pl.revenue.amount,
      hint: "Posted sales revenue", tone: "positive",
      href: "/finance/statements?tab=pl",
    },
    gross_profit: {
      label: "Gross Profit", value: pl.gross_profit,
      hint: `${pl.gross_margin_pct.toFixed(1)}% margin`,
      tone: pl.gross_profit >= 0 ? "positive" : "warning",
      href: "/finance/statements?tab=gp",
    },
    net_profit: {
      label: "Net Profit", value: pl.net_profit,
      hint: `${pl.net_margin_pct.toFixed(1)}% margin`,
      tone: pl.net_profit >= 0 ? "positive" : "warning",
      href: "/finance/statements?tab=pl",
    },
    cash_position: {
      label: "Cash Position", value: cash,
      hint: "All bank accounts (base)", tone: "info",
      href: "/finance/bank-accounts",
    },
    inventory: {
      label: "Inventory Value", value: invVal.totals.total_value,
      hint: `${invVal.rows.length} SKU rows`, tone: "neutral",
      href: "/finance/statements?tab=inventory",
    },
    receivables: {
      label: "Money to Collect (AR)", value: ar.totals.total_open,
      hint: ar.totals.total_overdue > 0 ? `${ar.totals.total_overdue.toFixed(0)} overdue` : "current",
      tone: ar.totals.total_overdue > 0 ? "warning" : "info",
      href: "/finance/statements?tab=ar",
    },
    payables: {
      label: "Money to Pay (AP)", value: ap.totals.total_open,
      hint: ap.totals.total_overdue > 0 ? `${ap.totals.total_overdue.toFixed(0)} overdue` : "current",
      tone: ap.totals.total_overdue > 0 ? "warning" : "info",
      href: "/finance/statements?tab=ap",
    },
    fx_exposure: {
      label: "Currency Exposure", value: fx.total_net_base_abs,
      hint: `${fx.exposed.length} non-base currencies`, tone: fx.total_net_base_abs > 0 ? "warning" : "neutral",
      href: "/finance/fx-rates",
    },
  };

  void monthOf;
  return {
    base_currency: baseCurrency,
    period,
    kpis,
    monthly,
    top_markets: sales.top_markets,
    top_customers: sales.top_customers,
    top_products: sales.top_products,
    inventory_intel: intel,
    fx,
  };
}
