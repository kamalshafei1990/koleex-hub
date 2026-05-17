import "server-only";

/* ===========================================================================
   POST /api/finance/fx/exchange   record a bank-to-bank FX exchange
   GET  /api/finance/fx/exchange   list recent exchanges
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { recordFxExchange } from "@/lib/finance/currency";

interface ExchangeBody {
  exchange_date: string;
  from_bank_id: string;
  to_bank_id: string;
  from_currency: string;
  to_currency: string;
  from_amount: number;
  to_amount: number;
  notes?: string | null;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("finance_fx_exchanges")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("exchange_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ exchanges: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as ExchangeBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const r = await recordFxExchange({
    tenantId: auth.tenant_id,
    exchangeDate: body.exchange_date || new Date().toISOString().slice(0, 10),
    fromBankId: body.from_bank_id,
    toBankId:   body.to_bank_id,
    fromCurrency: body.from_currency,
    toCurrency:   body.to_currency,
    fromAmount: Number(body.from_amount),
    toAmount:   Number(body.to_amount),
    notes: body.notes ?? null,
    createdBy: auth.account_id,
  });
  if (!r.ok) return NextResponse.json(r, { status: r.code ?? 500 });
  return NextResponse.json(r);
}
