import "server-only";

/* ===========================================================================
   Traceability — relationship + impact resolver.

   Given any document (kind + id), returns:
     · timeline  — ordered events from upstream → downstream
     · impacts   — accounting / inventory / FX / valuation summaries
     · related   — direct links to every connected document

   Pure read. No new tables. Walks the existing FKs:
     SO → (sales_shipments, invoices)
     PO → (purchase_receipts, vendor_bills)
     Invoice / Bill / Shipment / Receipt → finance_payments + journal entries
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

export type DocKind = "so" | "po" | "invoice" | "bill" | "shipment" | "receipt" | "quotation";

export interface TimelineEvent {
  key: string;
  /** When this event occurred (used for sort + display). */
  occurred_at: string;
  kind: DocKind | "payment" | "journal" | "stock";
  ref: string;
  label: string;
  status: string;
  state: "done" | "current" | "pending";
  href: string;
}

export interface RelatedDoc {
  kind: DocKind | "payment" | "journal" | "stock";
  id: string;
  ref: string;
  status: string;
  href: string;
}

export interface FinancialImpact {
  accounting: Array<{ ref: string; status: string; amount: number; currency: string; href: string }>;
  inventory:  Array<{ ref: string; warehouse: string | null; qty: number; direction: "in" | "out"; href: string }>;
  payments:   Array<{ ref: string; direction: "in" | "out"; amount: number; currency: string; status: string; date: string; href: string }>;
  fx:         { applied: boolean; rate: number | null; base_currency: string | null; base_amount: number | null };
}

export interface Traceability {
  doc: { kind: DocKind; id: string; ref: string; status: string };
  timeline: TimelineEvent[];
  related:  RelatedDoc[];
  impacts:  FinancialImpact;
  /** Top-line status the UI can show next to "Outstanding work". */
  outstanding: string[];
}

/* ─── Helpers ──────────────────────────────────────────────── */

function eventFor(
  key: string, kind: TimelineEvent["kind"], ref: string, label: string,
  status: string, occurred_at: string, href: string,
  state: TimelineEvent["state"] = "done",
): TimelineEvent {
  return { key, kind, ref, label, status, occurred_at, href, state };
}

async function loadJournals(tenantId: string, sourceType: string, sourceId: string) {
  const { data } = await supabaseServer.from("accounting_journal_entries")
    .select("id, journal_no, status, entry_date").eq("tenant_id", tenantId)
    .eq("source_type", sourceType).eq("source_id", sourceId)
    .order("entry_date", { ascending: true });
  return ((data ?? []) as Array<{
    id: string; journal_no: string; status: string; entry_date: string;
  }>);
}

async function loadPaymentsByOrder(tenantId: string, orderId: string) {
  const { data } = await supabaseServer.from("finance_payments")
    .select("id, reference_no, amount, currency, direction, status, payment_date")
    .eq("tenant_id", tenantId).eq("linked_order_id", orderId)
    .order("payment_date", { ascending: true });
  return ((data ?? []) as Array<{
    id: string; reference_no: string | null; amount: number; currency: string;
    direction: string; status: string; payment_date: string;
  }>);
}

/* ─── Sales Order traceability ────────────────────────────── */

