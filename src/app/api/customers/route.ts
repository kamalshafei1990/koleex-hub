import "server-only";

/* GET  /api/customers              list customers
   POST /api/customers              create a customer

   Single endpoint for the SmartCreate flow. Existing surfaces continue
   to use /api/finance/customers (which reads + aggregates), but writes
   land here so the SmartCreate page has one canonical target.
*/

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
interface PostBody {
  name?: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  customer_type?: string | null;
  payment_terms?: string | null;
  currency_code?: string | null;
  notes?: string | null;
  status?: string | null;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;

  /* ?market=<name> — the Markets app's per-market customer list. It used to
     run this exact or-filter from the BROWSER against `customers`, a table the
     browser cannot read, so every market showed an empty customer list. It
     needs the full row (the panel renders more than the picker's columns), so
     this branch selects * while the default list keeps its slim projection. */
  const market = new URL(req.url).searchParams.get("market")?.trim();
  const marketId = new URL(req.url).searchParams.get("marketId")?.trim();
  if (market || marketId) {
    /* Escape the PostgREST or-grammar's delimiters before interpolating a
       user-supplied name into the expression. */
    const safe = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    /* `market_id` is a UUID column. The browser version compared it to a
        SLUG built from the market's display name — "china" — so Postgres
        raised `invalid input syntax for type uuid` and the whole or-filter
        failed. The name matches on `country`; the id, when the caller has a
        real one, matches on market_id. */
    const terms: string[] = [];
    if (marketId && /^[0-9a-f-]{36}$/i.test(marketId)) terms.push(`market_id.eq.${marketId}`);
    if (market) terms.push(`country.ilike."%${safe(market)}%"`);
    let q = supabaseServer.from("customers").select("*").eq("tenant_id", auth.tenant_id);
    q = terms.length > 1 ? q.or(terms.join(",")) : q.or(terms[0]);
    const { data, error } = await q.limit(100);
    if (error) {
      console.error("[api/customers market]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ customers: data ?? [] });
  }

  const { data, error } = await supabaseServer.from("customers")
    .select("id, name, company_name, country, email, phone, customer_type, status, currency_code, payment_terms")
    .eq("tenant_id", auth.tenant_id).order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customers: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Customers", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const { data, error } = await supabaseServer.from("customers").insert({
    tenant_id: auth.tenant_id,
    name: body.name.trim(),
    company_name: body.company_name ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    country: body.country ?? null,
    city: body.city ?? null,
    customer_type: body.customer_type ?? "wholesale",
    payment_terms: body.payment_terms ?? null,
    currency_code: body.currency_code ?? null,
    notes: body.notes ?? null,
    status: body.status ?? "active",
    is_active: true,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customer: data });
}
