import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/invoices/doc/from-quotation
     body: { quotation_id: string, due_date?: string }
   Clones a doc-builder quotation into a new draft invoice:
   copies customer_id, currency, total, the entire doc JSONB
   (customer name, items, terms, tax/shipping/others), and mints a
   fresh INV<year>-NNNN number. Remembers the source in
   linked_quotation_id. */

async function nextInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV${year}-`;
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
  const denyInv = await requireModuleAccess(auth, "Invoices");
  if (denyInv) return denyInv;
  // Caller also needs quotation view to read the source.
  const denyQuote = await requireModuleAccess(auth, "Quotations");
  if (denyQuote) return denyQuote;

  const body = (await req.json()) as { quotation_id: string; due_date?: string };
  if (!body.quotation_id) {
    return NextResponse.json({ error: "quotation_id required" }, { status: 400 });
  }

  const { data: quote, error: qErr } = await supabaseServer
    .from("quotations")
    .select("id, customer_id, currency, total, doc")
    .eq("id", body.quotation_id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (qErr || !quote) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  const inv_no = await nextInvoiceNumber(auth.tenant_id);
  const total = Number(quote.total ?? 0);

  // Reset a couple of UI-visible fields so the invoice doesn't inherit
  // the quote's identity confusingly.
  const doc = { ...(quote.doc as Record<string, unknown>) };
  doc.invoiceNo = inv_no;
  doc.status = "draft";

  const { data, error } = await supabaseServer
    .from("invoices")
    .insert({
      tenant_id: auth.tenant_id,
      inv_no,
      customer_id: quote.customer_id,
      currency: quote.currency,
      status: "draft",
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: body.due_date ?? null,
      total,
      balance: total,
      amount_paid: 0,
      linked_quotation_id: quote.id,
      doc,
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
