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
    /* 200 (was 30): the create-dialogs' "Linked PO" pickers reuse this
       resource and previously loaded 200 via the anon client (RLS-4). */
    limit: 200,
    withSuppliers: true,
  },
  bills: {
    table: "vendor_bills",
    select: "id,bill_no,supplier_invoice_no,status,supplier_id,total,balance,currency,bill_date,due_date,created_at",
    order: [{ col: "created_at", ascending: false }],
    limit: 200,
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
  /* RLS-5: Returns + Contracts module tabs (previously anon-client reads). */
  returns: {
    table: "purchase_returns",
    select: "id,return_no,status,supplier_id,reason,total_value,refund_amount,currency,return_date,created_at",
    order: [{ col: "created_at", ascending: false }],
    limit: 30,
    withSuppliers: true,
  },
  contracts: {
    table: "supplier_contracts",
    select: "id,contract_no,title,supplier_id,start_date,end_date,total_value,currency,status",
    order: [{ col: "created_at", ascending: false }],
    limit: 30,
    withSuppliers: true,
  },
};

const SUPP_MIN = "id,display_name,company_name,full_name";

async function suppliersAll(tid: string) {
  const r = await supabaseServer
    .from("contacts")
    .select(SUPP_MIN)
    .eq("tenant_id", tid)
    .eq("contact_type", "supplier");
  return r.data ?? [];
}

/* Composite resources: joins / aggregates the generic spec can't express.
   Item child tables (vendor_bill_items, supplier_price_list_items) carry NO
   tenant_id, so they are scoped indirectly through their tenant-owned parents
   — this both tenant-isolates them and fixes the prior cross-tenant leak. */
async function buildComposite(
  key: string,
  tid: string,
): Promise<Record<string, unknown> | null> {
  switch (key) {
    case "payments": {
      const r = await supabaseServer
        .from("vendor_payments")
        .select("id,payment_no,bill_id,supplier_id,amount,currency,method,reference,paid_at,created_at")
        .eq("tenant_id", tid)
        .order("paid_at", { ascending: false, nullsFirst: false })
        .limit(50);
      const rows = (r.data ?? []) as { bill_id: string | null }[];
      const billIds = rows.map((p) => p.bill_id).filter((x): x is string => !!x);
      const [bR, suppliers] = await Promise.all([
        billIds.length
          ? supabaseServer.from("vendor_bills").select("id,bill_no").eq("tenant_id", tid).in("id", billIds)
          : Promise.resolve({ data: [] }),
        suppliersAll(tid),
      ]);
      return { rows, bills: bR.data ?? [], suppliers };
    }
    case "receipts": {
      const r = await supabaseServer
        .from("purchase_receipts")
        .select("id,gr_no,status,po_id,supplier_id,carrier,tracking_no,received_at,created_at")
        .eq("tenant_id", tid)
        .order("received_at", { ascending: false, nullsFirst: false })
        .limit(30);
      const rows = (r.data ?? []) as { po_id: string | null }[];
      const poIds = rows.map((x) => x.po_id).filter((x): x is string => !!x);
      const [pR, suppliers] = await Promise.all([
        poIds.length
          ? supabaseServer.from("purchase_orders").select("id,po_no").eq("tenant_id", tid).in("id", poIds)
          : Promise.resolve({ data: [] }),
        suppliersAll(tid),
      ]);
      return { rows, pos: pR.data ?? [], suppliers };
    }
    case "pricelists": {
      const [pR, suppliers] = await Promise.all([
        supabaseServer
          .from("supplier_price_lists")
          .select("id,supplier_id,name,currency,valid_from,valid_to,is_active,created_at")
          .eq("tenant_id", tid)
          .order("created_at", { ascending: false }),
        suppliersAll(tid),
      ]);
      const rows = (pR.data ?? []) as { id: string }[];
      const plIds = rows.map((r) => r.id);
      const iR = plIds.length
        ? await supabaseServer.from("supplier_price_list_items").select("price_list_id").in("price_list_id", plIds)
        : { data: [] };
      return { rows, items: iR.data ?? [], suppliers };
    }
    case "suppliers": {
      const [c, p] = await Promise.all([
        supabaseServer
          .from("contacts")
          .select("id,display_name,full_name,company_name,company_name_en,country,supplier_type,preferred_payment_method,rating,is_active,certifications")
          .eq("tenant_id", tid)
          .eq("contact_type", "supplier")
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(50),
        supabaseServer.from("vendor_payments").select("supplier_id,amount").eq("tenant_id", tid),
      ]);
      return { rows: c.data ?? [], payments: p.data ?? [] };
    }
    case "reports": {
      const billsR = await supabaseServer.from("vendor_bills").select("id").eq("tenant_id", tid);
      const billIds = ((billsR.data ?? []) as { id: string }[]).map((b) => b.id);
      const [pR, biR, cR, suppliers] = await Promise.all([
        supabaseServer.from("vendor_payments").select("amount,paid_at,created_at,supplier_id").eq("tenant_id", tid),
        billIds.length
          ? supabaseServer.from("vendor_bill_items").select("line_total,category_id").in("bill_id", billIds)
          : Promise.resolve({ data: [] }),
        supabaseServer.from("purchase_categories").select("id,name,kind").eq("tenant_id", tid),
        suppliersAll(tid),
      ]);
      return { payments: pR.data ?? [], billItems: biR.data ?? [], categories: cR.data ?? [], suppliers };
    }
    default:
      return null;
  }
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Purchase");
  if (deny) return deny;
  const tid = auth.tenant_id;

  const key = new URL(req.url).searchParams.get("resource") ?? "";

  /* RLS-4 picker resources for the create-dialogs (anon-client replacements). */
  if (key === "supplier_options") {
    return NextResponse.json({ rows: await suppliersAll(tid) });
  }
  if (key === "nextnos") {
    /* Suggested next doc numbers for all five dialogs in one call. */
    const yr = new Date().getFullYear();
    const nextNo = async (table: string, col: string, prefix: string) => {
      const { data } = await supabaseServer
        .from(table)
        .select(col)
        .eq("tenant_id", tid)
        .ilike(col, `${prefix}-${yr}-%`)
        .order(col, { ascending: false })
        .limit(1);
      const last = ((data?.[0] ?? {}) as Record<string, unknown>)[col] as string | undefined;
      const n = last ? (Number(last.split("-").pop()) || 0) + 1 : 1;
      return `${prefix}-${yr}-${String(n).padStart(4, "0")}`;
    };
    const [pr, po, gr, bill, pay] = await Promise.all([
      nextNo("purchase_requisitions", "pr_no", "PR"),
      nextNo("purchase_orders", "po_no", "PO"),
      nextNo("purchase_receipts", "gr_no", "GR"),
      nextNo("vendor_bills", "bill_no", "BILL"),
      nextNo("vendor_payments", "payment_no", "PAY"),
    ]);
    return NextResponse.json({ pr, po, gr, bill, pay });
  }

  const composite = await buildComposite(key, tid);
  if (composite) return NextResponse.json(composite);

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
