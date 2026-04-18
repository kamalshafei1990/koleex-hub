import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/quotations — list (tenant-scoped)
     Query:
       status=draft|final|all         default: all
       customer_id=<uuid>
       search=<text>                  ilike on quote_no + doc->>customerName
   POST /api/quotations — upsert a doc-builder quote. Body:
       {
         id?: string,                 // if present → update
         quote_no?: string,           // if absent → server mints next KL<year>-NNNN
         customer_id?: string | null,
         currency?: string,
         status?: 'draft' | 'final',
         issue_date?: YYYY-MM-DD,
         valid_till?: YYYY-MM-DD | null,
         total?: number,              // client-computed grand total for list view
         doc: Record<string, unknown> // full UI snapshot
       } */

async function nextQuoteNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `KL${year}-`;
  const { data } = await supabaseServer
    .from("quotations")
    .select("quote_no")
    .eq("tenant_id", tenantId)
    .ilike("quote_no", `${prefix}%`)
    .order("quote_no", { ascending: false })
    .limit(1);
  const last = data?.[0]?.quote_no as string | undefined;
  const nextSeq = last ? Number(last.replace(prefix, "")) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const customerId = url.searchParams.get("customer_id");
  const search = url.searchParams.get("search")?.trim();

  let q = supabaseServer
    .from("quotations")
    .select(
      `id, tenant_id, quote_no, customer_id, status, currency, discount_percent,
       notes, doc, issue_date, valid_till, total, created_at, updated_at,
       customer:customer_id ( id, display_name, company_name )`,
    )
    .eq("tenant_id", auth.tenant_id);

  if (status !== "all") q = q.eq("status", status);
  if (customerId) q = q.eq("customer_id", customerId);
  if (search) q = q.or(`quote_no.ilike.%${search}%`);

  q = q.order("updated_at", { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[api/quotations GET]", error.message);
    return NextResponse.json({ error: "Failed to load quotations" }, { status: 500 });
  }
  return NextResponse.json({ quotations: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;

  const body = (await req.json()) as {
    id?: string;
    quote_no?: string;
    customer_id?: string | null;
    currency?: string;
    status?: "draft" | "final";
    issue_date?: string;
    valid_till?: string | null;
    total?: number;
    doc: Record<string, unknown>;
  };

  // Upsert by id if given; else mint a new record with a fresh quote_no.
  if (body.id) {
    const { data, error } = await supabaseServer
      .from("quotations")
      .update({
        quote_no: body.quote_no,
        customer_id: body.customer_id ?? null,
        currency: body.currency ?? "USD",
        status: body.status ?? "draft",
        issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
        valid_till: body.valid_till ?? null,
        total: body.total ?? 0,
        doc: body.doc ?? {},
      })
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ quotation: data });
  }

  const quote_no = body.quote_no ?? (await nextQuoteNumber(auth.tenant_id));
  const { data, error } = await supabaseServer
    .from("quotations")
    .insert({
      tenant_id: auth.tenant_id,
      quote_no,
      customer_id: body.customer_id ?? null,
      currency: body.currency ?? "USD",
      status: body.status ?? "draft",
      issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
      valid_till: body.valid_till ?? null,
      total: body.total ?? 0,
      doc: body.doc ?? {},
      created_by: auth.account_id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quotation: data });
}
