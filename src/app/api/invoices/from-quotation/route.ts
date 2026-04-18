import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { calcInvoiceTotals, type LineInput } from "@/lib/server/invoice-totals";

/* POST /api/invoices/from-quotation
   body: { quotation_id: string, due_date?: string }

   Copies the quotation header + every quotation_item into a new draft
   invoice. Preserves customer, currency, notes, and discount. Returns
   the new invoice row. */

async function nextInvoiceNumber(tenantId: string): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${ym}-`;
  const { data } = await supabaseServer
    .from("invoices")
    .select("inv_no")
    .eq("tenant_id", tenantId)
    .ilike("inv_no", `${prefix}%`)
    .order("inv_no", { ascending: false })
    .limit(1);
  const last = data?.[0]?.inv_no as string | undefined;
  const nextSeq = last ? Number(last.replace(prefix, "")) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;

  const body = (await req.json()) as { quotation_id: string; due_date?: string };
  if (!body.quotation_id) {
    return NextResponse.json({ error: "quotation_id required" }, { status: 400 });
  }

  // Load the quote + its lines, tenant-scoped.
  const [quoteRes, itemsRes] = await Promise.all([
    supabaseServer
      .from("quotations")
      .select("id, quote_no, customer_id, currency, discount_percent, notes")
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
  const lines: LineInput[] = (itemsRes.data ?? []).map((row, i) => ({
    product_id: row.product_id as string,
    qty: Number(row.qty),
    unit_price: Number(row.unit_price),
    line_discount_percent: Number(row.line_discount_percent ?? 0),
    sort_order: i,
  }));
  const { hydrated, subtotal, tax_total, discount_total, total } =
    calcInvoiceTotals(lines, 0, Number(quote.discount_percent ?? 0));

  const inv_no = await nextInvoiceNumber(auth.tenant_id);

  const { data: invoice, error } = await supabaseServer
    .from("invoices")
    .insert({
      tenant_id: auth.tenant_id,
      inv_no,
      customer_id: quote.customer_id,
      currency: quote.currency,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: body.due_date ?? null,
      discount_percent: Number(quote.discount_percent ?? 0),
      tax_rate: 0,
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
