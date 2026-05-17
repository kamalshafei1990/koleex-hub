import "server-only";

/* GET  /api/finance/fx/rates    list all configured rates for tenant
   POST /api/finance/fx/rates    upsert a rate row { from, to, rate, effective_date }
   DELETE /api/finance/fx/rates?id=…   remove a single rate row */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const { data, error } = await supabaseServer.from("finance_fx_rates")
    .select("id, from_currency, to_currency, rate, effective_date, created_at, notes")
    .eq("tenant_id", auth.tenant_id)
    .order("effective_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rates: data ?? [] });
}

interface PostBody {
  from_currency?: string; to_currency?: string;
  rate?: number; effective_date?: string; notes?: string | null;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body?.from_currency || !body.to_currency || !body.rate || !body.effective_date) {
    return NextResponse.json({ error: "from_currency, to_currency, rate, effective_date are required." }, { status: 400 });
  }
  if (Number(body.rate) <= 0) {
    return NextResponse.json({ error: "rate must be > 0." }, { status: 400 });
  }
  if (body.from_currency.toUpperCase() === body.to_currency.toUpperCase()) {
    return NextResponse.json({ error: "from and to currencies must differ." }, { status: 400 });
  }

  const { data, error } = await supabaseServer.from("finance_fx_rates").insert({
    tenant_id: auth.tenant_id,
    from_currency: body.from_currency.toUpperCase(),
    to_currency: body.to_currency.toUpperCase(),
    rate: Number(body.rate),
    effective_date: body.effective_date,
    notes: body.notes ?? null,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rate: data });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabaseServer.from("finance_fx_rates")
    .delete().eq("id", id).eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
