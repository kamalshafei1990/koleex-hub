import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { calcInvoiceTotals, type LineInput } from "@/lib/server/invoice-totals";
import { assertScopeShadowForRow, toScopeContext } from "@/lib/server/apply-scope";
import { getScopeMode } from "@/lib/server/scope-flags";
import { isCustomerEnforced, ownsQuotation } from "@/lib/server/customer-quotation-guard";

/* POST /api/invoices/from-quotation
   body: { quotation_id: string, due_date?: string }

   Copies the quotation header + every quotation_item into a new draft
   invoice. Preserves customer, currency, notes, and discount. Returns
   the new invoice row. */

/* ── Invoice numbering ──────────────────────────────────────────────────────
   An invoice raised from a quotation INHERITS that quotation's deal number and
   only swaps the document letters:

       KL-QU-12349  →  KL-IN-12349

   so the pair is recognisable at a glance and on paper. Owner asked for this
   2026-08-24.

   Only a quotation minted before the deal counter existed (deal_no null, an
   old KL{YYYY}-{MMDD} number) needs a fresh number — it has nothing to
   inherit. Those take a new deal number of their own rather than a
   month-sequence, so every invoice from here on carries a linkable counter.

   The old scheme read the highest INV-YYYYMM-NNNN and added one. Two
   conversions at the same instant would have read the same "highest" and
   produced the same number; the counter cannot. */
async function invoiceNumberFor(
  tenantId: string,
  quotationDealNo: number | null,
): Promise<{ inv_no: string; deal_no: number }> {
  if (quotationDealNo != null) {
    return { inv_no: `KL-IN-${quotationDealNo}`, deal_no: quotationDealNo };
  }
  const { data, error } = await supabaseServer.rpc("next_deal_number", {
    p_tenant: tenantId,
  });
  if (error || data == null) {
    /* Fatal on purpose: a duplicate invoice number breaks the link to every
       document that follows and surfaces only much later. */
    throw new Error(`Could not allocate an invoice number: ${error?.message ?? "no value returned"}`);
  }
  const n = Number(data);
  return { inv_no: `KL-IN-${n}`, deal_no: n };
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Invoices", "create");
  if (deny) return deny;

  const body = (await req.json()) as { quotation_id: string; due_date?: string };
  if (!body.quotation_id) {
    return NextResponse.json({ error: "quotation_id required" }, { status: 400 });
  }

  // Load the quote + its lines, tenant-scoped.
  const [quoteRes, itemsRes] = await Promise.all([
    supabaseServer
      .from("quotations")
      // created_by is selected for DS1b-2a shadow scope evaluation only; it is
      // NOT echoed (the response is the new invoice). Used to read the source
      // quote's owner for the scope-shadow log.
      .select("id, quote_no, deal_no, customer_id, currency, discount_percent, notes, created_by, doc")
      .eq("id", body.quotation_id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle(),
    supabaseServer
      .from("quotation_items")
      .select("product_id, qty, unit_price, line_discount_percent")
      .eq("quotation_id", body.quotation_id),
  ]);
  if (quoteRes.error || !quoteRes.data) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  const quote = quoteRes.data;

  /* DS1b-2a — invoice-conversion data_scope SHADOW (log-only). Runs only when
     the Quotations flag is "shadow"; evaluates the SOURCE quotation against the
     user's Quotations data_scope. The Invoices gate above already passed; this
     additionally observes whether the user holds Quotations view (the
     conversion leak surface). The verdict NEVER affects control flow —
     conversion proceeds exactly as today regardless of would_allow. */
  if (getScopeMode("Quotations") === "shadow") {
    const quotationsPermPresent =
      (await requireModuleAction(auth, "Quotations", "create")) === null;
    await assertScopeShadowForRow({
      row: quote as unknown as Record<string, unknown>,
      ctx: toScopeContext(auth),
      module: "Quotations",
      endpoint: "POST /api/invoices/from-quotation",
      db: supabaseServer,
      mode: "shadow",
      extra: {
        source_route: "invoice_from_quotation",
        quotation_id: quote.id,
        invoice_permission_present: true,
        quotations_permission_present: quotationsPermPresent,
      },
    });
  }

  /* CQE — Customer-only enforcement: an external customer may not convert a
     quotation it doesn't own (Customer Admin/Staff have Invoices view, so this
     route is reachable). 403 before any invoice is created. Inert when the
     flag is off → internal/SA unchanged. */
  if (
    await isCustomerEnforced(auth, supabaseServer) &&
    !ownsQuotation(quote as { created_by?: string | null }, auth.account_id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lines: LineInput[] = (itemsRes.data ?? []).map((row, i) => ({
    product_id: row.product_id as string,
    qty: Number(row.qty),
    unit_price: Number(row.unit_price),
    line_discount_percent: Number(row.line_discount_percent ?? 0),
    sort_order: i,
  }));
  /* The quote's tax % lives in the doc jsonb (doc.taxPct), not a column.
     Carry it onto the invoice so converting a taxed quote keeps its tax
     instead of silently zeroing it. */
  const quoteTaxPct = Math.max(
    0,
    Math.min(100, Number((quote.doc as { taxPct?: number } | null)?.taxPct ?? 0) || 0),
  );
  const { hydrated, subtotal, tax_total, discount_total, total } =
    calcInvoiceTotals(lines, quoteTaxPct, Number(quote.discount_percent ?? 0));

  const { inv_no, deal_no } = await invoiceNumberFor(
    auth.tenant_id,
    (quote as { deal_no?: number | null }).deal_no ?? null,
  );

  const { data: invoice, error } = await supabaseServer
    .from("invoices")
    .insert({
      tenant_id: auth.tenant_id,
      inv_no,
      deal_no,
      customer_id: quote.customer_id,
      currency: quote.currency,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: body.due_date ?? null,
      discount_percent: Number(quote.discount_percent ?? 0),
      tax_rate: quoteTaxPct,
      subtotal,
      tax_total,
      discount_total,
      total,
      balance: total,
      amount_paid: 0,
      notes: quote.notes ?? null,
      linked_quotation_id: quote.id,
      status: "draft",
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error || !invoice) {
    console.error("[api/invoices/from-quotation]", error?.message);
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  if (hydrated.length > 0) {
    await supabaseServer
      .from("invoice_items")
      .insert(hydrated.map((h) => ({ ...h, invoice_id: invoice.id })));
  }

  return NextResponse.json({ invoice });
}
