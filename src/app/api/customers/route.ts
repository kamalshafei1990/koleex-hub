import "server-only";

/* GET  /api/customers              list customers
   POST /api/customers              create a customer

   Single endpoint for the SmartCreate flow. Existing surfaces continue
   to use /api/finance/customers (which reads + aggregates), but writes
   land here so the SmartCreate page has one canonical target.
*/

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
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

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;
  const { data, error } = await supabaseServer.from("customers")
    .select("id, name, company_name, country, email, phone, customer_type, status, currency_code, payment_terms")
    .eq("tenant_id", auth.tenant_id).order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customers: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Customers");
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
