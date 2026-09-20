import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import { ledgerDraft } from "@/lib/accounting/hooks";

/* GET  /api/invoices/:id/payments — list payments
   POST /api/invoices/:id/payments — record a customer payment against the
        invoice, roll amount_paid / balance / status forward, and record the
        same receipt as a Finance payment (approved, linked to the invoice)
        so it reaches the ledger as Dr Bank / Cr A/R. Before this route
        wrote only the invoice's own cache and the books never heard of it. */

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
  const deny = await requireModuleAction(auth, "Invoices", "create");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    amount?: number;
    method?: string | null;
    reference?: string | null;
    received_at?: string | null;
    notes?: string | null;
    currency?: string;
  } | null;
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  const receivedAt = body?.received_at && /^\d{4}-\d{2}-\d{2}/.test(body.received_at) ? body.received_at.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const { data: invoice } = await supabaseServer
    .from("invoices")
    .select("id, inv_no, total, amount_paid, currency, status, customer_id, customer:customer_id ( name )")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inv = invoice as unknown as { id: string; inv_no: string | null; total: number; amount_paid: number | null; currency: string | null; status: string; customer_id: string | null; customer: { name?: string } | { name?: string }[] | null };
  if (inv.status === "draft" || inv.status === "cancelled" || inv.status === "void") {
    return NextResponse.json({ error: `A ${inv.status} invoice cannot receive payments` }, { status: 409 });
  }
  const outstanding = +(Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0)).toFixed(2);
  if (amount > outstanding + 0.005) {
    return NextResponse.json({ error: `Amount exceeds the outstanding balance (${outstanding.toFixed(2)})` }, { status: 422 });
  }
  const currency = (body?.currency ?? inv.currency ?? (await resolveBaseCurrency(auth.tenant_id))).toUpperCase();
  const customer = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;

  const { data: payment, error } = await supabaseServer
    .from("invoice_payments")
    .insert({
      tenant_id: auth.tenant_id,
      invoice_id: id,
      amount,
      method: body?.method ?? null,
      reference: body?.reference ?? null,
      received_at: receivedAt,
      notes: body?.notes ?? null,
      currency,
      recorded_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const newPaid = +(Number(inv.amount_paid ?? 0) + amount).toFixed(2);
  const newBalance = Math.max(0, +(Number(inv.total ?? 0) - newPaid).toFixed(2));
  const nextStatus = newBalance <= 0 ? "paid" : "partial";
  await supabaseServer
    .from("invoices")
    .update({ amount_paid: newPaid, balance: newBalance, status: nextStatus, paid_at: nextStatus === "paid" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);

  /* The same receipt as a Finance payment: this is what the ledger, the
     bank reconciliation and the treasury forecast read. A payment recorded
     against an issued invoice is approved by that fact. */
  const { data: finPay } = await supabaseServer
    .from("finance_payments")
    .insert({
      tenant_id: auth.tenant_id,
      direction: "in",
      party_type: "customer",
      party_id: inv.customer_id,
      party_name: customer?.name ?? "Customer",
      amount,
      currency,
      payment_date: receivedAt,
      payment_method: body?.method ?? null,
      reference_no: body?.reference ?? inv.inv_no ?? null,
      status: "completed",
      approval_status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: auth.account_id,
      linked_invoice_id: id,
      notes: body?.notes ?? (inv.inv_no ? `Invoice ${inv.inv_no}` : null),
      created_by_account_id: auth.account_id,
    })
    .select("id")
    .maybeSingle();
  if (finPay?.id) await ledgerDraft("payment", (finPay as { id: string }).id, auth.tenant_id, auth.account_id);

  return NextResponse.json({ payment, finance_payment_id: (finPay as { id: string } | null)?.id ?? null });
}
