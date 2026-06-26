import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/purchase/list?resource=<key>

   Gated, tenant-scoped list feed for the Purchase module tabs. Each tab used to
   read its table directly via the anon supabaseAdmin client with no tenant
   filter (cross-tenant exposure). This serves the same rows server-side with
   the service-role client + requireModuleAccess("Purchase"), tenant-scoped.

   Returns { rows, suppliers } where `suppliers` is the raw supplier-contact
   rows (only for resources that render supplier names) so the client builds its
   id->name map exactly as before.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

type Spec = {
  table: string;
  select: string;
  order: { col: string; ascending?: boolean; nullsFirst?: boolean }[];
  limit?: number;
  withSuppliers?: boolean;
};

const RESOURCES: Record<string, Spec> = {
  orders: {
    table: "purchase_orders",
    select: "id,po_no,status,supplier_id,total,currency,order_date,expected_delivery_date,created_at",
    order: [{ col: "created_at", ascending: false }],
    limit: 30,
    withSuppliers: true,
  },
  bills: {
    table: "vendor_bills",
    select: "id,bill_no,supplier_invoice_no,status,supplier_id,total,balance,currency,bill_date,due_date,created_at",
    order: [{ col: "created_at", ascending: false }],
    limit: 30,
    withSuppliers: true,
  },
  requisitions: {
    table: "purchase_requisitions",
    select: "id,pr_no,status,department,priority,needed_by,total_estimated,currency,created_at",
    order: [{ col: "created_at", ascending: false }],
    limit: 30,
  },
  rfqs: {
    table: "purchase_rfqs",
    select: "id,rfq_no,status,supplier_id,total_estimated,response_due,sent_at,created_at",
    order: [{ col: "created_at", ascending: false }],
    limit: 30,
    withSuppliers: true,
  },
  approvals: {
    table: "purchase_approval_rules",
    select: "id,code,name,applies_to,min_amount_usd,max_amount_usd,approver_role,sort_order,is_active",
    order: [{ col: "applies_to" }, { col: "sort_order", ascending: true, nullsFirst: false }],
  },
  categories: {
    table: "purchase_categories",
    select: "id,code,name,kind,description,is_active",
    order: [{ col: "kind" }, { col: "name" }],
  },
};

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Purchase");
  if (deny) return deny;
  const tid = auth.tenant_id;

  const key = new URL(req.url).searchParams.get("resource") ?? "";
  const spec = RESOURCES[key];
  if (!spec) return NextResponse.json({ error: "Unknown resource" }, { status: 400 });

  let q = supabaseServer.from(spec.table).select(spec.select).eq("tenant_id", tid);
  for (const o of spec.order) {
    q = q.order(o.col, { ascending: o.ascending ?? true, nullsFirst: o.nullsFirst });
  }
  if (spec.limit) q = q.limit(spec.limit);

  const [rowsR, suppR] = await Promise.all([
    q,
    spec.withSuppliers
      ? supabaseServer
          .from("contacts")
          .select("id,display_name,company_name,full_name")
          .eq("tenant_id", tid)
          .eq("contact_type", "supplier")
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({ rows: rowsR.data ?? [], suppliers: suppR.data ?? [] });
}
