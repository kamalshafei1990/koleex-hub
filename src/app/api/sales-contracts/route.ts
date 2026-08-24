import "server-only";

/* ---------------------------------------------------------------------------
   /api/sales-contracts

   GET  ?invoice_id= | ?order_id= | ?id=   list or fetch contracts
   POST { invoice_id }                     raise a contract from an invoice

   A contract is always raised FROM an invoice: the invoice is where the deal's
   commercial facts already live — parties, goods, currency, incoterm, payment
   term, ports, lead time — and re-entering them on a contract form would be
   both slower and a chance for the two documents to disagree.

   The terms are PREFILLED, not frozen. A draft renders live and stays
   editable; signature is what freezes it (see the guard trigger in
   supabase/migrations/sales_contracts.sql).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { ensureOrder } from "@/lib/server/orders";
import { TERMS_VERSION, type ContractContext } from "@/lib/contracts/general-terms";
import { impliesAdvancePayment } from "@/lib/contracts/contradictions";

const MODULE = "Invoices";

/* Every payment term hangs off a master category whose `code` is already
   exactly the shape the articles branch on. Read the code, never the label:
   a term renamed by an admin must not silently change which articles a
   contract prints. */
const PAYMENT_KIND_BY_CATEGORY: Record<string, ContractContext["paymentKind"]> = {
  tt: "tt",
  /* A standby credit is still a documentary undertaking examined against
     documents under ICC rules, so it takes the same article as an L/C. */
  lc: "lc",
  sblc: "lc",
  dp: "dp",
  /* Cash against documents is D/P by another name — documents released
     against payment, no acceptance step. */
  cad: "dp",
  da: "da",
  oa: "open",
  mixed: "mixed",
  milestone: "mixed",
  retention: "mixed",
};

/* KL-CN-12349, suffixed -2, -3 for further contracts on the same deal — an
   amendment sits beside the agreement it amends rather than replacing its
   number. Mirrors how invoices are numbered on a shared deal. */
