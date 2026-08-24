import "server-only";

/* ---------------------------------------------------------------------------
   /api/orders/[id] — one deal and everything raised against it.

   GET    the order, its documents, and the customer it was struck with
   PATCH  status and notes

   Same one-request rule as the list: the three document tables are read in
   parallel here rather than by three client fetches.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

const MODULE = "Orders";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const { id } = await params;

  const { data: order } = await supabaseServer
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const [quotations, invoices, contracts, customer] = await Promise.all([
    supabaseServer
      .from("quotations")
      .select("id, quote_no, status, total, currency, created_at, updated_at")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
    supabaseServer
      .from("invoices")
      .select("id, inv_no, status, total, currency, issue_date, due_date, amount_paid, balance")
      .eq("order_id", id)
      .order("issue_date", { ascending: true }),
    supabaseServer
      .from("sales_contracts")
      .select("id, contract_no, status, total, currency, contract_date, signed_at, terms_version")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
    order.customer_id
      ? supabaseServer
          .from("customers")
          .select("id, name, company_name, customer_code, email, phone, country")
          .eq("id", order.customer_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    order,
    quotations: quotations.data ?? [],
    invoices: invoices.data ?? [],
    contracts: contracts.data ?? [],
    customer: (customer as { data: unknown }).data ?? null,
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "edit");
  if (deny) return deny;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { status?: string; notes?: string | null } | null;
  if (!body) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.status !== undefined) {
    const allowed = ["open", "shipped", "closed", "cancelled"];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: `Unknown status "${body.status}".` }, { status: 400 });
    }
    patch.status = body.status;
  }

  const { data, error } = await supabaseServer
    .from("orders")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
