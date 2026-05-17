import "server-only";

/* ===========================================================================
   GET /api/workflows/status

   Returns row counts for the four workflow timelines:
     procurement · sales · finance · inventory

   Each stage carries a small numeric hint (`count`) so the timeline
   shows the user how much work is sitting at each step. Pure read,
   no business logic.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

async function countRows(table: string, tenantId: string, extra?: Record<string, unknown>): Promise<number> {
  let q = supabaseServer.from(table).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  for (const [k, v] of Object.entries(extra ?? {})) q = q.eq(k, v);
  const { count } = await q;
  return count ?? 0;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const t = auth.tenant_id;
  /* All counts in parallel. */
  const [
    poDraft, poConfirmed, poPartial, poReceived,
    receiptsPosted, billsDraft, billsPosted,
    payOut,
    soDraft, soConfirmed, soPartial, soShipped,
    shipmentsPosted, invoicesIssued, invoicesPaid, payIn,
    expDraft, expSubmitted, expApproved, expPosted,
    cogsDraft, journalDraft,
    invItems, invMovements, invBalances, invValuation,
  ] = await Promise.all([
    countRows("purchase_orders", t, { status: "draft" }),
    countRows("purchase_orders", t, { status: "confirmed" }),
    countRows("purchase_orders", t, { status: "partial" }),
    countRows("purchase_orders", t, { status: "received" }),
    countRows("purchase_receipts", t, { status: "posted" }),
    countRows("vendor_bills", t, { status: "draft" }),
    countRows("vendor_bills", t, { status: "posted" }),
    countRows("finance_payments", t, { direction: "out" }),
    countRows("sales_orders", t, { status: "draft" }),
    countRows("sales_orders", t, { status: "confirmed" }),
    countRows("sales_orders", t, { status: "partial" }),
    countRows("sales_orders", t, { status: "shipped" }),
    countRows("sales_shipments", t, { status: "shipped" }),
    countRows("invoices", t, { status: "issued" }),
    countRows("invoices", t, { status: "paid" }),
    countRows("finance_payments", t, { direction: "in" }),
    countRows("finance_expenses", t, { approval_status: "draft" }),
    countRows("finance_expenses", t, { approval_status: "submitted" }),
    countRows("finance_expenses", t, { approval_status: "approved" }),
    countRows("finance_expenses", t, { accounting_status: "posted" }),
    countRows("accounting_journal_entries", t, { source_type: "inventory_cogs", status: "draft" }),
    countRows("accounting_journal_entries", t, { status: "draft" }),
    countRows("inventory_items", t),
    countRows("inventory_stock_movements", t, { status: "posted" }),
    countRows("inventory_stock_balances", t),
    countRows("inventory_valuation", t),
  ]);

  return NextResponse.json({
    procurement: {
      po_draft: poDraft, po_confirmed: poConfirmed, po_partial: poPartial, po_received: poReceived,
      receipts_posted: receiptsPosted, bills_draft: billsDraft, bills_posted: billsPosted, payments_out: payOut,
    },
    sales: {
      so_draft: soDraft, so_confirmed: soConfirmed, so_partial: soPartial, so_shipped: soShipped,
      shipments_posted: shipmentsPosted, invoices_issued: invoicesIssued, invoices_paid: invoicesPaid, payments_in: payIn,
    },
    finance: {
      expenses_draft: expDraft, expenses_submitted: expSubmitted, expenses_approved: expApproved,
      expenses_posted: expPosted, cogs_draft: cogsDraft, journals_draft: journalDraft,
    },
    inventory: {
      items: invItems, movements: invMovements, balances: invBalances, valuation: invValuation,
    },
  });
}