async function traceSalesOrder(tenantId: string, soId: string): Promise<Traceability> {
  const soRes = await supabaseServer.from("sales_orders")
    .select("id, so_no, status, currency, base_amount, base_currency, fx_rate, created_at, customer_id, quotation_id")
    .eq("id", soId).eq("tenant_id", tenantId).maybeSingle();
  const so = soRes.data as {
    id: string; so_no: string | null; status: string; currency: string;
    base_amount: number | null; base_currency: string | null; fx_rate: number | null;
    created_at: string; customer_id: string | null; quotation_id: string | null;
  } | null;
  if (!so) throw new Error("Sales order not found.");

  const [shipsRes, invsRes] = await Promise.all([
    supabaseServer.from("sales_shipments")
      .select("id, shipment_no, status, shipment_date").eq("tenant_id", tenantId)
      .eq("sales_order_id", soId).order("shipment_date", { ascending: true }),
    supabaseServer.from("invoices")
      .select("id, inv_no, status, issue_date, total, base_amount, currency, balance, amount_paid, sales_order_id")
      .eq("tenant_id", tenantId).eq("sales_order_id", soId),
  ]);
  type Ship = { id: string; shipment_no: string | null; status: string; shipment_date: string };
  type Inv  = {
    id: string; inv_no: string | null; status: string; issue_date: string;
    total: number; base_amount: number | null; currency: string;
    balance: number; amount_paid: number; sales_order_id: string;
  };
  const ships = (shipsRes.data ?? []) as Ship[];
  const invs  = (invsRes.data  ?? []) as Inv[];

  /* Timeline */
  const timeline: TimelineEvent[] = [];

  if (so.quotation_id) {
    const q = await supabaseServer.from("quotations")
      .select("id, q_no, status, created_at").eq("id", so.quotation_id).maybeSingle();
    const qq = q.data as { id: string; q_no: string | null; status: string; created_at: string } | null;
    if (qq) {
      timeline.push(eventFor(`quotation-${qq.id}`, "quotation",
        qq.q_no ?? qq.id.slice(0, 8), "Quotation", qq.status, qq.created_at,
        `/quotations/${qq.id}`));
    }
  }

  timeline.push(eventFor(`so-${so.id}`, "so", so.so_no ?? so.id.slice(0, 8),
    "Sales Order", so.status, so.created_at, `/sales/orders/${so.id}`,
    so.status === "closed" ? "done" : "current"));

  for (const s of ships) {
    timeline.push(eventFor(`ship-${s.id}`, "shipment",
      s.shipment_no ?? s.id.slice(0, 8), "Shipment",
      s.status, s.shipment_date,
      `/sales/orders/${so.id}#shipment-${s.id}`,
      s.status === "shipped" ? "done" : s.status === "voided" ? "done" : "current"));
  }

  for (const inv of invs) {
    timeline.push(eventFor(`inv-${inv.id}`, "invoice",
      inv.inv_no ?? inv.id.slice(0, 8), "Invoice",
      inv.status, inv.issue_date,
      `/invoices/${inv.id}`,
      inv.status === "paid" ? "done" : "current"));
  }

  /* Payments tied to the SO via linked_order_id. */
  const pays = await loadPaymentsByOrder(tenantId, so.id);
  for (const p of pays) {
    timeline.push(eventFor(`pay-${p.id}`, "payment", p.reference_no ?? p.id.slice(0, 8),
      `Payment ${p.direction === "in" ? "received" : "sent"}`,
      p.status, p.payment_date, `/finance/payments?id=${p.id}`));
  }

  /* Journals — from SO + each shipment + each invoice. */
  const jeKeys: Array<[string, string]> = [["sales_order", so.id], ...ships.map((s): [string, string] => ["sales_shipment", s.id]), ...invs.map((i): [string, string] => ["sales_invoice", i.id])];
  const journals: TimelineEvent[] = [];
  for (const [t, id] of jeKeys) {
    const rows = await loadJournals(tenantId, t, id);
    for (const j of rows) {
      journals.push(eventFor(`je-${j.id}`, "journal", j.journal_no, "Journal posted",
        j.status, j.entry_date, `/finance/accounting?journal=${j.id}`));
    }
  }
  timeline.push(...journals);

  /* Stock movements tied to the shipments. */
  for (const s of ships) {
    const { data: movs } = await supabaseServer.from("inventory_stock_movements")
      .select("id, movement_no, direction, quantity, warehouse_id, movement_date")
      .eq("tenant_id", tenantId).eq("source_type", "sales_shipment").eq("source_id", s.id);
    for (const m of (movs ?? []) as Array<{
      id: string; movement_no: string; direction: string; quantity: number;
      warehouse_id: string; movement_date: string;
    }>) {
      timeline.push(eventFor(`mov-${m.id}`, "stock",
        m.movement_no, `Stock out (${Number(m.quantity).toFixed(2)})`,
        m.direction, m.movement_date,
        `/inventory/items?movement=${m.id}`));
    }
  }

  timeline.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  /* Related list (dedup). */
  const related: RelatedDoc[] = [];
  if (so.customer_id) related.push({ kind: "so", id: so.customer_id, ref: "Customer",
    status: "—", href: `/customers/${so.customer_id}` });
  for (const s of ships) related.push({ kind: "shipment", id: s.id,
    ref: s.shipment_no ?? s.id.slice(0, 8), status: s.status,
    href: `/sales/orders/${so.id}#shipment-${s.id}` });
  for (const inv of invs) related.push({ kind: "invoice", id: inv.id,
    ref: inv.inv_no ?? inv.id.slice(0, 8), status: inv.status,
    href: `/invoices/${inv.id}` });
  for (const p of pays) related.push({ kind: "payment", id: p.id,
    ref: p.reference_no ?? p.id.slice(0, 8), status: p.status,
    href: `/finance/payments?id=${p.id}` });

  /* Impacts */
  const impacts: FinancialImpact = {
    accounting: journals.map((j) => ({
      ref: j.ref, status: j.status, amount: 0, currency: so.currency, href: j.href,
    })),
    inventory: [],
    payments: pays.map((p) => ({
      ref: p.reference_no ?? p.id.slice(0, 8),
      direction: (p.direction === "in" ? "in" : "out") as "in" | "out",
      amount: Number(p.amount) || 0, currency: p.currency,
      status: p.status, date: p.payment_date,
      href: `/finance/payments?id=${p.id}`,
    })),
    fx: {
      applied: !!so.fx_rate && so.fx_rate !== 1,
      rate: so.fx_rate, base_currency: so.base_currency, base_amount: so.base_amount,
    },
  };
  for (const t of timeline) {
    if (t.kind === "stock") impacts.inventory.push({
      ref: t.ref, warehouse: null, qty: 0, direction: "out", href: t.href,
    });
  }

  /* Outstanding */
  const outstanding: string[] = [];
  if (ships.length === 0)                     outstanding.push("No shipment yet.");
  if (invs.length === 0)                      outstanding.push("No invoice yet.");
  if (invs.some((i) => Number(i.balance) > 0)) outstanding.push("Open AR balance.");
  if (pays.length === 0 && invs.length > 0)   outstanding.push("No payment received.");

  return {
    doc: { kind: "so", id: so.id, ref: so.so_no ?? so.id.slice(0, 8), status: so.status },
    timeline, related, impacts, outstanding,
  };
}

