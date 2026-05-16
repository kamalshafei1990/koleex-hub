import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { FinanceExpense } from "@/lib/finance/types";

interface RouteRow {
  category?: { name: string } | null;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const categoryId = url.searchParams.get("category_id");
  const status = url.searchParams.get("status");
  const orderId = url.searchParams.get("order_id");
  const search = url.searchParams.get("search")?.trim();

  /* Phase S.4 — list bound. Default cap 500, override via ?limit up
     to 2000. The expense ledger grows with every paid invoice; a
     three-year-old tenant returned 30 K+ rows before this. */
  const reqLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(reqLimit) && reqLimit > 0 ? Math.min(reqLimit, 2000) : 500;

  let q = supabaseServer
    .from("finance_expenses")
    .select("*, category:category_id(name)")
    .eq("tenant_id", auth.tenant_id);
  if (categoryId) q = q.eq("category_id", categoryId);
  if (status) q = q.eq("payment_status", status);
  if (orderId) q = q.eq("linked_order_id", orderId);
  if (search) q = q.ilike("title", `%${search}%`);
  q = q.order("expense_date", { ascending: false }).limit(limit);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const out = (data ?? []).map((row) => {
    const r = row as FinanceExpense & RouteRow;
    return { ...r, category_name: r.category?.name ?? null };
  });
  return NextResponse.json({ expenses: out });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json()) as Partial<FinanceExpense> & { id?: string };
  const payload = {
    category_id: body.category_id ?? null,
    subcategory_id: body.subcategory_id ?? null,
    title: body.title ?? "",
    amount: Number(body.amount) || 0,
    currency: body.currency ?? "USD",
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
    .insert({
      ...payload,
      tenant_id: auth.tenant_id,
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}
