import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/invoices/:id/payments — list payments
   POST /api/invoices/:id/payments — record a payment and roll
        amount_paid / balance / status forward on the parent invoice. */

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("invoice_payments")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("invoice_id", id)
    .order("received_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json()) as {
    amount: number;
    method?: string | null;
    reference?: string | null;
    received_at?: string | null;
    notes?: string | null;
    currency?: string;
  };

  if (!body.amount || Number(body.amount) <= 0) {
    return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  }

  const { data: invoice } = await supabaseServer
    .from("invoices")
    .select("total, amount_paid, currency, status")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: payment, error } = await supabaseServer
    .from("invoice_payments")
    .insert({
      tenant_id: auth.tenant_id,
      invoice_id: id,
      amount: Number(body.amount),
      method: body.method ?? null,
      reference: body.reference ?? null,
      received_at: body.received_at ?? new Date().toISOString().slice(0, 10),
      notes: body.notes ?? null,
      currency: body.currency ?? invoice.currency ?? "USD",
      recorded_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Roll up the invoice cache. Status progresses:
  //   balance == 0           → paid
  //   0 < balance < total    → partial
  //   balance == total       → stays draft/sent/issued
  const newPaid = +(Number(invoice.amount_paid ?? 0) + Number(body.amount)).toFixed(2);
  const newBalance = +(Number(invoice.total ?? 0) - newPaid).toFixed(2);
  const nextStatus = newBalance <= 0 ? "paid" : newPaid > 0 ? "partial" : invoice.status;

  await supabaseServer
    .from("invoices")
    .update({
      amount_paid: newPaid,
      balance: newBalance > 0 ? newBalance : 0,
      status: nextStatus,
      paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);

  return NextResponse.json({ payment });
}
