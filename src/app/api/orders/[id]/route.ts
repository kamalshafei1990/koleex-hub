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

  const [quotations, invoices, contracts, packingLists, purchaseOrders, customer] = await Promise.all([
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
    supabaseServer
      .from("documents")
      .select("id, doc_no, title, status, total, currency, issue_date")
      .eq("order_id", id)
      .eq("doc_kind", "packing_list")
      .order("issue_date", { ascending: true }),
    supabaseServer
      .from("purchase_orders")
      .select("id, po_no, status, supplier_id, total, currency, order_date, expected_delivery_date")
      .eq("order_id", id)
      .order("order_date", { ascending: true }),
    order.customer_id
      ? supabaseServer
          .from("customers")
          .select("id, name, company_name, customer_code, email, phone, country")
          .eq("id", order.customer_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  /* The goods on the deal, taken from its LATEST invoice — what was actually
     sold, so a commercial invoice supersedes the proforma it replaced.

     Extracted HERE and reduced to four fields per line. The invoice's `doc`
     blob carries embedded product images and runs to megabytes; an order
     screen needs a description and a quantity, never the payload. */
  let goods: { description: string; model: string; qty: number; price: number }[] = [];
  let goodsFrom: string | null = null;
  {
    const { data: withDoc } = await supabaseServer
      .from("invoices")
      .select("inv_no, doc")
      .eq("order_id", id)
      .order("issue_date", { ascending: false })
      .limit(1);
    const inv = withDoc?.[0] as { inv_no: string | null; doc: Record<string, unknown> | null } | undefined;
    const items = Array.isArray(inv?.doc?.items) ? (inv!.doc!.items as Record<string, unknown>[]) : [];
    if (items.length > 0) {
      goodsFrom = inv?.inv_no ?? null;
      goods = items.map((it) => ({
        /* Every tag becomes a space — deleting them welds words together. */
        description:
          typeof it.description === "string"
            ? it.description.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
            : "",
        model: typeof it.model === "string" ? it.model : "",
        qty: Number(it.qty ?? 0) || 0,
        price: Number(it.unitPrice ?? 0) || 0,
      }));
    }
  }

  return NextResponse.json({
    order,
    goods,
    goodsFrom,
    quotations: quotations.data ?? [],
    invoices: invoices.data ?? [],
    contracts: contracts.data ?? [],
    packingLists: packingLists.data ?? [],
    purchaseOrders: purchaseOrders.data ?? [],
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
