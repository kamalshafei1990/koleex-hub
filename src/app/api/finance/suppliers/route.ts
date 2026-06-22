import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { computeSupplierTotals } from "@/lib/finance/calc";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import type { FinanceSupplierAccount, FinanceExpense, FinanceOrderSupplier, FinancePayment } from "@/lib/finance/types";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const [accountsRes, supplierLinesRes, expensesRes, paymentsRes] = await Promise.all([
    supabaseServer.from("finance_supplier_accounts").select("*").eq("tenant_id", auth.tenant_id),
    supabaseServer
      .from("finance_order_suppliers")
      .select("supplier_id, supplier_name, supplier_cost, paid_amount, payment_status, due_date")
      .eq("tenant_id", auth.tenant_id),
    supabaseServer
      .from("finance_expenses")
      .select("linked_supplier_id, amount, payment_status, due_date")
      .eq("tenant_id", auth.tenant_id),
    supabaseServer
      .from("finance_payments")
      .select("party_type, party_id, amount, direction, status")
      .eq("tenant_id", auth.tenant_id)
      .eq("party_type", "supplier"),
  ]);

  if (accountsRes.error || supplierLinesRes.error) {
    return NextResponse.json({ error: "Failed to load suppliers" }, { status: 500 });
  }

  const accounts: FinanceSupplierAccount[] = (accountsRes.data ?? []) as FinanceSupplierAccount[];
  const supplierLines = supplierLinesRes.data ?? [];
  const expenses = (expensesRes.data ?? []).filter((e) => (e as { linked_supplier_id: string | null }).linked_supplier_id);
  const payments = paymentsRes.data ?? [];

  /* Build the union of every supplier_id seen anywhere */
  const ids = new Map<string, { name: string }>();
  for (const a of accounts) ids.set(a.supplier_id, { name: a.supplier_name });
  for (const s of supplierLines) {
    const k = (s as { supplier_id: string | null }).supplier_id;
    if (!k) continue;
    if (!ids.has(k)) ids.set(k, { name: (s as { supplier_name: string }).supplier_name });
  }
  for (const e of expenses) {
    const k = (e as { linked_supplier_id: string | null }).linked_supplier_id;
    if (!k) continue;
    if (!ids.has(k)) ids.set(k, { name: "" });
  }

  /* Currency stabilization — suppliers default to tenant base. */
  const baseCcy = await resolveBaseCurrency(auth.tenant_id);

  const out = Array.from(ids.entries()).map(([supplier_id, meta]) => {
    const acc = accounts.find((a) => a.supplier_id === supplier_id);
    const lines = supplierLines.filter((s) => (s as { supplier_id: string | null }).supplier_id === supplier_id);
    const expRows = expenses.filter((e) => (e as { linked_supplier_id: string | null }).linked_supplier_id === supplier_id);
    const totals = computeSupplierTotals({
      order_supplier_costs: lines.map((l) => ({
        supplier_cost: Number((l as { supplier_cost: number | string }).supplier_cost) || 0,
        paid_amount: Number((l as { paid_amount: number | string }).paid_amount) || 0,
        due_date: (l as { due_date: string | null }).due_date,
        payment_status: (l as { payment_status: FinanceOrderSupplier["payment_status"] }).payment_status,
      })),
      expenses: expRows.map((e) => ({
        amount: Number((e as { amount: number | string }).amount) || 0,
        payment_status: (e as { payment_status: FinanceExpense["payment_status"] }).payment_status,
        due_date: (e as { due_date: string | null }).due_date,
      })),
      payments: payments
        .filter((p) => (p as { party_id: string | null }).party_id === supplier_id)
        .map((p) => ({
          amount: Number((p as { amount: number | string }).amount) || 0,
          direction: (p as { direction: FinancePayment["direction"] }).direction,
          status: (p as { status: FinancePayment["status"] }).status,
        })),
    });
    return {
      id: acc?.id ?? null,
      supplier_id,
      supplier_name: acc?.supplier_name || meta.name,
      payment_terms: acc?.payment_terms ?? null,
      default_currency: acc?.default_currency ?? baseCcy,
      notes: acc?.notes ?? null,
      ...totals,
    };
  });

  out.sort((a, b) => (b.total_purchases ?? 0) - (a.total_purchases ?? 0));
  return NextResponse.json({ suppliers: out });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const body = (await req.json()) as Partial<FinanceSupplierAccount>;
  if (!body.supplier_id) {
    return NextResponse.json({ error: "supplier_id required" }, { status: 400 });
  }
  /* Currency stabilization — default to tenant base, not USD. */
  const baseCcy = await resolveBaseCurrency(auth.tenant_id);
  const { data, error } = await supabaseServer
    .from("finance_supplier_accounts")
    .upsert(
      {
        tenant_id: auth.tenant_id,
        supplier_id: body.supplier_id,
        supplier_name: body.supplier_name ?? "",
        payment_terms: body.payment_terms ?? null,
        default_currency: body.default_currency ?? baseCcy,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,supplier_id" },
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ supplier_account: data });
}
