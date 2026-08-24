import "server-only";

/* ---------------------------------------------------------------------------
   /api/packing-lists/from-invoice

   POST { invoice_id }  →  the packing list for that shipment

   ── What is copied, and what deliberately is not ───────────────────────────
   The buyer block, the ports, the invoice number and the goods come straight
   off the invoice: they are already agreed, and retyping them is how a
   packing list ends up describing a different shipment from the invoice the
   bank is paying against.

   Cartons, weights and dimensions are left EMPTY. Nobody knows them when the
   invoice is raised — they are measured when the goods are actually packed.
   Prefilling a guess there would be worse than blank, because a customs
   declaration would carry it.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { ensureOrder } from "@/lib/server/orders";

const MODULE = "Documents";

/** Item descriptions carry inline markup from the document editor. A packing
    list is read by a customs officer, not a browser.

    Every tag becomes a SPACE, not nothing. Deleting them outright welded
    lines together — a real invoice here produced "Auto Sharpening Cutting
    MachineSize: 10 Inches", because the line break was a block tag rather
    than a <br>. The collapse afterwards makes the extra spaces harmless. */
function plainText(html: unknown): string {
  if (typeof html !== "string") return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { invoice_id?: string } | null;
  if (!body?.invoice_id) return NextResponse.json({ error: "invoice_id is required." }, { status: 400 });

  const { data: invoice } = await supabaseServer
    .from("invoices")
    .select("id, inv_no, deal_no, order_id, customer_id, currency, total, doc")
    .eq("id", body.invoice_id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const doc = (invoice.doc ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof doc[k] === "string" ? (doc[k] as string).trim() : "");

  /* One packing list per invoice, until someone deliberately raises a second
     for a split shipment. Opening the existing one beats minting a duplicate
     that then disagrees with it. */
  const { data: existing } = await supabaseServer
    .from("documents")
    .select("id")
    .eq("tenant_id", auth.tenant_id)
    .eq("doc_kind", "packing_list")
    .eq("doc->meta->>invoiceNo", invoice.inv_no ?? "")
    .maybeSingle();
  if (existing?.id) return NextResponse.json({ document: existing, existing: true });

  /* Share the deal's number, minting one for a pre-scheme invoice — the same
     fallback the contract and invoice routes use. */
  let dealNo = invoice.deal_no as number | null;
  if (dealNo == null) {
    const { data, error } = await supabaseServer.rpc("next_deal_number", { p_tenant: auth.tenant_id });
    if (error || data == null) {
      return NextResponse.json({ error: `Could not allocate a number: ${error?.message ?? "no value"}` }, { status: 500 });
    }
    dealNo = Number(data);
  }

  const orderId =
    (invoice.order_id as string | null) ??
    (await ensureOrder({
      tenantId: auth.tenant_id,
      dealNo,
      customerId: (invoice.customer_id as string | null) ?? null,
      currency: (invoice.currency as string | null) ?? null,
      total: Number(invoice.total ?? 0),
      accountId: auth.account_id,
    }));

  if (orderId !== invoice.order_id || dealNo !== invoice.deal_no) {
    await supabaseServer.from("invoices").update({ order_id: orderId, deal_no: dealNo }).eq("id", invoice.id);
  }

  const rawItems = Array.isArray(doc.items) ? (doc.items as Record<string, unknown>[]) : [];
  const rows = rawItems.map((it) => ({
    description: plainText(it.description) || String(it.model ?? ""),
    model: typeof it.model === "string" ? it.model : "",
    hs: "",
    /* Measured at packing, not now. */
    l: "", w: "", h: "", cbm: "", nw: "", gw: "",
    pcs: it.qty != null ? String(it.qty) : "",
    ctn: "",
  }));

  const meta = {
    date: new Date().toISOString().slice(0, 10),
    invoiceNo: invoice.inv_no ?? "",
    clientNo: str("clientNo"),
    portLoading: str("loadingPort"),
    portDischarge: str("dischargePort"),
    dischargeCountry: "",
    containerSeal: str("containerType"),
    countryOrigin: "China",
    totalPackagesWords: "",
    companyName: str("companyName"),
    toAddress: str("toAddress"),
    toAcid: str("toAcid"),
    contactPerson: str("customerName"),
    toPhone: str("toPhone"),
    toMobile: str("toMobile"),
    toEmail: str("toEmail"),
    toWebsite: str("toWebsite"),
  };

  const { data: created, error } = await supabaseServer
    .from("documents")
    .insert({
      tenant_id: auth.tenant_id,
      doc_kind: "packing_list",
      doc_no: `KL-PL-${dealNo}`,
      title: `Packing List — ${invoice.inv_no ?? `KL-${dealNo}`}`,
      customer_id: invoice.customer_id,
      currency: invoice.currency,
      status: "draft",
      issue_date: meta.date,
      order_id: orderId,
      deal_no: dealNo,
      doc: { rows, meta },
      updated_by: auth.account_id,
    })
    .select("id, doc_no, title, order_id, deal_no")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: created });
}
