import "server-only";

/* ===========================================================================
   Operational alerts + bottleneck detector.

   Pure aggregator that reads existing transactional tables and turns
   them into a small set of actionable signals. No new tables, no ML,
   no predictions — just clear "you should do X today" flags.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

export type AlertSeverity = "info" | "watch" | "risk";
export type AlertCategory =
  | "stock_low" | "ar_overdue" | "ap_overdue" | "approval_pending"
  | "fx_missing" | "shipment_delayed" | "bottleneck";

export interface OpsAlert {
  key: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  detail: string;
  count?: number;
  amount?: number;
  currency?: string | null;
  href: string;
  action_label?: string;
}

export interface OpsToday {
  shipments_today: number;
  receipts_today: number;
  invoices_pending: number;
  bills_pending: number;
  approvals_pending: number;
  low_stock: number;
}

export interface OpsHealth {
  inventory: AlertSeverity;    // health of inventory levels
  ar:        AlertSeverity;    // AR aging health
  ap:        AlertSeverity;    // AP aging health
  workflow:  AlertSeverity;    // bottleneck severity
}

export interface OpsBottleneck {
  key: string;
  label: string;
  count: number;
  severity: AlertSeverity;
  href: string;
  detail: string;
}

export interface OpsSnapshot {
  base_currency: string;
  alerts: OpsAlert[];
  today: OpsToday;
  health: OpsHealth;
  bottlenecks: OpsBottleneck[];
}

/* ─── Helpers ──────────────────────────────────────────────── */

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function isoNDaysAgo(n: number): string {
  const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
}
function severityFromCount(count: number, watchThreshold: number, riskThreshold: number): AlertSeverity {
  if (count >= riskThreshold)  return "risk";
  if (count >= watchThreshold) return "watch";
  return "info";
}

/* ─── Snapshot builder ────────────────────────────────────── */

