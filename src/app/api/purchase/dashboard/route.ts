import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/purchase/dashboard

   Server-side aggregation feed for the Purchase home dashboard. Returns the
   raw recent rows the client computes its KPIs/feed from. Runs with the
   service-role client + requireModuleAccess("Purchase") and is tenant-scoped —
   the previous client-side anon reads were NOT tenant-filtered (they relied on
   a permissive RLS policy and returned cross-tenant rows). This both closes
   that exposure and corrects the dashboard to the caller's tenant.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Purchase");
  if (deny) return deny;
  const tid = auth.tenant_id;

  const [posR, billsR, paymentsR, reqsR, rfqsR, receiptsR, suppR] = await Promise.all([
    supabaseServer.from("purchase_orders").select("id,po_no,supplier_id,status,total,expected_delivery_date,order_date,created_at").eq("tenant_id", tid).order("created_at", { ascending: false }).limit(100),
    supabaseServer.from("vendor_bills").select("id,bill_no,supplier_id,status,total,balance,due_date,bill_date,created_at").eq("tenant_id", tid).order("created_at", { ascending: false }).limit(100),
    supabaseServer.from("vendor_payments").select("id,supplier_id,amount,paid_at,created_at").eq("tenant_id", tid).order("paid_at", { ascending: false, nullsFirst: false }).limit(100),
    supabaseServer.from("purchase_requisitions").select("id,pr_no,status,total_estimated,created_at").eq("tenant_id", tid).order("created_at", { ascending: false }).limit(50),
    supabaseServer.from("purchase_rfqs").select("id,rfq_no,status,supplier_id,total_estimated,created_at").eq("tenant_id", tid).order("created_at", { ascending: false }).limit(50),
    supabaseServer.from("purchase_receipts").select("id,gr_no,po_id,status,created_at").eq("tenant_id", tid).order("created_at", { ascending: false }).limit(50),
    supabaseServer.from("contacts").select("id,supplier_type,is_active").eq("tenant_id", tid).eq("contact_type", "supplier"),
  ]);

  return NextResponse.json({
    pos: posR.data ?? [],
    bills: billsR.data ?? [],
    payments: paymentsR.data ?? [],
    reqs: reqsR.data ?? [],
    rfqs: rfqsR.data ?? [],
    receipts: receiptsR.data ?? [],
    supps: suppR.data ?? [],
  });
}
