import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/purchase/create — RLS-4: server-side create for every Purchase
   "New X" dialog (requisition / order / receipt / bill / payment).

   Replaces the dialogs' direct anon-client inserts so purchase_* / vendor_*
   tables can be locked to service_role. One route, one `kind` switch:
     · tenant_id enforced from the session (never client-supplied)
     · doc numbers generated server-side when the client leaves them blank
     · parent + single line item written together
     · payment optionally settles its bill (balance/amount_paid/status)
       computed from the DB row, not client-supplied figures
   Gate: requireModuleAction("Purchase","create").
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

type Body = {
  kind: "requisition" | "order" | "receipt" | "bill" | "payment";
  doc: Record<string, unknown>;
  item?: Record<string, unknown> | null;
};

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

/** Next "PREFIX-YYYY-NNNN" per tenant. Same heuristic the dialogs used,
 *  but tenant-scoped and on the service client. */
async function nextDocNo(
  tenantId: string,
  table: string,
  col: string,
  prefix: string,
): Promise<string> {
  const yr = new Date().getFullYear();
  const { data } = await supabaseServer
    .from(table)
    .select(col)
    .eq("tenant_id", tenantId)
    .ilike(col, `${prefix}-${yr}-%`)
    .order(col, { ascending: false })
    .limit(1);
  const last = ((data?.[0] ?? {}) as Record<string, unknown>)[col] as string | undefined;
  const n = last ? (Number(last.split("-").pop()) || 0) + 1 : 1;
  return `${prefix}-${yr}-${String(n).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Purchase", "create");
  if (deny) return deny;
  const tid = auth.tenant_id;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const doc = body.doc ?? {};
  const item = body.item ?? null;

  try {
    switch (body.kind) {
      case "requisition": {
        const pr_no = str(doc.pr_no) ?? (await nextDocNo(tid, "purchase_requisitions", "pr_no", "PR"));
        const { data: created, error } = await supabaseServer
          .from("purchase_requisitions")
          .insert({
            tenant_id: tid,
            pr_no,
            department: str(doc.department),
            priority: num(doc.priority) || 1,
            needed_by: str(doc.needed_by),
            justification: str(doc.justification),
            currency: str(doc.currency) ?? "USD",
            total_estimated: num(doc.total_estimated),
            status: "draft",
          })
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "Insert failed");
        if (item) {
          await supabaseServer.from("purchase_requisition_items").insert({
            requisition_id: created.id,
            product_id: str(item.product_id),
            description: str(item.description),
            category_id: str(item.category_id),
            qty: num(item.qty),
            unit: str(item.unit) ?? "pc",
            estimated_price: num(item.estimated_price),
          });
        }
        return NextResponse.json({ ok: true, id: created.id, docNo: pr_no });
      }

      case "order": {
        const supplier_id = str(doc.supplier_id);
        if (!supplier_id) return NextResponse.json({ error: "supplier_id required" }, { status: 400 });
        const po_no = str(doc.po_no) ?? (await nextDocNo(tid, "purchase_orders", "po_no", "PO"));
        const lineTotal = num(item?.qty) * num(item?.unit_cost);
        const { data: created, error } = await supabaseServer
          .from("purchase_orders")
          .insert({
            tenant_id: tid,
            po_no,
            supplier_id,
            order_date: str(doc.order_date) ?? new Date().toISOString().slice(0, 10),
            expected_delivery_date: str(doc.expected_delivery_date),
            currency: str(doc.currency) ?? "USD",
            payment_terms: str(doc.payment_terms),
            incoterms: str(doc.incoterms),
            ship_to_address: str(doc.ship_to_address),
            category_id: str(doc.category_id),
            notes: str(doc.notes),
            subtotal: lineTotal,
            total: lineTotal,
            status: "draft",
          })
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "Insert failed");
        if (item) {
          await supabaseServer.from("purchase_order_items").insert({
            po_id: created.id,
            product_id: str(item.product_id),
            description: str(item.description),
            category_id: str(item.category_id),
            qty: num(item.qty),
            unit: str(item.unit) ?? "pc",
            unit_cost: num(item.unit_cost),
            line_total: lineTotal,
          });
        }
        return NextResponse.json({ ok: true, id: created.id, docNo: po_no });
      }

      case "receipt": {
        const gr_no = str(doc.gr_no) ?? (await nextDocNo(tid, "purchase_receipts", "gr_no", "GR"));
        const { data: created, error } = await supabaseServer
          .from("purchase_receipts")
          .insert({
            tenant_id: tid,
            gr_no,
            po_id: str(doc.po_id),
            supplier_id: str(doc.supplier_id),
            received_at: str(doc.received_at) ? new Date(String(doc.received_at)).toISOString() : null,
            carrier: str(doc.carrier),
            tracking_no: str(doc.tracking_no),
            notes: str(doc.notes),
            status: (str(doc.status) ?? "complete") as "draft" | "partial" | "complete" | "cancelled",
          })
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "Insert failed");
        if (item && num(item.qty_received) > 0) {
          await supabaseServer.from("purchase_receipt_items").insert({
            receipt_id: created.id,
            qty_received: num(item.qty_received),
            qty_accepted: num(item.qty_accepted) || num(item.qty_received),
            qty_rejected: num(item.qty_rejected),
          });
        }
        return NextResponse.json({ ok: true, id: created.id, docNo: gr_no });
      }

      case "bill": {
        const supplier_id = str(doc.supplier_id);
        if (!supplier_id) return NextResponse.json({ error: "supplier_id required" }, { status: 400 });
        const bill_no = str(doc.bill_no) ?? (await nextDocNo(tid, "vendor_bills", "bill_no", "BILL"));
        const lineTotal = num(item?.qty) * num(item?.unit_price);
        const { data: created, error } = await supabaseServer
          .from("vendor_bills")
          .insert({
            tenant_id: tid,
            bill_no,
            supplier_invoice_no: str(doc.supplier_invoice_no),
            supplier_id,
            po_id: str(doc.po_id),
            bill_date: str(doc.bill_date) ?? new Date().toISOString().slice(0, 10),
            due_date: str(doc.due_date),
            currency: str(doc.currency) ?? "USD",
            payment_terms: str(doc.payment_terms),
            subtotal: lineTotal,
            total: lineTotal,
            balance: lineTotal,
            status: "posted",
          })
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "Insert failed");
        if (item) {
          await supabaseServer.from("vendor_bill_items").insert({
            bill_id: created.id,
            description: str(item.description),
            category_id: str(item.category_id),
            qty: num(item.qty),
            unit: str(item.unit) ?? "pc",
            unit_price: num(item.unit_price),
            line_total: lineTotal,
          });
        }
        return NextResponse.json({ ok: true, id: created.id, docNo: bill_no });
      }

      case "payment": {
        const supplier_id = str(doc.supplier_id);
        const amount = num(doc.amount);
        if (!supplier_id) return NextResponse.json({ error: "supplier_id required" }, { status: 400 });
        if (amount <= 0) return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
        const payment_no = str(doc.payment_no) ?? (await nextDocNo(tid, "vendor_payments", "payment_no", "PAY"));
        const bill_id = str(doc.bill_id);

        const { data: created, error } = await supabaseServer
          .from("vendor_payments")
          .insert({
            tenant_id: tid,
            payment_no,
            bill_id,
            supplier_id,
            amount,
            currency: str(doc.currency) ?? "USD",
            method: str(doc.method) ?? "bank_transfer",
            reference: str(doc.reference),
            paid_at: str(doc.paid_at) ?? new Date().toISOString().slice(0, 10),
            notes: str(doc.notes),
          })
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "Insert failed");

        /* Settle the bill from the DB's OWN figures (tenant-scoped) — the
           client never supplies balances. Simple full/partial handling. */
        if (bill_id) {
          const { data: bill } = await supabaseServer
            .from("vendor_bills")
            .select("balance,total")
            .eq("id", bill_id)
            .eq("tenant_id", tid)
            .maybeSingle();
          if (bill) {
            const balance = num((bill as { balance: unknown }).balance) || num((bill as { total: unknown }).total);
            const total = num((bill as { total: unknown }).total) || balance;
            const newBalance = Math.max(0, balance - amount);
            await supabaseServer
              .from("vendor_bills")
              .update({
                balance: newBalance,
                amount_paid: Math.max(0, total - newBalance),
                status: newBalance <= 0 ? "paid" : "partial",
                paid_at: newBalance <= 0 ? new Date().toISOString() : null,
              })
              .eq("id", bill_id)
              .eq("tenant_id", tid);
          }
        }
        return NextResponse.json({ ok: true, id: created.id, docNo: payment_no });
      }

      default:
        return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    console.error("[api/purchase/create]", body.kind, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