export async function buildOpsSnapshot(tenantId: string): Promise<OpsSnapshot> {
  const today = todayIso();

  const tenantRes = await supabaseServer.from("tenants")
    .select("default_currency").eq("id", tenantId).maybeSingle();
  const baseCurrency = ((tenantRes.data as { default_currency: string | null } | null)?.default_currency) ?? "CNY";

  const [
    /* Counts for the daily ops dashboard. */
    shipsTodayRes, recsTodayRes,
    pendingInvRes, pendingBillRes,
    pendingApprovalsRes,
    /* Low-stock items + their reorder data. */
    valRes, itemsRes,
    /* AR/AP overdue. */
    invsRes, billsRes,
    /* Bottleneck queries. */
    draftInvoicesRes, shipsWithoutInvRes, recsWithoutBillRes,
    /* FX rate availability. */
    fxRatesRes,
  ] = await Promise.all([
    supabaseServer.from("sales_shipments").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gte("shipment_date", today),
    supabaseServer.from("purchase_receipts").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gte("receipt_date", today),
    supabaseServer.from("invoices").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gt("balance", 0).is("cancelled_at", null),
    supabaseServer.from("vendor_bills").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gt("balance", 0),
    supabaseServer.from("finance_expenses").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).in("approval_status", ["draft", "submitted", "pending"]),
    supabaseServer.from("inventory_valuation")
      .select("inventory_item_id, qty_on_hand").eq("tenant_id", tenantId),
    supabaseServer.from("inventory_items")
      .select("id, item_code, item_name, reorder_point").eq("tenant_id", tenantId).is("deleted_at", null),
    supabaseServer.from("invoices")
      .select("id, inv_no, due_date, balance, currency, customer_id").eq("tenant_id", tenantId)
      .gt("balance", 0).is("cancelled_at", null).not("due_date", "is", null),
    supabaseServer.from("vendor_bills")
      .select("id, bill_no, due_date, balance, currency, supplier_id").eq("tenant_id", tenantId)
      .gt("balance", 0).not("due_date", "is", null),
    supabaseServer.from("invoices").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "draft"),
    supabaseServer.from("sales_shipments").select("id, shipment_no, sales_order_id, shipment_date")
      .eq("tenant_id", tenantId).eq("status", "shipped")
      .lte("shipment_date", isoNDaysAgo(7)),
    supabaseServer.from("purchase_receipts").select("id, receipt_no, po_id, receipt_date")
      .eq("tenant_id", tenantId).eq("status", "received")
      .lte("receipt_date", isoNDaysAgo(7)),
    supabaseServer.from("finance_fx_rates").select("from_currency, to_currency")
      .eq("tenant_id", tenantId),
  ]);

  /* ─── Low stock ─── */
  const qtyByItem = new Map<string, number>();
  for (const v of (valRes.data ?? []) as Array<{ inventory_item_id: string; qty_on_hand: number }>) {
    qtyByItem.set(v.inventory_item_id, (qtyByItem.get(v.inventory_item_id) ?? 0) + Number(v.qty_on_hand || 0));
  }
  type Item = { id: string; item_code: string; item_name: string; reorder_point: number | null };
  const lowStockItems: Array<{ id: string; label: string; qty: number; reorder: number }> = [];
  for (const it of ((itemsRes.data ?? []) as Item[])) {
    const qty = qtyByItem.get(it.id) ?? 0;
    const reorder = Number(it.reorder_point) || 0;
    if (reorder > 0 && qty <= reorder) {
      lowStockItems.push({
        id: it.id, label: it.item_name ?? it.item_code, qty, reorder,
      });
    }
  }

  /* ─── AR / AP overdue ─── */
  type Inv  = { id: string; inv_no: string | null; due_date: string; balance: number; currency: string; customer_id: string | null };
  type Bill = { id: string; bill_no: string | null; due_date: string; balance: number; currency: string; supplier_id: string };
  const overdueAr  = ((invsRes.data  ?? []) as Inv[]).filter((i) => i.due_date < today);
  const overdueAp  = ((billsRes.data ?? []) as Bill[]).filter((b) => b.due_date < today);
  const overdueArAmt = overdueAr.reduce((s, i) => s + Number(i.balance || 0), 0);
  const overdueApAmt = overdueAp.reduce((s, b) => s + Number(b.balance || 0), 0);

  /* ─── Bottlenecks ─── */
  const shipsWithoutInv = (shipsWithoutInvRes.data ?? []) as Array<{ id: string; shipment_no: string; sales_order_id: string; shipment_date: string }>;
  const soIds = Array.from(new Set(shipsWithoutInv.map((s) => s.sales_order_id)));
  const invSoMap = new Set<string>();
  if (soIds.length > 0) {
    const inv = await supabaseServer.from("invoices")
      .select("sales_order_id").eq("tenant_id", tenantId).in("sales_order_id", soIds);
    for (const i of (inv.data ?? []) as Array<{ sales_order_id: string }>) invSoMap.add(i.sales_order_id);
  }
  const shipsAwaitingInvoice = shipsWithoutInv.filter((s) => !invSoMap.has(s.sales_order_id));

  const recsWithoutBill = (recsWithoutBillRes.data ?? []) as Array<{ id: string; receipt_no: string; po_id: string; receipt_date: string }>;
  const poIds = Array.from(new Set(recsWithoutBill.map((r) => r.po_id)));
  const billPoMap = new Set<string>();
  if (poIds.length > 0) {
    const b = await supabaseServer.from("vendor_bills")
      .select("po_id").eq("tenant_id", tenantId).in("po_id", poIds);
    for (const r of (b.data ?? []) as Array<{ po_id: string }>) billPoMap.add(r.po_id);
  }
  const recsAwaitingBill = recsWithoutBill.filter((r) => !billPoMap.has(r.po_id));

  /* Stale stock (no movement in 180 days for items with qty > 0). */
  const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - 180);
  const movesRes = await supabaseServer.from("inventory_stock_movements")
    .select("inventory_item_id, movement_date").eq("tenant_id", tenantId)
    .gte("movement_date", cutoff.toISOString().slice(0, 10));
  const recentMoveItems = new Set<string>();
  for (const m of (movesRes.data ?? []) as Array<{ inventory_item_id: string; movement_date: string }>) {
    recentMoveItems.add(m.inventory_item_id);
  }
  let staleStockCount = 0;
  for (const [itemId, qty] of qtyByItem.entries()) {
    if (qty > 0 && !recentMoveItems.has(itemId)) staleStockCount += 1;
  }

  /* ─── FX rate missing check ─── */
  /* If any non-base currency has invoice/bill open balances but no
     rate row, flag it. */
  const usedCurrencies = new Set<string>();
  for (const i of ((invsRes.data ?? []) as Inv[])) if (i.currency && i.currency !== baseCurrency) usedCurrencies.add(i.currency);
  for (const b of ((billsRes.data ?? []) as Bill[])) if (b.currency && b.currency !== baseCurrency) usedCurrencies.add(b.currency);
  const ratePairs = new Set<string>();
  for (const r of (fxRatesRes.data ?? []) as Array<{ from_currency: string; to_currency: string }>) {
    ratePairs.add(`${r.from_currency}→${r.to_currency}`);
  }
  const missingFx = Array.from(usedCurrencies).filter((c) => !ratePairs.has(`${c}→${baseCurrency}`));

  /* ─── Build alerts ─── */
  const alerts: OpsAlert[] = [];
  if (lowStockItems.length > 0) {
    alerts.push({
      key: "stock_low", category: "stock_low",
      severity: severityFromCount(lowStockItems.length, 1, 5),
      title: "Inventory low",
      detail: `${lowStockItems.length} item${lowStockItems.length === 1 ? "" : "s"} at or below reorder point.`,
      count: lowStockItems.length,
      href: "/inventory?filter=low-stock",
      action_label: "Create PO",
    });
  }
  if (overdueAr.length > 0) {
    alerts.push({
      key: "ar_overdue", category: "ar_overdue", severity: "risk",
      title: "Receivables overdue",
      detail: `${overdueAr.length} invoice${overdueAr.length === 1 ? "" : "s"} past due — follow up.`,
      count: overdueAr.length, amount: overdueArAmt, currency: baseCurrency,
      href: "/finance/statements?tab=ar", action_label: "Open AR aging",
    });
  }
  if (overdueAp.length > 0) {
    alerts.push({
      key: "ap_overdue", category: "ap_overdue", severity: "watch",
      title: "Payables overdue",
      detail: `${overdueAp.length} bill${overdueAp.length === 1 ? "" : "s"} past due — schedule payment.`,
      count: overdueAp.length, amount: overdueApAmt, currency: baseCurrency,
      href: "/finance/statements?tab=ap", action_label: "Open AP aging",
    });
  }
  if ((pendingApprovalsRes.count ?? 0) > 0) {
    alerts.push({
      key: "approvals_pending", category: "approval_pending",
      severity: severityFromCount(pendingApprovalsRes.count ?? 0, 1, 10),
      title: "Pending approvals",
      detail: `${pendingApprovalsRes.count} expense${(pendingApprovalsRes.count ?? 0) === 1 ? "" : "s"} await review.`,
      count: pendingApprovalsRes.count ?? 0,
      href: "/finance/approvals", action_label: "Review",
    });
  }
  if (missingFx.length > 0) {
    alerts.push({
      key: "fx_missing", category: "fx_missing", severity: "watch",
      title: "FX rate missing",
      detail: `No rate set for ${missingFx.join(", ")} → ${baseCurrency}.`,
      count: missingFx.length, href: "/finance/setup?card=fx-rates",
      action_label: "Add FX rate",
    });
  }
  if (shipsAwaitingInvoice.length > 0) {
    alerts.push({
      key: "ship_no_invoice", category: "shipment_delayed",
      severity: severityFromCount(shipsAwaitingInvoice.length, 1, 5),
      title: "Shipments awaiting invoice",
      detail: `${shipsAwaitingInvoice.length} shipped order${shipsAwaitingInvoice.length === 1 ? "" : "s"} not invoiced after 7 days.`,
      count: shipsAwaitingInvoice.length, href: "/invoices",
      action_label: "Create invoices",
    });
  }

  /* ─── Bottlenecks ─── */
  const bottlenecks: OpsBottleneck[] = [];
  if ((draftInvoicesRes.count ?? 0) > 0) {
    bottlenecks.push({
      key: "draft_invoices", label: "Draft invoices",
      count: draftInvoicesRes.count ?? 0,
      severity: severityFromCount(draftInvoicesRes.count ?? 0, 1, 10),
      href: "/invoices?status=draft", detail: "Drafts holding up revenue posting.",
    });
  }
  if (shipsAwaitingInvoice.length > 0) {
    bottlenecks.push({
      key: "ship_no_invoice", label: "Shipped, not invoiced",
      count: shipsAwaitingInvoice.length,
      severity: severityFromCount(shipsAwaitingInvoice.length, 1, 5),
      href: "/sales/orders", detail: "Revenue + AR pending on these.",
    });
  }
  if (recsAwaitingBill.length > 0) {
    bottlenecks.push({
      key: "rec_no_bill", label: "Received, no bill",
      count: recsAwaitingBill.length,
      severity: severityFromCount(recsAwaitingBill.length, 1, 5),
      href: "/purchase", detail: "AP cannot post until bills are entered.",
    });
  }
  if (staleStockCount > 0) {
    bottlenecks.push({
      key: "stale_stock", label: "Stale inventory",
      count: staleStockCount,
      severity: severityFromCount(staleStockCount, 1, 10),
      href: "/inventory", detail: "Items with stock but no movement in 180 days.",
    });
  }

  /* ─── Health ─── */
  const health: OpsHealth = {
    inventory: lowStockItems.length >= 5 ? "risk" : lowStockItems.length > 0 ? "watch" : "info",
    ar:        overdueAr.length >= 5 ? "risk" : overdueAr.length > 0 ? "watch" : "info",
    ap:        overdueAp.length >= 5 ? "risk" : overdueAp.length > 0 ? "watch" : "info",
    workflow:  bottlenecks.some((b) => b.severity === "risk") ? "risk"
              : bottlenecks.length > 0 ? "watch" : "info",
  };

  return {
    base_currency: baseCurrency,
    alerts,
    today: {
      shipments_today: shipsTodayRes.count ?? 0,
      receipts_today:  recsTodayRes.count ?? 0,
      invoices_pending: pendingInvRes.count ?? 0,
      bills_pending:    pendingBillRes.count ?? 0,
      approvals_pending: pendingApprovalsRes.count ?? 0,
      low_stock: lowStockItems.length,
    },
    health,
    bottlenecks,
  };
}
