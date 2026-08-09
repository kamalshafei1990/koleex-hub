import "server-only";

/* GET  /api/sales/overview?module=quotations|invoices|orders|activities|forecast|contacts|payments
   POST /api/sales/overview   { action: "completeActivity", id }

   The Sales dashboard's seven panels. Each one used to read its table straight
   from the browser with the anon key — quotations, invoices, sales_orders,
   crm_activities, crm_opportunities, contacts, invoice_payments — and every
   one has RLS on with no anon policy. So all seven panels were permanently
   empty, and "mark activity done" did nothing.

   FOUR OF THEM ALSO ASKED FOR COLUMNS THAT DO NOT EXIST, which only became
   visible once the queries ran somewhere that reports its errors:

     quotations.customer_name   -> there is no such column; it is customer_id
     quotations.valid_until     -> valid_till
     invoices.invoice_no        -> inv_no
     invoices.customer_name     -> customer_id
     sales_orders.order_no      -> so_no
     sales_orders.total         -> does not exist at all
     sales_orders.expected_ship_date -> does not exist at all
     crm_activities.due_date    -> due_at
     crm_activities.is_done     -> done_at (a timestamp, not a flag)

   So the panels are mapped here, to the shape the cards already render, and
   the customer NAME is resolved server-side — the panels display a name and
   the table only stores an id. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

type Row = Record<string, unknown>;
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

const CACHE = { "Cache-Control": "private, max-age=30" };
const fail = (where: string, msg: string) => {
  console.error(`[api/sales/overview ${where}]`, msg);
  return NextResponse.json({ error: "Failed to load" }, { status: 500 });
};

/** id -> display name, for the customer ids on a page of rows. */
async function customerNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabaseServer
    .from("customers")
    .select("id, name, company_name")
    .in("id", unique);
  if (error) {
    console.error("[api/sales/overview customerNames]", error.message);
    return new Map();
  }
  return new Map(
    ((data ?? []) as Row[]).map((c) => [
      String(c.id),
      s(c.name) ?? s(c.company_name) ?? "",
    ]),
  );
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Sales");
  if (deny) return deny;

  const name = new URL(req.url).searchParams.get("module");
  const tenant = auth.tenant_id;
  const scoped = <T>(q: T): T => (tenant ? (q as { eq: (c: string, v: string) => T }).eq("tenant_id", tenant) : q);

  switch (name) {
    case "quotations": {
      const { data, error } = await scoped(
        supabaseServer
          .from("quotations")
          .select("id,quote_no,status,total,created_at,valid_till,customer_id"),
      ).order("created_at", { ascending: false }).limit(20);
      if (error) return fail("quotations", error.message);
      const rows = (data ?? []) as Row[];
      const names = await customerNames(rows.map((r) => String(r.customer_id ?? "")));
      return NextResponse.json({
        rows: rows.map((r) => ({
          id: r.id, quote_no: s(r.quote_no), status: s(r.status),
          customer_name: names.get(String(r.customer_id)) ?? null,
          total: num(r.total), created_at: r.created_at,
          valid_until: s(r.valid_till),
        })),
      }, { headers: CACHE });
    }

    case "invoices": {
      const { data, error } = await scoped(
        supabaseServer
          .from("invoices")
          .select("id,inv_no,status,total,balance,issued_at,due_date,created_at,customer_id"),
      ).order("created_at", { ascending: false }).limit(20);
      if (error) return fail("invoices", error.message);
      const rows = (data ?? []) as Row[];
      const names = await customerNames(rows.map((r) => String(r.customer_id ?? "")));
      return NextResponse.json({
        rows: rows.map((r) => ({
          id: r.id, invoice_no: s(r.inv_no), status: s(r.status),
          customer_name: names.get(String(r.customer_id)) ?? null,
          total: num(r.total), balance: num(r.balance),
          issued_at: s(r.issued_at), due_date: s(r.due_date), created_at: r.created_at,
        })),
      }, { headers: CACHE });
    }

    case "orders": {
      const { data, error } = await scoped(
        supabaseServer
          .from("sales_orders")
          .select("id,so_no,status,created_at,customer_id"),
      ).order("created_at", { ascending: false }).limit(20);
      if (error) return fail("orders", error.message);
      const rows = (data ?? []) as Row[];
      const names = await customerNames(rows.map((r) => String(r.customer_id ?? "")));
      /* sales_orders carries no total and no ship date — the card renders a
         dash for both rather than pretending it has a number. */
      return NextResponse.json({
        rows: rows.map((r) => ({
          id: r.id, order_no: s(r.so_no), status: s(r.status),
          customer_name: names.get(String(r.customer_id)) ?? null,
          total: null, created_at: r.created_at, expected_ship_date: null,
        })),
      }, { headers: CACHE });
    }

    case "activities": {
      const { data, error } = await scoped(
        supabaseServer
          .from("crm_activities")
          .select("id,title,type,due_at,done_at,opportunity_id"),
      ).is("done_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(30);
      if (error) return fail("activities", error.message);
      return NextResponse.json({
        rows: ((data ?? []) as Row[]).map((r) => ({
          id: r.id, title: s(r.title), type: s(r.type),
          due_date: s(r.due_at), is_done: r.done_at != null,
          opportunity_id: s(r.opportunity_id),
        })),
      }, { headers: CACHE });
    }

    case "forecast": {
      const { data, error } = await scoped(
        supabaseServer
          .from("crm_opportunities")
          .select("id,name,expected_revenue,probability,expected_close_date,won_at,lost_at"),
      ).is("lost_at", null).limit(500);
      if (error) return fail("forecast", error.message);
      return NextResponse.json({ rows: data ?? [] }, { headers: CACHE });
    }

    case "contacts": {
      const { data, error } = await scoped(
        supabaseServer
          .from("contacts")
          .select(
            "id,display_name,full_name,first_name,last_name,company_name,position,job_title," +
            "email,phone,mobile,country,city,contact_type,vip_status,strategic_account",
          ),
      ).eq("is_active", true).order("updated_at", { ascending: false, nullsFirst: false }).limit(50);
      if (error) return fail("contacts", error.message);
      return NextResponse.json({ rows: data ?? [] }, { headers: CACHE });
    }

    case "payments":
      return payments(tenant);

    default:
      return NextResponse.json({ error: "Unknown module" }, { status: 400 });
  }
}

