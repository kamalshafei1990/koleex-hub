import "server-only";

/* ---------------------------------------------------------------------------
   /api/orders/[id]/purchase-orders

   GET — everything the "raise a purchase order" dialog needs, in ONE request:
         the suppliers to choose from, and the deal's goods to start from.

   There is no POST here on purpose. Creating the PO stays with
   /api/purchase/orders, which already tallies line totals server-side "so the
   client can't lie", handles currency defaults, and writes the items. A second
   creation path would be a second set of those rules to keep in step.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

type Params = { params: Promise<{ id: string }> };

/** Item descriptions carry editor markup; a PO line is plain text. Every tag
    becomes a space — deleting them welds words together. */
function plainText(html: unknown): string {
  if (typeof html !== "string") return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Both modules are involved: the deal is an Orders record, the purchase is
     a Purchase record, and a person raising one needs to be allowed both. */
  const denyOrders = await requireModuleAccess(auth, "Orders");
  if (denyOrders) return denyOrders;
  const denyPurchase = await requireModuleAccess(auth, "Purchase");
  if (denyPurchase) return denyPurchase;

  const { id } = await params;

  const { data: order } = await supabaseServer
    .from("orders")
    .select("id, deal_no, order_no, currency")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const [invoiceRes, suppliersRes, existingRes] = await Promise.all([
    /* The goods to source come from the deal's invoice — what was actually
       sold, not what was once quoted. The latest one wins: a commercial
       invoice supersedes the proforma it replaced. */
    supabaseServer
      .from("invoices")
      .select("id, inv_no, doc")
      .eq("order_id", id)
      .order("issue_date", { ascending: false })
      .limit(1),
    /* ⚠️ purchase_orders.supplier_id is a foreign key to CONTACTS, not to the
       `suppliers` table. Listing `suppliers` here handed the dialog ids that
       every PO insert then rejected with a foreign-key violation. This is the
       same source the Purchases app's own dialog uses. */
    supabaseServer
      .from("contacts")
      .select("id, display_name, company_name, full_name")
      .eq("tenant_id", auth.tenant_id)
      .eq("contact_type", "supplier")
      .order("display_name", { ascending: true })
      .limit(500),
    supabaseServer
      .from("purchase_orders")
      .select("id, po_no, status, supplier_id, total, currency, order_date, expected_delivery_date")
      .eq("order_id", id)
      .order("order_date", { ascending: true }),
  ]);

  const invoice = invoiceRes.data?.[0] as { inv_no: string | null; doc: Record<string, unknown> | null } | undefined;
  const rawItems = Array.isArray(invoice?.doc?.items) ? (invoice!.doc!.items as Record<string, unknown>[]) : [];

  /* Quantities and descriptions carry over; UNIT COST DOES NOT. What Koleex
     sells a machine for is not what it pays for one, and prefilling the sale
     price as a purchase cost would quietly invent a zero-margin PO. The buyer
     fills the cost, which is the one number they are there to decide. */
  const suggestedItems = rawItems.map((it, i) => ({
    description: plainText(it.description) || String(it.model ?? ""),
    model: typeof it.model === "string" ? it.model : "",
    qty: Number(it.qty ?? 0) || 0,
    unit: "pc",
    unit_cost: 0,
    sort_order: i,
  }));

  return NextResponse.json({
    order,
    fromInvoice: invoice?.inv_no ?? null,
    suggestedItems,
    suppliers: suppliersRes.data ?? [],
    purchaseOrders: existingRes.data ?? [],
  });
}