/* ─── Purchase Order traceability ─────────────────────────── */

async function tracePurchaseOrder(tenantId: string, poId: string): Promise<Traceability> {
  const poRes = await supabaseServer.from("purchase_orders")
    .select("id, po_no, status, currency, base_amount, base_currency, fx_rate, supplier_id, created_at")
    .eq("id", poId).eq("tenant_id", tenantId).maybeSingle();
  const po = poRes.data as {
    id: string; po_no: string | null; status: string; currency: string;
    base_amount: number | null; base_currency: string | null; fx_rate: number | null;
    supplier_id: string | null; created_at: string;
  } | null;
  if (!po) throw new Error("Purchase order not found.");

  const [recRes, billRes] = await Promise.all([
    supabaseServer.from("purchase_receipts")
      .select("id, receipt_no, status, receipt_date").eq("tenant_id", tenantId)
      .eq("po_id", poId).order("receipt_date", { ascending: true }),
    supabaseServer.from("vendor_bills")
      .select("id, bill_no, status, bill_date, total, balance, currency, po_id")
      .eq("tenant_id", tenantId).eq("po_id", poId),
  ]);
  type Rec  = { id: string; receipt_no: string | null; status: string; receipt_date: string };
  type Bill = {
    id: string; bill_no: string | null; status: string; bill_date: string;
    total: number; balance: number; currency: string;
  };
  const recs  = (recRes.data  ?? []) as Rec[];
  const bills = (billRes.data ?? []) as Bill[];

  const timeline: TimelineEvent[] = [];
  timeline.push(eventFor(`po-${po.id}`, "po", po.po_no ?? po.id.slice(0, 8),
    "Purchase Order", po.status, po.created_at, `/purchase?id=${po.id}`,
    po.status === "received" || po.status === "billed" || po.status === "paid" ? "done" : "current"));
  for (const r of recs) {
    timeline.push(eventFor(`rec-${r.id}`, "receipt",
      r.receipt_no ?? r.id.slice(0, 8), "Goods received",
      r.status, r.receipt_date, `/purchase?id=${po.id}#receipt-${r.id}`,
      r.status === "received" ? "done" : "current"));
  }
  for (const b of bills) {
    timeline.push(eventFor(`bill-${b.id}`, "bill",
      b.bill_no ?? b.id.slice(0, 8), "Vendor bill",
      b.status, b.bill_date, `/finance/suppliers?bill=${b.id}`,
      b.status === "paid" ? "done" : "current"));
  }

  const pays = await loadPaymentsByOrder(tenantId, po.id);
  for (const p of pays) {
    timeline.push(eventFor(`pay-${p.id}`, "payment", p.reference_no ?? p.id.slice(0, 8),
      `Payment ${p.direction === "in" ? "received" : "sent"}`,
      p.status, p.payment_date, `/finance/payments?id=${p.id}`));
  }

  const jeKeys: Array<[string, string]> = [...recs.map((r): [string, string] => ["purchase_receipt", r.id]), ...bills.map((b): [string, string] => ["vendor_bill", b.id])];
  const journals: TimelineEvent[] = [];
  for (const [t, id] of jeKeys) {
    const rows = await loadJournals(tenantId, t, id);
    for (const j of rows) {
      journals.push(eventFor(`je-${j.id}`, "journal", j.journal_no, "Journal posted",
        j.status, j.entry_date, `/finance/accounting?journal=${j.id}`));
    }
  }
  timeline.push(...journals);

  /* Stock movements from receipts. */
  for (const r of recs) {
    const { data: movs } = await supabaseServer.from("inventory_stock_movements")
      .select("id, movement_no, direction, quantity, warehouse_id, movement_date")
      .eq("tenant_id", tenantId).eq("source_type", "purchase_receipt").eq("source_id", r.id);
    for (const m of (movs ?? []) as Array<{
      id: string; movement_no: string; direction: string; quantity: number;
      warehouse_id: string; movement_date: string;
    }>) {
      timeline.push(eventFor(`mov-${m.id}`, "stock",
        m.movement_no, `Stock in (${Number(m.quantity).toFixed(2)})`,
        m.direction, m.movement_date,
        `/inventory/items?movement=${m.id}`));
    }
  }

  timeline.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  const related: RelatedDoc[] = [];
  if (po.supplier_id) related.push({ kind: "po", id: po.supplier_id, ref: "Supplier",
    status: "—", href: `/contacts/${po.supplier_id}` });
  for (const r of recs)  related.push({ kind: "receipt", id: r.id,
    ref: r.receipt_no ?? r.id.slice(0, 8), status: r.status,
    href: `/purchase?id=${po.id}#receipt-${r.id}` });
  for (const b of bills) related.push({ kind: "bill", id: b.id,
    ref: b.bill_no ?? b.id.slice(0, 8), status: b.status,
    href: `/finance/suppliers?bill=${b.id}` });
  for (const p of pays)  related.push({ kind: "payment", id: p.id,
    ref: p.reference_no ?? p.id.slice(0, 8), status: p.status,
    href: `/finance/payments?id=${p.id}` });

  const impacts: FinancialImpact = {
    accounting: journals.map((j) => ({ ref: j.ref, status: j.status, amount: 0, currency: po.currency, href: j.href })),
    inventory:  [],
    payments: pays.map((p) => ({
      ref: p.reference_no ?? p.id.slice(0, 8),
      direction: (p.direction === "in" ? "in" : "out") as "in" | "out",
      amount: Number(p.amount) || 0, currency: p.currency,
      status: p.status, date: p.payment_date,
      href: `/finance/payments?id=${p.id}`,
    })),
    fx: {
      applied: !!po.fx_rate && po.fx_rate !== 1,
      rate: po.fx_rate, base_currency: po.base_currency, base_amount: po.base_amount,
    },
  };
  for (const t of timeline) {
    if (t.kind === "stock") impacts.inventory.push({
      ref: t.ref, warehouse: null, qty: 0, direction: "in", href: t.href,
    });
  }

  const outstanding: string[] = [];
  if (recs.length === 0)                       outstanding.push("Nothing received yet.");
  if (bills.length === 0)                      outstanding.push("No vendor bill yet.");
  if (bills.some((b) => Number(b.balance) > 0)) outstanding.push("Open AP balance.");
  if (pays.length === 0 && bills.length > 0)    outstanding.push("No payment sent.");

  return {
    doc: { kind: "po", id: po.id, ref: po.po_no ?? po.id.slice(0, 8), status: po.status },
    timeline, related, impacts, outstanding,
  };
}

