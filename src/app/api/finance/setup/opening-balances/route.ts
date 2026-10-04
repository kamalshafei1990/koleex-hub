import "server-only";

/* ===========================================================================
   GET  /api/finance/setup/opening-balances        — list all OB entries
   POST /api/finance/setup/opening-balances        — append one entry AND
        post it to the ledger against Owner Capital (3000)

   Before, an opening balance was a note the setup dashboard displayed and
   the books never heard of: the balance sheet opened at zero. Now each
   category maps to its ledger account and the row is posted at once,
   idempotently (the row id is the journal's source id). Owner capital is
   the balancing side of every other line, so it is recorded but never
   posted on its own.

   Who sees and writes which line (src/lib/experience, openingCategoryRefusal):
   cash, owner capital, loans and other need «Bank & Profit»; the inventory
   opening needs the private-records switch; what customers owe, what is owed
   to suppliers and fixed assets stay open. A hidden line goes out with amount
   0 and amount_hidden, and is not added by such a caller. Guarded by
   validate:finance-perf §G.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency } from "@/lib/finance/currency";
import { postOpeningBalance } from "@/lib/accounting/posting";
import { canSeeBankAndProfit, canSeeCostData, hideOpeningAmount, openingCategoryRefusal } from "@/lib/experience";

const ALLOWED_CATEGORIES = [
  "cash", "owner_capital", "loan",
  "customer_receivable", "supplier_payable",
  "fixed_asset", "inventory", "other",
] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

/** Ledger account each opening category lands on; null = balancing side only. */
const OPENING_ACCOUNT_CODE: Record<Category, string | null> = {
  cash: "1010",
  owner_capital: null,
  loan: "2100",
  customer_receivable: "1100",
  supplier_payable: "2000",
  fixed_asset: "1500",
  inventory: "1400",
  other: "1300",
};

interface OpeningBody {
  category: Category;
  label: string;
  amount: number;
  currency?: string;
  as_of?: string | null;
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
  const [{ data, error }, bankAndProfit] = await Promise.all([q, canSeeBankAndProfit(auth)]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const can = { bankAndProfit, cost: canSeeCostData(auth) };
  const entries = ((data ?? []) as Array<{ category: string }>).map((r) =>
    openingCategoryRefusal(r.category, can) ? hideOpeningAmount(r) : r);
  /* For the asked category, so a drawer with no lines yet knows too. */
  return NextResponse.json({ entries, amounts_hidden: category ? openingCategoryRefusal(category, can) !== null : undefined });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as OpeningBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  if (!(ALLOWED_CATEGORIES as readonly string[]).includes(body.category)) {
    return NextResponse.json({ error: "category not allowed" }, { status: 400 });
  }
  const refusal = openingCategoryRefusal(body.category, { bankAndProfit: await canSeeBankAndProfit(auth), cost: canSeeCostData(auth) });
  if (refusal) {
    return NextResponse.json({
      error: refusal === "needs_bank_profit"
        ? "These opening figures are set only with «Bank & Profit» in Roles & Permissions."
        : "Inventory opening values are set only with «Can see private data» in Roles & Permissions.",
      code: refusal,
    }, { status: 403 });
  }
  if (!body.label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }
  const asOf = body.as_of && /^\d{4}-\d{2}-\d{2}$/.test(body.as_of) ? body.as_of : undefined;

  const baseCurrency = await resolveBaseCurrency(auth.tenant_id);
  const currency = body.currency?.trim().toUpperCase() || baseCurrency;
  const { data, error } = await supabaseServer
    .from("finance_opening_balances")
    .insert({
      tenant_id: auth.tenant_id,
      category: body.category,
      label: body.label.trim(),
      amount,
      currency,
      customer_id: body.customer_id || null,
      supplier_id: body.supplier_id || null,
      notes: body.notes?.trim() || null,
      created_by: auth.account_id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const code = OPENING_ACCOUNT_CODE[body.category];
  let posting: { ok: boolean; error?: string; journal_no?: string } = { ok: true };
  if (code && amount > 0) {
    const r = await postOpeningBalance(
      { tenantId: auth.tenant_id, postedByAccountId: auth.account_id },
      {
        accountCode: code,
        amount,
        currency,
        entryDate: asOf,
        description: `Opening balance — ${body.label.trim()}`,
        openingId: (data as { id: string }).id,
        partyId: body.customer_id || body.supplier_id || null,
        partyType: body.customer_id ? "customer" : body.supplier_id ? "supplier" : null,
      },
    );
    posting = r.ok ? { ok: true, journal_no: r.journal_no } : { ok: false, error: r.error };
  }
  return NextResponse.json({ entry: data, posting }, { status: posting.ok ? 200 : 207 });
}
