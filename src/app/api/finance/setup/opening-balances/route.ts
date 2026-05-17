import "server-only";

/* ===========================================================================
   GET  /api/finance/setup/opening-balances        — list all OB entries
   POST /api/finance/setup/opening-balances        — append one entry

   The setup dashboard reads this list to populate every card except
   Bank Accounts, Assets, FX Rates, and Base Currency. Each row is
   purely operator-entered intent — posting these to the ledger is a
   manual journal step in the Accounting Queue.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

const ALLOWED_CATEGORIES = [
  "cash", "owner_capital", "loan",
  "customer_receivable", "supplier_payable",
  "fixed_asset", "inventory", "other",
] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

interface OpeningBody {
  category: Category;
  label: string;
  amount: number;
  currency?: string;
  customer_id?: string | null;
  supplier_id?: string | null;
  notes?: string | null;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  let q = supabaseServer
    .from("finance_opening_balances")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as OpeningBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  if (!(ALLOWED_CATEGORIES as readonly string[]).includes(body.category)) {
    return NextResponse.json({ error: "category not allowed" }, { status: 400 });
  }
  if (!body.label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("finance_opening_balances")
    .insert({
      tenant_id: auth.tenant_id,
      category: body.category,
      label: body.label.trim(),
      amount,
      currency: body.currency?.trim().toUpperCase() || "USD",
      customer_id: body.customer_id || null,
      supplier_id: body.supplier_id || null,
      notes: body.notes?.trim() || null,
      created_by: auth.account_id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}
