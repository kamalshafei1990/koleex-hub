import "server-only";

/* ---------------------------------------------------------------------------
   /api/orders — the deal list.

   ── One request, not five ──────────────────────────────────────────────────
   An order is only interesting alongside the documents raised against it, and
   the list has to show which of them exist. The obvious client-side shape —
   fetch orders, then fetch each document type — is four round-trips, and on
   this Hub a round-trip costs about a second. So the fan-out happens here,
   server-side and in parallel, and the client makes one call.

   ── No blobs ───────────────────────────────────────────────────────────────
   Documents carry a `doc` jsonb that can run to megabytes with embedded
   images. A list needs a number and a status, never the payload. Every select
   below names its columns.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const MODULE = "Orders";

export interface OrderDocSummary {
  id: string;
  number: string | null;
  status: string | null;
  total: number | null;
  currency: string | null;
  date: string | null;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const search = url.searchParams.get("search")?.trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200) || 200, 1), 500);

  let q = supabaseServer
    .from("orders")
    .select(
      "id, deal_no, order_no, customer_id, customer_code, customer_name, company_name, status, currency, total, notes, created_at, updated_at",
    )
    .eq("tenant_id", auth.tenant_id)
    .order("deal_no", { ascending: false })
    .limit(limit);

  if (status !== "all") q = q.eq("status", status);
  if (search) {
    q = q.or(
      `order_no.ilike.%${search}%,customer_name.ilike.%${search}%,company_name.ilike.%${search}%,customer_code.ilike.%${search}%`,
    );
  }

  const { data: orders, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (orders ?? []).map((o) => o.id as string);
  if (ids.length === 0) return NextResponse.json({ orders: [], documents: {} });

  const [quotes, invoices, contracts, packingLists, purchaseOrders] = await Promise.all([
    supabaseServer
      .from("quotations")
      .select("id, order_id, quote_no, status, total, currency, created_at")
      .in("order_id", ids),
    supabaseServer
      .from("invoices")
      .select("id, order_id, inv_no, status, total, currency, issue_date")
      .in("order_id", ids),
    supabaseServer
      .from("sales_contracts")
      .select("id, order_id, contract_no, status, total, currency, contract_date")
      .in("order_id", ids),
    /* The packing list lives in the Documents store, not a table of its own —
       it always did, and linking it beat rebuilding it. */
    supabaseServer
      .from("documents")
      .select("id, order_id, doc_no, status, total, currency, issue_date")
      .eq("doc_kind", "packing_list")
      .in("order_id", ids),
    /* The sourcing side of the deal — what Koleex bought to fill it. */
    supabaseServer
      .from("purchase_orders")
      .select("id, order_id, po_no, status, total, currency, order_date")
      .in("order_id", ids),
  ]);

  /* Keyed by order id so the client renders without searching arrays per row. */
  const documents: Record<
    string,
    {
      quotations: OrderDocSummary[];
      invoices: OrderDocSummary[];
      contracts: OrderDocSummary[];
      packingLists: OrderDocSummary[];
      purchaseOrders: OrderDocSummary[];
    }
  > = {};
  for (const id of ids) documents[id] = { quotations: [], invoices: [], contracts: [], packingLists: [], purchaseOrders: [] };

  for (const r of quotes.data ?? []) {
    const o = documents[r.order_id as string];
    if (o) o.quotations.push({ id: r.id as string, number: r.quote_no as string, status: r.status as string, total: r.total as number, currency: r.currency as string, date: r.created_at as string });
  }
  for (const r of invoices.data ?? []) {
    const o = documents[r.order_id as string];
    if (o) o.invoices.push({ id: r.id as string, number: r.inv_no as string, status: r.status as string, total: r.total as number, currency: r.currency as string, date: r.issue_date as string });
  }
  for (const r of contracts.data ?? []) {
    const o = documents[r.order_id as string];
    if (o) o.contracts.push({ id: r.id as string, number: r.contract_no as string, status: r.status as string, total: r.total as number, currency: r.currency as string, date: r.contract_date as string });
  }

  for (const r of packingLists.data ?? []) {
    const o = documents[r.order_id as string];
    if (o) o.packingLists.push({ id: r.id as string, number: r.doc_no as string, status: r.status as string, total: r.total as number, currency: r.currency as string, date: r.issue_date as string });
  }

  for (const r of purchaseOrders.data ?? []) {
    const o = documents[r.order_id as string];
    if (o) o.purchaseOrders.push({ id: r.id as string, number: r.po_no as string, status: r.status as string, total: r.total as number, currency: r.currency as string, date: r.order_date as string });
  }

  return NextResponse.json({ orders: orders ?? [], documents });
}
