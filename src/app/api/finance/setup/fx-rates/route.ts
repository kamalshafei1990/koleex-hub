import "server-only";

/* ===========================================================================
   GET  /api/finance/setup/fx-rates       — list rates (recent first)
   POST /api/finance/setup/fx-rates       — add a rate
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

interface RateBody {
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date?: string;
  notes?: string | null;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("finance_fx_rates")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("effective_date", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rates: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as RateBody | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  const from = body.from_currency?.trim().toUpperCase();
  const to   = body.to_currency?.trim().toUpperCase();
  if (!from || !to || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    return NextResponse.json({ error: "from_currency and to_currency must be 3-letter ISO codes" }, { status: 400 });
  }
  if (from === to) return NextResponse.json({ error: "from and to must be different currencies" }, { status: 400 });
  const rate = Number(body.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json({ error: "rate must be a positive number" }, { status: 400 });
  }
  const effective = body.effective_date || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseServer
    .from("finance_fx_rates")
    .insert({
      tenant_id: auth.tenant_id,
      from_currency: from, to_currency: to,
      rate, effective_date: effective,
      notes: body.notes?.trim() || null,
      created_by: auth.account_id,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "A rate for this pair on this date already exists" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rate: data });
}