/* ─── Invoice traceability ────────────────────────────────── */

async function traceInvoice(tenantId: string, invId: string): Promise<Traceability> {
  const invRes = await supabaseServer.from("invoices")
    .select("id, inv_no, status, total, balance, amount_paid, currency, base_amount, base_currency, fx_rate, sales_order_id, customer_id, issue_date")
    .eq("id", invId).eq("tenant_id", tenantId).maybeSingle();
  const inv = invRes.data as {
    id: string; inv_no: string | null; status: string; total: number; balance: number;
    amount_paid: number; currency: string; base_amount: number | null;
    base_currency: string | null; fx_rate: number | null;
    sales_order_id: string | null; customer_id: string | null; issue_date: string;
  } | null;
  if (!inv) throw new Error("Invoice not found.");

  /* If we know the SO, delegate — invoice traceability is a slice of
     SO traceability with the focus on this invoice. */
  if (inv.sales_order_id) {
    const t = await traceSalesOrder(tenantId, inv.sales_order_id);
    /* Re-anchor the doc identity to the invoice. */
    t.doc = { kind: "invoice", id: inv.id, ref: inv.inv_no ?? inv.id.slice(0, 8), status: inv.status };
    return t;
  }

  /* Standalone invoice. */
  const journals = await loadJournals(tenantId, "sales_invoice", inv.id);
  const { data: pays } = await supabaseServer.from("finance_payments")
    .select("id, reference_no, amount, currency, direction, status, payment_date")
    .eq("tenant_id", tenantId).contains("metadata", { invoice_id: inv.id } as Record<string, unknown>);
  const timeline: TimelineEvent[] = [];
  timeline.push(eventFor(`inv-${inv.id}`, "invoice", inv.inv_no ?? inv.id.slice(0, 8),
    "Invoice", inv.status, inv.issue_date, `/invoices/${inv.id}`,
    inv.status === "paid" ? "done" : "current"));
  for (const j of journals) timeline.push(eventFor(`je-${j.id}`, "journal",
    j.journal_no, "Journal posted", j.status, j.entry_date,
    `/finance/accounting?journal=${j.id}`));
  for (const p of (pays ?? []) as Array<{
    id: string; reference_no: string | null; amount: number; currency: string;
    direction: string; status: string; payment_date: string;
  }>) timeline.push(eventFor(`pay-${p.id}`, "payment",
    p.reference_no ?? p.id.slice(0, 8),
    `Payment ${p.direction === "in" ? "received" : "sent"}`,
    p.status, p.payment_date, `/finance/payments?id=${p.id}`));

  timeline.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  const impacts: FinancialImpact = {
    accounting: journals.map((j) => ({ ref: j.journal_no, status: j.status, amount: 0, currency: inv.currency, href: `/finance/accounting?journal=${j.id}` })),
    inventory: [],
    payments: ((pays ?? []) as Array<{ id: string; reference_no: string | null; amount: number; currency: string; direction: string; status: string; payment_date: string }>).map((p) => ({
      ref: p.reference_no ?? p.id.slice(0, 8),
      direction: (p.direction === "in" ? "in" : "out") as "in" | "out",
      amount: Number(p.amount) || 0, currency: p.currency,
      status: p.status, date: p.payment_date,
      href: `/finance/payments?id=${p.id}`,
    })),
    fx: { applied: !!inv.fx_rate && inv.fx_rate !== 1, rate: inv.fx_rate, base_currency: inv.base_currency, base_amount: inv.base_amount },
  };

  const outstanding: string[] = [];
  if (Number(inv.balance) > 0) outstanding.push(`Outstanding ${inv.currency} ${inv.balance.toFixed(2)}.`);
  if (journals.length === 0)   outstanding.push("Accounting not yet posted.");

  const related: RelatedDoc[] = [];
  if (inv.customer_id) related.push({ kind: "invoice", id: inv.customer_id, ref: "Customer",
    status: "—", href: `/customers/${inv.customer_id}` });
  for (const j of journals) related.push({ kind: "journal", id: j.id,
    ref: j.journal_no, status: j.status, href: `/finance/accounting?journal=${j.id}` });

  return {
    doc: { kind: "invoice", id: inv.id, ref: inv.inv_no ?? inv.id.slice(0, 8), status: inv.status },
    timeline, related, impacts, outstanding,
  };
}

