import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { computeOrderProfit, deriveTaxRefundValue } from "@/lib/finance/calc";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import type { FinanceOrder, FinanceOrderSupplier } from "@/lib/finance/types";

/* GET  /api/finance/orders — list (tenant-scoped, with computed profit fields)
   POST /api/finance/orders — create or update an order + its supplier lines.
        Body shape: { order: {...}, suppliers: [{...}, ...] }
        For an update include order.id; for a new order omit it.
*/

async function nextOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  const { data } = await supabaseServer
    .from("finance_orders")
    .select("order_no")
    .eq("tenant_id", tenantId)
    .ilike("order_no", `${prefix}%`)
    .order("order_no", { ascending: false })
    .limit(1);
  const last = data?.[0]?.order_no as string | undefined;
  const tail = last ? last.replace(prefix, "") : "";
  const parsed = /^\d+$/.test(tail) ? Number(tail) : NaN;
  const nextSeq = Number.isFinite(parsed) ? parsed + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim();

  /* Phase S.4 — list bound. Default cap 500, override via ?limit up
     to 2000. The orders table holds the long tail of the business;
     a tenant with 10K orders previously paid the cost of fetching
     all of them every time the Orders page mounted. */
  const reqLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(reqLimit) && reqLimit > 0 ? Math.min(reqLimit, 2000) : 500;

  let q = supabaseServer
    .from("finance_orders")
    .select("*, suppliers:finance_order_suppliers(*)")
    .eq("tenant_id", auth.tenant_id);

  if (customerId) q = q.eq("customer_id", customerId);
  if (status) q = q.eq("status", status);
  if (search) q = q.or(`order_no.ilike.%${search}%,customer_name.ilike.%${search}%`);

  q = q.order("order_date", { ascending: false }).limit(limit);

  const { data, error } = await q;
  if (error) {
    console.error("[api/finance/orders GET]", error.message);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }

  /* For each order, attach a precomputed profit summary. The list view
     reads these fields straight — no need to redo the math on the
     client for every row. */
  const orderIds = (data ?? []).map((o) => o.id as string);
  const [expensesRes, paymentsRes] = await Promise.all([
    orderIds.length
      ? supabaseServer
          .from("finance_expenses")
          .select("linked_order_id, amount, payment_status")
          .eq("tenant_id", auth.tenant_id)
          .in("linked_order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabaseServer
          .from("finance_payments")
          .select("linked_order_id, amount, direction, status")
          .eq("tenant_id", auth.tenant_id)
          .in("linked_order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  type ExpenseAgg = { amount: number; payment_status: import("@/lib/finance/types").PaymentStatus };
  const expensesByOrder = new Map<string, ExpenseAgg[]>();
  for (const e of expensesRes.data ?? []) {
    const k = (e as { linked_order_id: string | null }).linked_order_id;
    if (!k) continue;
    const arr = expensesByOrder.get(k) ?? [];
    arr.push({
      amount: Number((e as { amount: number | string }).amount) || 0,
      payment_status: (e as { payment_status: ExpenseAgg["payment_status"] }).payment_status,
    });
    expensesByOrder.set(k, arr);
  }
  const paymentsByOrder = new Map<string, number>();
  for (const p of paymentsRes.data ?? []) {
    const k = (p as { linked_order_id: string | null }).linked_order_id;
    if (!k) continue;
    const pp = p as { amount: number | string; direction: string; status: string };
    if (pp.direction !== "in" || pp.status !== "completed") continue;
    paymentsByOrder.set(k, (paymentsByOrder.get(k) ?? 0) + (Number(pp.amount) || 0));
  }

  const out: FinanceOrder[] = (data ?? []).map((row) => {
    const o = row as FinanceOrder & { suppliers: FinanceOrderSupplier[] };
    const linkedExp = expensesByOrder.get(o.id) ?? [];
    const customerPaid = paymentsByOrder.get(o.id) ?? 0;
    const taxRefundValue = deriveTaxRefundValue(
      Number(o.selling_price) || 0,
      Number(o.tax_refund_pct) || 0,
      Number(o.tax_refund_value) || 0,
    );
    const profit = computeOrderProfit({
      selling_price: Number(o.selling_price) || 0,
      tax_refund_value: taxRefundValue,
      financial_charges: Number(o.financial_charges) || 0,
      suppliers: o.suppliers ?? [],
      linked_expenses: linkedExp,
      customer_payments_total: customerPaid,
    });
    return {
      ...o,
      tax_refund_value: taxRefundValue,
      financial_charges: Number(o.financial_charges) || 0,
      suppliers: o.suppliers ?? [],
      total_supplier_cost: profit.total_supplier_cost,
      total_order_expenses: profit.total_order_expenses,
      gross_profit: profit.gross_profit,
      net_profit: profit.net_profit,
      net_profit_pct: profit.net_profit_pct,
      collected_amount: profit.collected_amount,
      paid_supplier_amount: profit.paid_supplier_amount,
      paid_expenses: profit.paid_expenses,
      realized_cash_position: profit.realized_cash_position,
      outstanding_receivable: profit.outstanding_receivable,
      outstanding_payable: profit.outstanding_payable,
    };
  });

  return NextResponse.json({ orders: out });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  type SupplierIn = Partial<FinanceOrderSupplier> & {
    supplier_name: string;
    supplier_cost: number;
  };
  type Body = {
    order: Partial<FinanceOrder> & {
      id?: string;
      selling_price: number;
      customer_name: string;
    };
    suppliers: SupplierIn[];
  };
  const body = (await req.json()) as Body;
  if (!body?.order) {
    return NextResponse.json({ error: "Missing order body" }, { status: 400 });
  }
  const o = body.order;
  const suppliers = body.suppliers ?? [];

  const taxRefundValue = deriveTaxRefundValue(
    Number(o.selling_price) || 0,
    Number(o.tax_refund_pct) || 0,
    Number(o.tax_refund_value) || 0,
  );
  /* Currency stabilization — sales orders default to USD per the brief
     ("Sales: default form currency = USD"), but a non-base-currency
     SO is still allowed; the fallback only kicks in when the form
     truly omits the field. Supplier rows on the same order inherit
     the order's currency. */
  const salesDefaultCcy = "USD";
  const tenantBaseCcy = await resolveBaseCurrency(auth.tenant_id);
  void tenantBaseCcy;

  if (o.id) {
    /* UPDATE path */
    const { data: updated, error } = await supabaseServer
      .from("finance_orders")
      .update({
        order_no: o.order_no,
        customer_id: o.customer_id ?? null,
        customer_name: o.customer_name ?? "",
        order_date: o.order_date ?? new Date().toISOString().slice(0, 10),
        currency: o.currency ?? salesDefaultCcy,
        selling_price: Number(o.selling_price) || 0,
        tax_refund_pct: Number(o.tax_refund_pct) || 0,
        tax_refund_value: taxRefundValue,
        financial_charges: Number(o.financial_charges) || 0,
        expected_profit: o.expected_profit ?? null,
        status: o.status ?? "open",
        payment_status: o.payment_status ?? "unpaid",
        payment_due_date: o.payment_due_date ?? null,
        linked_quotation_id: o.linked_quotation_id ?? null,
        linked_invoice_id: o.linked_invoice_id ?? null,
        notes: o.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", o.id)
      .eq("tenant_id", auth.tenant_id)
      .select("*")
      .single();
    if (error) {
      console.error("[orders update]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    /* Replace supplier rows atomically. Simpler than diffing — Phase 2
       can switch to a proper upsert-then-delete-missing path.
       Phase S.2: tenant_id filter is defence-in-depth even though
       o.id was already tenant-verified in the SELECT a few lines up. */
    await supabaseServer
      .from("finance_order_suppliers")
      .delete()
      .eq("order_id", o.id)
      .eq("tenant_id", auth.tenant_id);
    if (suppliers.length) {
      const rows = suppliers.map((s) => ({
        tenant_id: auth.tenant_id,
        order_id: o.id!,
        supplier_id: s.supplier_id ?? null,
        supplier_name: s.supplier_name ?? "",
        supplier_cost: Number(s.supplier_cost) || 0,
        currency: s.currency ?? updated.currency ?? salesDefaultCcy,
        payment_status: s.payment_status ?? "unpaid",
        paid_amount: Number(s.paid_amount) || 0,
        due_date: s.due_date ?? null,
        notes: s.notes ?? null,
      }));
      const ins = await supabaseServer.from("finance_order_suppliers").insert(rows);
      if (ins.error) {
        console.error("[orders supplier insert]", ins.error.message);
        return NextResponse.json({ error: ins.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ order: updated });
  }

  /* INSERT path */
  const order_no = o.order_no || (await nextOrderNumber(auth.tenant_id));
  const { data: created, error } = await supabaseServer
    .from("finance_orders")
    .insert({
      tenant_id: auth.tenant_id,
      order_no,
      customer_id: o.customer_id ?? null,
      customer_name: o.customer_name ?? "",
      order_date: o.order_date ?? new Date().toISOString().slice(0, 10),
      currency: o.currency ?? tenantBaseCcy,
      selling_price: Number(o.selling_price) || 0,
      tax_refund_pct: Number(o.tax_refund_pct) || 0,
      tax_refund_value: taxRefundValue,
      financial_charges: Number(o.financial_charges) || 0,
      expected_profit: o.expected_profit ?? null,
      status: o.status ?? "open",
      payment_status: o.payment_status ?? "unpaid",
      payment_due_date: o.payment_due_date ?? null,
      linked_quotation_id: o.linked_quotation_id ?? null,
      linked_invoice_id: o.linked_invoice_id ?? null,
      notes: o.notes ?? null,
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[orders insert]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (suppliers.length) {
    const rows = suppliers.map((s) => ({
      tenant_id: auth.tenant_id,
      order_id: created.id,
      supplier_id: s.supplier_id ?? null,
      supplier_name: s.supplier_name ?? "",
      supplier_cost: Number(s.supplier_cost) || 0,
      currency: s.currency ?? created.currency ?? salesDefaultCcy,
      payment_status: s.payment_status ?? "unpaid",
      paid_amount: Number(s.paid_amount) || 0,
      due_date: s.due_date ?? null,
      notes: s.notes ?? null,
    }));
    const ins = await supabaseServer.from("finance_order_suppliers").insert(rows);
    if (ins.error) {
      console.error("[orders supplier insert]", ins.error.message);
      return NextResponse.json({ error: ins.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ order: created });
}
