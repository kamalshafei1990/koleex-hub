import "server-only";

/* ---------------------------------------------------------------------------
   /api/expenses  —  Operational expense entry API.

   This endpoint is the data backbone of the Expenses app at /expenses
   (separate from the Finance app at /finance). It READS and WRITES the
   SAME finance_expenses table that the Finance app uses — no second
   table, no duplication. The split is purely a UX + permissions one:

     · /api/finance/expenses    gated on "Finance" module access
                                used by the executive analytics view
     · /api/expenses            gated on "Expenses" module access
                                used by junior finance / admin staff
                                for fast daily entry

   Junior finance can be granted "Expenses" without "Finance", which
   keeps the executive numbers (net profit, margin, cash flow, etc.)
   out of their view while letting them log every expense.

   The shape of POST/GET mirrors /api/finance/expenses so any UI client
   can switch endpoints based on the user's role without code changes.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import type { FinanceExpense } from "@/lib/finance/types";
import { resolveBaseCurrency } from "@/lib/finance/currency";

interface JoinedExpense {
  category?: { name: string } | { name: string }[] | null;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Expenses");
  if (deny) return deny;

  const url = new URL(req.url);
  const categoryId = url.searchParams.get("category_id");
  const status = url.searchParams.get("status");
  const orderId = url.searchParams.get("order_id");
  const search = url.searchParams.get("search")?.trim();
  const fromDate = url.searchParams.get("from");
  const toDate   = url.searchParams.get("to");

  let q = supabaseServer
    .from("finance_expenses")
    .select("*, category:category_id(name)")
    .eq("tenant_id", auth.tenant_id);
  if (categoryId) q = q.eq("category_id", categoryId);
  if (status)     q = q.eq("payment_status", status);
  if (orderId)    q = q.eq("linked_order_id", orderId);
  if (search)     q = q.ilike("title", `%${search}%`);
  if (fromDate)   q = q.gte("expense_date", fromDate);
  if (toDate)     q = q.lte("expense_date", toDate);
  q = q.order("expense_date", { ascending: false }).order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const out = (data ?? []).map((row) => {
    const r = row as FinanceExpense & JoinedExpense;
    const cat = Array.isArray(r.category) ? r.category[0] : r.category;
    return { ...r, category_name: cat?.name ?? null };
  });
  return NextResponse.json({ expenses: out });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Expenses", "create");
  if (deny) return deny;

  const body = (await req.json()) as Partial<FinanceExpense> & { id?: string };
  if (!body.title?.trim() && !body.id) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }
  if ((Number(body.amount) || 0) <= 0 && !body.id) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  /* Currency fix: default to the tenant's base currency (CNY for
     Chinese tenants), not USD. The form is expected to send currency
     explicitly; this fallback only kicks in when it doesn't. */
  const baseCurrency = await resolveBaseCurrency(auth.tenant_id);
  const payload = {
    category_id: body.category_id ?? null,
    subcategory_id: body.subcategory_id ?? null,
    title: body.title ?? "",
    amount: Number(body.amount) || 0,
    currency: body.currency ?? baseCurrency,
    expense_date: body.expense_date ?? new Date().toISOString().slice(0, 10),
    payment_status: body.payment_status ?? "unpaid",
    due_date: body.due_date ?? null,
    linked_order_id: body.linked_order_id ?? null,
    linked_supplier_id: body.linked_supplier_id ?? null,
    linked_customer_id: body.linked_customer_id ?? null,
    linked_project_id: body.linked_project_id ?? null,
    attachment_url: body.attachment_url ?? null,
    notes: body.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  if (body.id) {
    const { data, error } = await supabaseServer
      .from("finance_expenses")
      .update(payload)
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ expense: data });
  }

  const { data, error } = await supabaseServer
    .from("finance_expenses")
    .insert({ ...payload, tenant_id: auth.tenant_id, created_by_account_id: auth.account_id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}
