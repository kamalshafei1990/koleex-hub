import "server-only";

/* GET  /api/expenses/categories     gated on "Expenses" module
 * POST /api/expenses/categories     create a tenant-custom category
 *
 * Mirrors /api/finance/expense-categories so the Expenses app reads
 * the exact same category list a Finance user sees — both the system-
 * wide rows (tenant_id IS NULL) AND the tenant's own custom rows. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import type { ExpenseCategory } from "@/lib/finance/types";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Expenses");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("finance_expense_categories")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${auth.tenant_id}`)
    .order("is_system", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: (data ?? []) as ExpenseCategory[] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Expenses", "create");
  if (deny) return deny;
  const body = (await req.json()) as Partial<ExpenseCategory>;
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const { data, error } = await supabaseServer
    .from("finance_expense_categories")
    .insert({
      tenant_id: auth.tenant_id,
      parent_id: body.parent_id ?? null,
      name: body.name.trim(),
      icon: body.icon ?? null,
      is_system: false,
      sort_order: body.sort_order ?? 999,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}
