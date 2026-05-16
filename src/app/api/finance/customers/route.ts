import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { computeCustomerTotals } from "@/lib/finance/calc";
import type { FinanceCustomerAccount, FinanceOrder, FinancePayment } from "@/lib/finance/types";

/* GET  /api/finance/customers
 *   Returns every customer the tenant has done business with — sourced
 *   from the union of (a) finance_customer_accounts rows (configured
 *   accounts) and (b) any customer_id seen on a finance_orders row.
 *   For each row the totals are computed from orders + payments at
 *   query time (no denormalisation).
 *
 * POST /api/finance/customers
 *   Upsert the per-customer config row (payment terms, credit status).
 */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const [accountsRes, ordersRes, paymentsRes] = await Promise.all([
    supabaseServer
      .from("finance_customer_accounts")
      .select("*")
      .eq("tenant_id", auth.tenant_id),
    supabaseServer
      .from("finance_orders")
      .select("customer_id, customer_name, selling_price, payment_status, payment_due_date")
      .eq("tenant_id", auth.tenant_id),
    supabaseServer
      .from("finance_payments")
      .select("party_type, party_id, amount, direction, status")
      .eq("tenant_id", auth.tenant_id)
      .eq("party_type", "customer"),
  ]);

  if (accountsRes.error || ordersRes.error || paymentsRes.error) {
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 });
  }

  const accounts: FinanceCustomerAccount[] = (accountsRes.data ?? []) as FinanceCustomerAccount[];
  const orders = ordersRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  /* Build the union: every customer_id seen anywhere */
  const ids = new Map<string, { name: string }>();
  for (const a of accounts) ids.set(a.customer_id, { name: a.customer_name });
  for (const o of orders) {
    const k = (o as { customer_id: string | null }).customer_id;
    if (!k) continue;
    if (!ids.has(k)) ids.set(k, { name: (o as { customer_name: string }).customer_name });
  }

  const ordersByCust = groupBy(orders, (o) => (o as { customer_id: string | null }).customer_id ?? "");
  const paysByCust = groupBy(payments, (p) => (p as { party_id: string | null }).party_id ?? "");

  const out = Array.from(ids.entries()).map(([customer_id, meta]) => {
    const acc = accounts.find((a) => a.customer_id === customer_id);
    const totals = computeCustomerTotals({
      orders: (ordersByCust.get(customer_id) ?? []).map((o) => ({
        selling_price: Number((o as { selling_price: number | string }).selling_price) || 0,
        payment_status: (o as { payment_status: FinanceOrder["payment_status"] }).payment_status,
        payment_due_date: (o as { payment_due_date: string | null }).payment_due_date,
      })),
      payments: (paysByCust.get(customer_id) ?? []).map((p) => ({
        amount: Number((p as { amount: number | string }).amount) || 0,
        direction: (p as { direction: FinancePayment["direction"] }).direction,
        status: (p as { status: FinancePayment["status"] }).status,
      })),
    });
    return {
      id: acc?.id ?? null,
      customer_id,
      customer_name: acc?.customer_name || meta.name,
      payment_terms: acc?.payment_terms ?? null,
      credit_limit: acc?.credit_limit ?? null,
      credit_status: acc?.credit_status ?? "good",
      default_currency: acc?.default_currency ?? "USD",
      notes: acc?.notes ?? null,
      ...totals,
    };
  });

  out.sort((a, b) => (b.total_revenue ?? 0) - (a.total_revenue ?? 0));
  return NextResponse.json({ customers: out });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json()) as Partial<FinanceCustomerAccount>;
  if (!body.customer_id) {
    return NextResponse.json({ error: "customer_id required" }, { status: 400 });
  }
  const { data, error } = await supabaseServer
    .from("finance_customer_accounts")
    .upsert(
      {
        tenant_id: auth.tenant_id,
        customer_id: body.customer_id,
        customer_name: body.customer_name ?? "",
        payment_terms: body.payment_terms ?? null,
        credit_limit: body.credit_limit ?? null,
        credit_status: body.credit_status ?? "good",
        default_currency: body.default_currency ?? "USD",
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,customer_id" },
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customer_account: data });
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k) ?? [];
    arr.push(r);
    m.set(k, arr);
  }
  return m;
}
