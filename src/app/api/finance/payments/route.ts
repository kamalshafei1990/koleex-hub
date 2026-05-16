import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { FinancePayment } from "@/lib/finance/types";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const direction = url.searchParams.get("direction");
  const orderId = url.searchParams.get("order_id");
  const expenseId = url.searchParams.get("expense_id");

  /* Phase S.4 — list bound. Default cap 500, override via ?limit up
     to a hard ceiling of 2000. The dashboard and the payments app
     only render the newest window — no UI consumes the full ledger
     at once. Unbounded selects were a HIGH finding in the audit. */
  const reqLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(reqLimit) && reqLimit > 0 ? Math.min(reqLimit, 2000) : 500;

  let q = supabaseServer.from("finance_payments").select("*").eq("tenant_id", auth.tenant_id);
  if (direction) q = q.eq("direction", direction);
  if (orderId) q = q.eq("linked_order_id", orderId);
  if (expenseId) q = q.eq("linked_expense_id", expenseId);
  q = q.order("payment_date", { ascending: false }).limit(limit);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json()) as Partial<FinancePayment> & { id?: string };
  if (!body.direction || !body.party_type) {
    return NextResponse.json({ error: "direction + party_type required" }, { status: 400 });
  }
  const payload = {
    direction: body.direction,
    party_type: body.party_type,
    party_id: body.party_id ?? null,
    party_name: body.party_name ?? "",
    amount: Number(body.amount) || 0,
    currency: body.currency ?? "USD",
    payment_date: body.payment_date ?? new Date().toISOString().slice(0, 10),
    payment_method: body.payment_method ?? null,
    reference_no: body.reference_no ?? null,
    status: body.status ?? "completed",
    linked_order_id: body.linked_order_id ?? null,
    linked_order_supplier_id: body.linked_order_supplier_id ?? null,
    linked_expense_id: body.linked_expense_id ?? null,
    notes: body.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  if (body.id) {
    const { data, error } = await supabaseServer
      .from("finance_payments")
      .update(payload)
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ payment: data });
  }
  const { data, error } = await supabaseServer
    .from("finance_payments")
    .insert({ ...payload, tenant_id: auth.tenant_id, created_by_account_id: auth.account_id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payment: data });
}
