import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { calcInvoiceTotals, type LineInput } from "@/lib/server/invoice-totals";

/* GET  /api/invoices — list invoices (tenant-scoped).
     Query:
       status=draft|sent|issued|paid|partial|overdue|cancelled|void|all
       customer_id=<uuid>
       search=<text>      ilike on inv_no
       from=<YYYY-MM-DD>  issue_date >=
       to=<YYYY-MM-DD>    issue_date <
   POST /api/invoices — create a new draft invoice (with lines). */


/** Deterministic "INV-YYYYMM-NNNN" generator, scoped per tenant. */
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

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const customerId = url.searchParams.get("customer_id");
  const search = url.searchParams.get("search")?.trim();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let q = supabaseServer
    .from("invoices")
    .select(
      `id, tenant_id, inv_no, customer_id, status, currency,
       issue_date, due_date, payment_terms,
       subtotal, tax_total, discount_total, total, amount_paid, balance,
       notes, terms, linked_quotation_id, linked_project_id,
       created_by_account_id, created_at, updated_at, paid_at,
       customer:customer_id ( id, display_name, company_name )`,
    )
    .eq("tenant_id", auth.tenant_id);

  if (status !== "all") q = q.eq("status", status);
  if (customerId) q = q.eq("customer_id", customerId);
  if (from) q = q.gte("issue_date", from);
  if (to) q = q.lt("issue_date", to);
  if (search) q = q.ilike("inv_no", `%${search}%`);

  q = q.order("issue_date", { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[api/invoices GET]", error.message);
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
  return NextResponse.json({ invoices: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;

  const body = (await req.json()) as {
    customer_id?: string | null;
    currency?: string;
    issue_date?: string;
    due_date?: string | null;
    tax_rate?: number;
    discount_percent?: number;
    notes?: string | null;
    terms?: string | null;
    payment_terms?: string | null;
    linked_quotation_id?: string | null;
    linked_project_id?: string | null;
    lines?: LineInput[];
  };

  const lines = body.lines ?? [];
  const { hydrated, subtotal, tax_total, discount_total, total } = calcInvoiceTotals(
    lines,
    body.tax_rate ?? 0,
    body.discount_percent ?? 0,
  );

  const inv_no = await nextInvoiceNumber(auth.tenant_id);

  const { data: invoice, error } = await supabaseServer
    .from("invoices")
    .insert({
      tenant_id: auth.tenant_id,
      inv_no,
      customer_id: body.customer_id ?? null,
      currency: body.currency ?? "USD",
      issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
      due_date: body.due_date ?? null,
      tax_rate: body.tax_rate ?? 0,
      discount_percent: body.discount_percent ?? 0,
      subtotal,
      tax_total,
      discount_total,
      total,
      balance: total,
      amount_paid: 0,
      notes: body.notes ?? null,
      terms: body.terms ?? null,
      payment_terms: body.payment_terms ?? null,
      linked_quotation_id: body.linked_quotation_id ?? null,
      linked_project_id: body.linked_project_id ?? null,
      status: "draft",
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error || !invoice) {
    console.error("[api/invoices POST]", error?.message);
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  if (hydrated.length > 0) {
    const { error: lineErr } = await supabaseServer
      .from("invoice_items")
      .insert(hydrated.map((h) => ({ ...h, invoice_id: invoice.id })));
    if (lineErr) console.error("[api/invoices POST lines]", lineErr.message);
  }

  return NextResponse.json({ invoice });
}