/* Payments: the receipts, the invoices they belong to, and those invoices'
   customers — resolved here so the panel makes one request instead of three.
   invoice_payments has no tenant_id; it inherits tenancy from its invoice. */
async function payments(tenantId: string | null) {
  const { data: pays, error } = await supabaseServer
    .from("invoice_payments")
    .select("id,invoice_id,amount,currency,method,reference,received_at,created_at")
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) return fail("payments", error.message);

  const rows = (pays ?? []) as { invoice_id: string | null }[];
  const invIds = [...new Set(rows.map((p) => p.invoice_id).filter(Boolean))] as string[];

  const [invRes, custRes] = await Promise.all([
    invIds.length
      ? supabaseServer.from("invoices").select("id,inv_no,customer_id").in("id", invIds)
      : Promise.resolve({ data: [], error: null }),
    (() => {
      let c = supabaseServer.from("customers").select("id,name,company_name");
      if (tenantId) c = c.eq("tenant_id", tenantId);
      return c;
    })(),
  ]);
  if (invRes.error) console.error("[api/sales/overview payments invoices]", invRes.error.message);
  if (custRes.error) console.error("[api/sales/overview payments customers]", custRes.error.message);

  return NextResponse.json(
    { rows, invoices: invRes.data ?? [], customers: custRes.data ?? [] },
    { headers: CACHE },
  );
}

/* POST — the one write these panels do: tick an activity off. `done_at` IS the
   flag; there is no is_done column, and the browser version wrote to both
   is_done and completed_at, neither of which exists. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Sales");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { action?: string; id?: string } | null;
  if (body?.action !== "completeActivity" || !body.id) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  let q = supabaseServer
    .from("crm_activities")
    .update({ done_at: new Date().toISOString() })
    .eq("id", body.id);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { error } = await q;
  if (error) {
    console.error("[api/sales/overview completeActivity]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