/* ─── Vendor Bill traceability ────────────────────────────── */

async function traceBill(tenantId: string, billId: string): Promise<Traceability> {
  const billRes = await supabaseServer.from("vendor_bills")
    .select("id, bill_no, status, total, balance, amount_paid, currency, base_amount, base_currency, fx_rate, po_id, supplier_id, bill_date")
    .eq("id", billId).eq("tenant_id", tenantId).maybeSingle();
  const bill = billRes.data as {
    id: string; bill_no: string | null; status: string; total: number; balance: number;
    amount_paid: number; currency: string; base_amount: number | null;
    base_currency: string | null; fx_rate: number | null;
    po_id: string | null; supplier_id: string | null; bill_date: string;
  } | null;
  if (!bill) throw new Error("Vendor bill not found.");

  if (bill.po_id) {
    const t = await tracePurchaseOrder(tenantId, bill.po_id);
    t.doc = { kind: "bill", id: bill.id, ref: bill.bill_no ?? bill.id.slice(0, 8), status: bill.status };
    return t;
  }

  const journals = await loadJournals(tenantId, "vendor_bill", bill.id);
  const timeline: TimelineEvent[] = [];
  timeline.push(eventFor(`bill-${bill.id}`, "bill", bill.bill_no ?? bill.id.slice(0, 8),
    "Vendor bill", bill.status, bill.bill_date, `/finance/suppliers?bill=${bill.id}`,
    bill.status === "paid" ? "done" : "current"));
  for (const j of journals) timeline.push(eventFor(`je-${j.id}`, "journal",
    j.journal_no, "Journal posted", j.status, j.entry_date,
    `/finance/accounting?journal=${j.id}`));

  const impacts: FinancialImpact = {
    accounting: journals.map((j) => ({ ref: j.journal_no, status: j.status, amount: 0, currency: bill.currency, href: `/finance/accounting?journal=${j.id}` })),
    inventory:  [], payments: [],
    fx: { applied: !!bill.fx_rate && bill.fx_rate !== 1, rate: bill.fx_rate, base_currency: bill.base_currency, base_amount: bill.base_amount },
  };
  const outstanding: string[] = [];
  if (Number(bill.balance) > 0) outstanding.push(`Outstanding ${bill.currency} ${bill.balance.toFixed(2)}.`);

  return {
    doc: { kind: "bill", id: bill.id, ref: bill.bill_no ?? bill.id.slice(0, 8), status: bill.status },
    timeline, related: [], impacts, outstanding,
  };
}

/* ─── Public entry point ──────────────────────────────────── */

export async function getTraceability(tenantId: string, kind: DocKind, id: string): Promise<Traceability> {
  switch (kind) {
    case "so":      return traceSalesOrder(tenantId, id);
    case "po":      return tracePurchaseOrder(tenantId, id);
    case "invoice": return traceInvoice(tenantId, id);
    case "bill":    return traceBill(tenantId, id);
    default: throw new Error(`Traceability for kind '${kind}' not implemented yet.`);
  }
}