async function contractNumberFor(tenantId: string, dealNo: number): Promise<string> {
  const base = `KL-CN-${dealNo}`;
  const { data } = await supabaseServer
    .from("sales_contracts")
    .select("contract_no")
    .eq("tenant_id", tenantId)
    .eq("deal_no", dealNo);
  const taken = new Set(
    (data ?? [])
      .map((r) => (r as { contract_no: string | null }).contract_no)
      .filter((n): n is string => typeof n === "string"),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Deal ${dealNo} already has 999 contracts.`);
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  let q = supabaseServer
    .from("sales_contracts")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });

  const id = url.searchParams.get("id");
  const invoiceId = url.searchParams.get("invoice_id");
  const orderId = url.searchParams.get("order_id");
  if (id) q = q.eq("id", id);
  if (invoiceId) q = q.eq("invoice_id", invoiceId);
  if (orderId) q = q.eq("order_id", orderId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data ?? [] });
}

export async function POST(req: Request) {
  /* `req` passed so a super-admin viewing as someone else cannot write. */
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { invoice_id?: string } | null;
  if (!body?.invoice_id) {
    return NextResponse.json({ error: "invoice_id is required." }, { status: 400 });
  }

  const { data: invoice } = await supabaseServer
    .from("invoices")
    .select("id, inv_no, deal_no, order_id, customer_id, currency, total, doc")
    .eq("id", body.invoice_id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const doc = (invoice.doc ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof doc[k] === "string" ? (doc[k] as string).trim() : undefined);
  const num = (k: string) => (typeof doc[k] === "number" ? (doc[k] as number) : undefined);

  /* An invoice raised before the deal counter existed has no number to share.
     Rather than refuse, take a fresh one — the contract is still a real
     document; it simply starts its own deal. */
  let dealNo = invoice.deal_no as number | null;
  if (dealNo == null) {
    const { data, error } = await supabaseServer.rpc("next_deal_number", { p_tenant: auth.tenant_id });
    if (error || data == null) {
      return NextResponse.json(
        { error: `Could not allocate a contract number: ${error?.message ?? "no value"}` },
        { status: 500 },
      );
    }
    dealNo = Number(data);
  }

  /* Every document of a deal hangs off one order. The invoice may already
     have it; a pre-scheme invoice will not, and the contract is then what
     brings the order into being. */
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

  /* Back-fill the invoice so both documents point at the same order and the
     invoice carries the deal number it was just given. Not fatal. */
  if (orderId !== invoice.order_id || dealNo !== invoice.deal_no) {
    await supabaseServer
      .from("invoices")
      .update({ order_id: orderId, deal_no: dealNo })
      .eq("id", invoice.id);
  }

  /* Resolve the payment term's CATEGORY, which is what decides whether the
     contract carries a documentary-credit article. */
  let paymentKind: ContractContext["paymentKind"] = "other";
  let paymentLabel: string | undefined;
  const paymentTermId = str("paymentTermId");
  if (paymentTermId) {
    const { data: term } = await supabaseServer
      .from("payment_terms")
      .select("label, payment_method_categories ( code )")
      .eq("id", paymentTermId)
      .maybeSingle();
    if (term) {
      const row = term as {
        label?: string;
        payment_method_categories?: { code?: string } | { code?: string }[] | null;
      };
      paymentLabel = row.label;
      const cat = Array.isArray(row.payment_method_categories)
        ? row.payment_method_categories[0]
        : row.payment_method_categories;
      paymentKind = PAYMENT_KIND_BY_CATEGORY[cat?.code ?? ""] ?? "other";
    }
  }

  let contract_no: string;
  try {
    contract_no = await contractNumberFor(auth.tenant_id, dealNo);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Numbering failed" }, { status: 500 });
  }

  /* The negotiated set. Prefilled from the invoice so the operator reviews
     rather than retypes, and editable until signature. Lead-time basis is
     corrected here: an invoice that says "after deposit" while paying by
     credit is the contradiction this whole feature exists to catch, and a
     contract must not inherit it. */
  /* What starts the production clock has to follow the payment term, not the
     invoice's stored habit.

     This is not hypothetical. A live invoice here carries
     leadTimeBasis "after_deposit" beside the payment term "100% T/T before
     shipment" — a clock counted from money that never arrives before the
     goods are made. Inheriting that would produce a contract the checker
     refuses to let anyone sign, on a defect the contract did not create.

     So the invoice's value is honoured only when it agrees with how the deal
     is actually paid; otherwise it is derived. */
  const storedBasis = str("leadTimeBasis") as ContractContext["leadTimeBasis"] | undefined;
  const derivedBasis: ContractContext["leadTimeBasis"] =
    paymentKind === "lc"
      ? "after_lc_opening"
      : impliesAdvancePayment(paymentLabel)
        ? "after_deposit"
        : "after_order";

  const basisIsCoherent =
    storedBasis != null &&
    (storedBasis === "after_order" ||
      (storedBasis === "after_lc_opening" && paymentKind === "lc") ||
      (storedBasis === "after_deposit" && paymentKind !== "lc" && impliesAdvancePayment(paymentLabel)));

  const leadTimeBasis = basisIsCoherent ? storedBasis : derivedBasis;

  const terms = {
    incoterm: str("incotermCode"),
    incotermId: str("incotermId"),
    incotermPlace: str("dischargePort") || str("loadingPort"),
    loadingPort: str("loadingPort"),
    dischargePort: str("dischargePort"),
    containerType: str("containerType"),
    shippingMarks: str("shippingMarks"),
    shippingMethodId: str("shippingMethodId"),

    paymentKind,
    paymentLabel,
    paymentTermId,
    bankCharges: str("bankCharges"),

    leadTimeDays: num("leadTimeDays") ?? 45,
    leadTimeBasis,
    /* Not carried on any invoice today — the contract is the first document
       that has to state it, so it starts at the house standard and is edited
       on the contract itself. */
    warrantyMonths: 12,
    inspection: "seller" as const,

    governingLaw: str("governingLaw"),
    cancellationPolicy: str("cancellationPolicy"),
    documents: Array.isArray(doc.documentsProvided) ? doc.documentsProvided : [],
    specialConditions: [] as string[],

    buyer: {
      name: str("customerName"),
      company: str("companyName"),
      address: str("toAddress"),
      email: str("toEmail"),
      phone: str("toPhone") || str("toMobile"),
      website: str("toWebsite"),
      /* Bangladesh clears against an ACID number; it belongs on the contract
         for the same reason it belongs on the invoice. */
      acid: str("toAcid"),
      clientNo: str("clientNo"),
    },
  };

  const { data: contract, error } = await supabaseServer
    .from("sales_contracts")
    .insert({
      tenant_id: auth.tenant_id,
      deal_no: dealNo,
      contract_no,
      order_id: orderId,
      invoice_id: invoice.id,
      customer_id: invoice.customer_id,
      status: "draft",
      contract_date: new Date().toISOString().slice(0, 10),
      currency: invoice.currency ?? str("currency"),
      total: invoice.total ?? 0,
      terms,
      terms_version: TERMS_VERSION,
      created_by: auth.account_id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract });
}
