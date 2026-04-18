import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* Parallel endpoint to /api/invoices that understands the doc-builder's
   JSONB-shaped payload. Preserves the ERP-style columns (customer_id,
   inv_no, status, currency, total, issue_date) so filters and reports
   still work, while letting the document editor round-trip its full
   denormalised snapshot in `doc`. */

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

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const customerId = url.searchParams.get("customer_id");
  const search = url.searchParams.get("search")?.trim();

  let q = supabaseServer
    .from("invoices")
    .select(
      `id, tenant_id, inv_no, customer_id, status, currency,
       issue_date, due_date, total, amount_paid, balance,
       doc, created_at, updated_at, paid_at,
       customer:customer_id ( id, display_name, company_name )`,
    )
    .eq("tenant_id", auth.tenant_id);

  if (status !== "all") q = q.eq("status", status);
  if (customerId) q = q.eq("customer_id", customerId);
  if (search) q = q.ilike("inv_no", `%${search}%`);

  q = q.order("updated_at", { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[api/invoices/doc GET]", error.message);
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
    id?: string;
    inv_no?: string;
    customer_id?: string | null;
    currency?: string;
    status?: "draft" | "sent" | "issued" | "partial" | "paid" | "overdue" | "cancelled" | "void";
    issue_date?: string;
    due_date?: string | null;
    total?: number;
    linked_quotation_id?: string | null;
    doc: Record<string, unknown>;
  };

  if (body.id) {
    const total = Number(body.total ?? 0);
    // Derive balance against whatever's been paid so far.
    const { data: prev } = await supabaseServer
      .from("invoices")
      .select("amount_paid")
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    const paid = Number(prev?.amount_paid ?? 0);
    const { data, error } = await supabaseServer
      .from("invoices")
      .update({
        inv_no: body.inv_no,
        customer_id: body.customer_id ?? null,
        currency: body.currency ?? "USD",
        status: body.status ?? "draft",
        issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
        due_date: body.due_date ?? null,
        total,
        balance: +(total - paid).toFixed(2),
        linked_quotation_id: body.linked_quotation_id ?? null,
        doc: body.doc ?? {},
      })
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ invoice: data });
  }

  const inv_no = body.inv_no ?? (await nextInvoiceNumber(auth.tenant_id));
  const total = Number(body.total ?? 0);
  const { data, error } = await supabaseServer
    .from("invoices")
    .insert({
      tenant_id: auth.tenant_id,
      inv_no,
      customer_id: body.customer_id ?? null,
      currency: body.currency ?? "USD",
      status: body.status ?? "draft",
      issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
      due_date: body.due_date ?? null,
      total,
      balance: total,
      amount_paid: 0,
      linked_quotation_id: body.linked_quotation_id ?? null,
      doc: body.doc ?? {},
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
