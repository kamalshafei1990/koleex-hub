#!/usr/bin/env tsx

/* ===========================================================================
   Phase A.6 — Financial Statements automation validator.

   The point of this suite is the SHAPE contracts and the *identities*
   that hold across statements once data exists. We seed a self-
   contained ledger inside a sandbox tenant and assert:

     01  P&L totals: revenue - cogs - opex = net_profit
     02  Balance Sheet: assets = liabilities + equity + CYE
     03  Cash Flow summary: in − out = net change
     04  AR aging totals = sum of party totals = sum of bucket totals
     05  AR aging puts an overdue invoice in 1-30
     06  AP aging shape mirrors AR aging (totals match)
     07  Inventory valuation total matches inventory_valuation row sum
     08  Gross profit totals.gross_profit = totals.revenue − totals.cogs
     09  Margin % = gp / revenue (within 0.05% rounding)
     10  Tenant isolation — A's report never references B
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import {
  buildArAging, buildApAging, buildInventoryValuationSummary,
  buildGrossProfit, buildCashFlowSummary,
} from "../src/lib/accounting/aging";
import {
  buildProfitLoss, buildCashFlow,
} from "../src/lib/accounting/statements";
import { buildBalanceSheetSummary } from "../src/lib/accounting/queries";
import { ensureDefaultWarehouse, createInventoryMovement, postInventoryMovement } from "../src/lib/inventory/posting";
import { createInventoryItem } from "../src/lib/inventory/items";
import { shipSalesOrder } from "../src/lib/sales/shipping";
import {
  postCustomerCollection,
  postSupplierPayment,
  draftRevenueRecognition,
  draftInventoryCogs,
  postDraftedEntry,
} from "../src/lib/accounting/posting";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[financial-statements] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000A6";
const TENANT_B = "00000000-0000-4000-a000-0000000000B6";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}
function near(a: number, b: number, tol = 0.01) { return Math.abs(a - b) < tol; }

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `phase-a6-${id.slice(-4)}`,
      name: `Phase-A6 Sandbox ${id.slice(-4)}`,
      is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("accounting_journal_lines").delete().eq("tenant_id", t);
    await supabase.from("accounting_journal_entries").delete().eq("tenant_id", t);
    await supabase.from("accounting_accounts").delete().eq("tenant_id", t);
    await supabase.from("finance_payments").delete().eq("tenant_id", t);
    const { data: invs } = await supabase.from("invoices").select("id").eq("tenant_id", t);
    const invIds = ((invs ?? []) as Array<{ id: string }>).map((i) => i.id);
    if (invIds.length > 0) {
      await supabase.from("invoice_items").delete().in("invoice_id", invIds);
      await supabase.from("invoices").delete().in("id", invIds);
    }
    await supabase.from("sales_shipment_items").delete().eq("tenant_id", t);
    await supabase.from("sales_shipments").delete().eq("tenant_id", t);
    const { data: sos } = await supabase.from("sales_orders").select("id").eq("tenant_id", t);
    const soIds = ((sos ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (soIds.length > 0) {
      await supabase.from("sales_order_items").delete().in("sales_order_id", soIds);
      await supabase.from("sales_orders").delete().in("id", soIds);
    }
    await supabase.from("vendor_bills").delete().eq("tenant_id", t);
    await supabase.from("inventory_valuation").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_balances").delete().eq("tenant_id", t);
    await supabase.from("inventory_stock_movements").delete().eq("tenant_id", t);
    await supabase.from("inventory_items").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_code_sequences").delete().eq("tenant_id", t);
    await supabase.from("inventory_item_types").delete().eq("tenant_id", t);
    await supabase.from("inventory_warehouses").delete().eq("tenant_id", t);
  }
}

async function ensureCustomer(tenantId: string): Promise<string> {
  const tag = `Phase-A6 ${tenantId.slice(-4)}`;
  const { data: existing } = await supabase.from("customers").select("id").eq("tenant_id", tenantId).eq("name", tag).limit(1);
  if (existing && existing.length > 0) return (existing[0] as { id: string }).id;
  const { data, error } = await supabase.from("customers").insert({ tenant_id: tenantId, name: tag }).select("id").single();
  if (error || !data) throw new Error(`customer seed: ${error?.message}`);
  return (data as { id: string }).id;
}

async function ensureSupplier(tenantId: string): Promise<string> {
  const { data: existing } = await supabase.from("contacts").select("id")
    .eq("tenant_id", tenantId).not("supplier_type", "is", null).limit(1);
  if (existing && existing.length > 0) return (existing[0] as { id: string }).id;
  const { data, error } = await supabase.from("contacts").insert({
    tenant_id: tenantId, entity_type: "company",
    display_name: `A6 Supplier ${tenantId.slice(-4)}`,
    company_name: `A6 Supplier ${tenantId.slice(-4)}`, supplier_type: "vendor",
  }).select("id").single();
  if (error || !data) throw new Error(`supplier seed: ${error?.message}`);
  return (data as { id: string }).id;
}

async function main() {
  console.log("─".repeat(72));
  console.log("Phase A.6 — Financial Statements validator");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();

  const customerA = await ensureCustomer(TENANT_A);
  const supplierA = await ensureSupplier(TENANT_A);

  /* Seed an item with valued stock: 50 @ $4 = $200 value. */
  const whA = await ensureDefaultWarehouse(TENANT_A);
  const item = await createInventoryItem({
    tenant_id: TENANT_A, item_name: "A6 Test Item", type_key: "finished_product",
  });
  const itemId = item.item!.id;
  const opening = await createInventoryMovement({
    tenant_id: TENANT_A, inventory_item_id: itemId, warehouse_id: whA,
    movement_type: "opening_balance", quantity: 50, unit_cost: 4, currency: "USD",
  });
  await postInventoryMovement(opening.movement!.id, TENANT_A, null);

  /* SO + ship 30 units → COGS = 30 × 4 = $120. */
  const { data: so } = await supabase.from("sales_orders").insert({
    tenant_id: TENANT_A, so_no: `SO-A6-${Date.now().toString(16).slice(-4)}`,
    customer_id: customerA, status: "confirmed", currency: "USD",
  }).select("id").single();
  const soId = (so as { id: string }).id;
  const { data: soi } = await supabase.from("sales_order_items").insert({
    sales_order_id: soId, inventory_item_id: itemId, qty: 30, qty_shipped: 0,
    unit_price: 10, total: 300, description: "A6 test line",
  }).select("id").single();
  const soiId = (soi as { id: string }).id;
  const shipR = await shipSalesOrder({
    soId, tenantId: TENANT_A, shippedBy: null,
    request: { source_location_id: whA, lines: [{ sales_order_item_id: soiId, qty: 30 }] },
  });

  /* COGS journal: post (= $120 expense). */
  const cogsDraft = await draftInventoryCogs(
    { tenantId: TENANT_A, postedByAccountId: null }, shipR.shipment_id!,
  );
  await postDraftedEntry({ tenantId: TENANT_A, postedByAccountId: null }, cogsDraft.ok ? cogsDraft.entry_id : "");

  /* Invoice $500, due 5 days ago to land in 1-30 bucket. */
  const dueDate = new Date(); dueDate.setDate(dueDate.getDate() - 5);
  const { data: inv } = await supabase.from("invoices").insert({
    tenant_id: TENANT_A, inv_no: `INV-A6-${Date.now().toString(16).slice(-4)}`,
    customer_id: customerA, status: "issued", currency: "USD",
    issue_date: dueDate.toISOString().slice(0, 10),
    due_date: dueDate.toISOString().slice(0, 10),
    sales_order_id: soId,
    subtotal: 500, tax_rate: 0, tax_total: 0,
    discount_percent: 0, discount_total: 0,
    total: 500, amount_paid: 0, balance: 500, doc: {},
  }).select("id").single();
  const invoiceId = (inv as { id: string }).id;

  /* Revenue journal: post (= $500 revenue). */
  const revDraft = await draftRevenueRecognition(
    { tenantId: TENANT_A, postedByAccountId: null }, invoiceId,
  );
  await postDraftedEntry({ tenantId: TENANT_A, postedByAccountId: null }, revDraft.ok ? revDraft.entry_id : "");

  /* Seed a finished bank account so payment flow has somewhere to land. */
  const { data: bankAcct } = await supabase.from("finance_bank_accounts").insert({
    tenant_id: TENANT_A, label: "A6 Bank", currency: "USD", balance: 0, opening_balance: 0,
    bank_name: "A6 Bank", account_no: "1234", status: "active",
  }).select("id").maybeSingle();
  void bankAcct; /* not directly needed */

  /* Customer payment $200 → cash IN. */
  const { data: payIn } = await supabase.from("finance_payments").insert({
    tenant_id: TENANT_A, direction: "in", party_type: "customer",
    party_name: "A6 Cust", amount: 200, currency: "USD",
    payment_date: new Date().toISOString().slice(0, 10),
    status: "completed", reconciliation_status: "unreconciled", approval_status: "approved",
  }).select("id").single();
  await postCustomerCollection({ tenantId: TENANT_A, postedByAccountId: null }, (payIn as { id: string }).id);

  /* Supplier payment $50 → cash OUT. */
  const { data: payOut } = await supabase.from("finance_payments").insert({
    tenant_id: TENANT_A, direction: "out", party_type: "supplier",
    party_name: "A6 Supplier", amount: 50, currency: "USD",
    payment_date: new Date().toISOString().slice(0, 10),
    status: "completed", reconciliation_status: "unreconciled", approval_status: "approved",
  }).select("id").single();
  await postSupplierPayment({ tenantId: TENANT_A, postedByAccountId: null }, (payOut as { id: string }).id);

  /* Open vendor bill for AP aging. Due yesterday. */
  const billDue = new Date(); billDue.setDate(billDue.getDate() - 1);
  await supabase.from("vendor_bills").insert({
    tenant_id: TENANT_A, supplier_id: supplierA,
    bill_no: `BILL-A6-${Date.now().toString(16).slice(-4)}`,
    status: "posted", bill_date: billDue.toISOString().slice(0, 10),
    due_date: billDue.toISOString().slice(0, 10),
    currency: "USD", subtotal: 80, tax_total: 0, total: 80, amount_paid: 0, balance: 80,
  });

  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;

  /* 01 — P&L identity: revenue − cogs − opex = net_profit.
     PLSection uses `.amount` not `.total`. */
  const pl = await buildProfitLoss(TENANT_A, { from: yearStart, to: today });
  ok(
    "01  P&L identity: revenue − cost_of_sales − opex = net_profit",
    near(pl.revenue.amount - pl.cost_of_sales.amount - pl.operating_expenses.amount, pl.net_profit),
    `rev=${pl.revenue.amount} cogs=${pl.cost_of_sales.amount} opex=${pl.operating_expenses.amount} np=${pl.net_profit}`,
  );

  /* 02 — Balance sheet: assets = liabilities + equity + CYE. */
  const bs = await buildBalanceSheetSummary(TENANT_A, today);
  const lAndE = bs.total_liabilities + bs.total_equity + bs.current_year_earnings;
  const lhsRhs = bs.total_assets - lAndE;
  ok(
    "02  Balance Sheet: Assets = Liabilities + Equity + CYE",
    Math.abs(lhsRhs) < 0.05 && Math.abs(bs.balanced_difference) < 0.05,
    `Δ=${lhsRhs.toFixed(4)} assets=${bs.total_assets.toFixed(2)} liab+eq+cye=${lAndE.toFixed(2)}`,
  );

  /* 03 — Cash flow summary: in − out = net change. */
  const cfs = await buildCashFlowSummary({ tenantId: TENANT_A, from: yearStart, to: today });
  ok(
    "03  Cash flow summary: in − out = net change",
    near(cfs.cash_in - cfs.cash_out, cfs.net_change) && near(cfs.cash_in, 200) && near(cfs.cash_out, 50),
    `in=${cfs.cash_in} out=${cfs.cash_out} net=${cfs.net_change}`,
  );

  /* The full direct-method CF should also reconcile to TB; spot-check
     that it returns a valid statement object. */
  const cfFull = await buildCashFlow(TENANT_A, { from: yearStart, to: today });
  ok(
    "03b detailed direct-method cash flow reconciles to itself",
    cfFull.reconciled === true,
    `closing=${cfFull.closing_cash}`,
  );

  /* 04 + 05 — AR aging. */
  const ar = await buildArAging(TENANT_A);
  const sumParties = ar.parties.reduce((s, p) => s + p.total_open, 0);
  const sumBuckets = ar.buckets.reduce((s, b) => s + (ar.totals.by_bucket[b] ?? 0), 0);
  ok(
    "04  AR aging totals consistency (parties = buckets = totals.total_open)",
    near(sumParties, ar.totals.total_open) && near(sumBuckets, ar.totals.total_open),
    `parties=${sumParties} buckets=${sumBuckets} total=${ar.totals.total_open}`,
  );
  /* The single $500 invoice is 5 days overdue → 1-30 bucket should
     carry $500 and overdue total should also be $500. */
  ok(
    "05  AR aging puts the overdue $500 in 1-30 with $500 overdue total",
    near(ar.totals.by_bucket["1-30"], 500) && near(ar.totals.total_overdue, 500),
    `1-30=${ar.totals.by_bucket["1-30"]} overdue=${ar.totals.total_overdue}`,
  );

  /* 06 — AP aging shape. */
  const ap = await buildApAging(TENANT_A);
  const apSumParties = ap.parties.reduce((s, p) => s + p.total_open, 0);
  const apSumBuckets = ap.buckets.reduce((s, b) => s + (ap.totals.by_bucket[b] ?? 0), 0);
  ok(
    "06  AP aging totals consistency",
    near(apSumParties, ap.totals.total_open) && near(apSumBuckets, ap.totals.total_open) && near(ap.totals.total_open, 80),
    `parties=${apSumParties} buckets=${apSumBuckets} total=${ap.totals.total_open}`,
  );

  /* 07 — Inventory valuation total. */
  const iv = await buildInventoryValuationSummary(TENANT_A);
  /* After IN(50@4)+OUT(30@4) → 20 on hand × $4 = $80. */
  ok(
    "07  Inventory valuation total = remaining qty × avg cost (20 × 4 = 80)",
    near(iv.totals.total_value, 80) && near(iv.totals.total_qty, 20),
    `value=${iv.totals.total_value} qty=${iv.totals.total_qty}`,
  );

  /* 08 — Gross profit identity. */
  const gp = await buildGrossProfit({ tenantId: TENANT_A, from: yearStart, to: today });
  ok(
    "08  Gross profit totals: revenue − cogs = gross_profit",
    near(gp.totals.revenue - gp.totals.cogs, gp.totals.gross_profit) &&
      near(gp.totals.revenue, 500) && near(gp.totals.cogs, 120),
    `rev=${gp.totals.revenue} cogs=${gp.totals.cogs} gp=${gp.totals.gross_profit}`,
  );

  /* 09 — Margin %. */
  const expectedMargin = (gp.totals.gross_profit / gp.totals.revenue) * 100;
  ok(
    "09  Margin % = gross_profit / revenue × 100",
    Math.abs(gp.totals.margin_pct - expectedMargin) < 0.05,
    `margin=${gp.totals.margin_pct.toFixed(2)} expected=${expectedMargin.toFixed(2)}`,
  );

  /* 10 — Tenant isolation. B has nothing seeded. */
  const arB = await buildArAging(TENANT_B);
  const ivB = await buildInventoryValuationSummary(TENANT_B);
  const gpB = await buildGrossProfit({ tenantId: TENANT_B });
  ok(
    "10  tenant isolation — B sees no A data",
    arB.parties.length === 0 && ivB.rows.length === 0 && gpB.rows.length === 0,
    `arB.parties=${arB.parties.length} ivB.rows=${ivB.rows.length} gpB.rows=${gpB.rows.length}`,
  );

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
