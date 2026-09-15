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
import {
  impliesAdvancePayment,
  warrantyMonthsInText,
  PLACE_IS_ORIGIN,
  PLACE_IS_DESTINATION,
} from "@/lib/contracts/contradictions";

/* Contracts is its own permission module, not a rider on Invoices.

   It rode Invoices while a contract was only reachable FROM an invoice —
   anyone who could see the bill could see what was agreed on it. Now that
   contracts are an app of their own, that reasoning no longer holds: a
   signed agreement carries the arbitration seat, the warranty exposure and
   the payment security, and "may raise an invoice" is not the same decision
   as "may read every contract Koleex has signed".

   Deny-by-default meant switching would have locked out the 24 roles that
   hold Invoices, so the module was SEEDED from Invoices on the day it
   shipped (scripts/seed-contracts-module.mts) — same access as before, now
   on a dial that can be turned down independently. */
const MODULE = "Contracts";

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

/* ── The list payload ──────────────────────────────────────────────────────
   NEVER `select("*")` for a list. `terms` is the whole negotiated agreement
   and `snapshot` is the entire rendered contract; a twenty-row list that
   shipped both would be megabytes to draw a table of numbers and names.

   The buyer is read three ways because a contract can be missing any one of
   them: the order carries a denormalised customer name, the terms carry the
   buyer block the document actually prints, and `->>` extracts just that
   text server-side rather than hauling the jsonb across to find it. */
const LIST_COLUMNS =
  `id, contract_no, deal_no, status, currency, total, contract_date,
   signed_at, created_at, updated_at, amends_id, invoice_id, order_id,
   buyer_company:terms->buyer->>company,
   buyer_name:terms->buyer->>name,
   orders:order_id ( customer_name, company_name, customer_code ),
   invoices:invoice_id ( inv_no )`;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);

  /* Invoices that could still be contracted — what the Contracts app offers
     when you ask for a new contract. A contract is always raised FROM an
     invoice, so this is the only honest way to start one from here.

     Invoices that ALREADY have a contract stay in the list rather than being
     filtered out: picking one opens the contract it has, which is what
     somebody hunting for "the contract for INV-0009" actually wants. The
     row says which. */
  if (url.searchParams.get("candidates")) {
    const [{ data: invoices, error }, { data: taken }] = await Promise.all([
      /* The buyer is read out of `doc`, NOT off a customer join.
         `invoices.customer_id` is null on every invoice raised through the
         editor — the buyer is typed onto the document and lives in
         doc.companyName / doc.customerName, which is also what the invoice
         PRINTS. A join here returned null on all eight real invoices and the
         picker would have listed eight rows of numbers with no names on them.
         `->>` extracts the two strings server-side; the doc blob itself,
         which carries embedded product images, never leaves the database. */
      supabaseServer
        .from("invoices")
        .select(
          `id, inv_no, deal_no, status, currency, total, issue_date,
           doc_company:doc->>companyName, doc_person:doc->>customerName,
           doc_code:doc->>clientNo`,
        )
        .eq("tenant_id", auth.tenant_id)
        .order("issue_date", { ascending: false })
        .limit(200),
      supabaseServer
        .from("sales_contracts")
        .select("invoice_id, id, contract_no")
        .eq("tenant_id", auth.tenant_id),
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const byInvoice = new Map<string, { id: string; contract_no: string }>();
    for (const c of taken ?? []) {
      const row = c as { invoice_id: string | null; id: string; contract_no: string };
      /* First wins — the query is unordered, but any contract on the invoice
         is a truthful answer to "this one is already contracted". */
      if (row.invoice_id && !byInvoice.has(row.invoice_id)) {
        byInvoice.set(row.invoice_id, { id: row.id, contract_no: row.contract_no });
      }
    }

    return NextResponse.json({
      invoices: (invoices ?? []).map((inv) => {
        const row = inv as Record<string, unknown>;
        return {
          id: row.id as string,
          inv_no: row.inv_no as string | null,
          deal_no: row.deal_no as number | null,
          status: row.status as string | null,
          currency: row.currency as string | null,
          total: row.total as number | null,
          issue_date: row.issue_date as string | null,
          party:
            [row.doc_company, row.doc_person, row.doc_code]
              .map((v) => (typeof v === "string" ? v.trim() : ""))
              .find(Boolean) ?? null,
          contract: byInvoice.get(row.id as string) ?? null,
        };
      }),
    });
  }

  const id = url.searchParams.get("id");
  const invoiceId = url.searchParams.get("invoice_id");
  const orderId = url.searchParams.get("order_id");

  /* A lookup by id / invoice / order is a document read — the caller wants
     the contract itself, terms and all. A bare GET is the app's list, and
     gets the slim shape. Two different questions, two different payloads. */
  const lookup = Boolean(id || invoiceId || orderId);

  let q = supabaseServer
    .from("sales_contracts")
    .select(lookup ? "*" : LIST_COLUMNS)
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });

  if (id) q = q.eq("id", id);
  if (invoiceId) q = q.eq("invoice_id", invoiceId);
  if (orderId) q = q.eq("order_id", orderId);
  if (!lookup) q = q.limit(Number(url.searchParams.get("limit") ?? 300));

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

  /* ── The named place belongs to the rule's OWN side ──────────────────────
     This used to read `dischargePort || loadingPort` — the buyer's port,
     always. On an FOB deal that produced "FOB Chittagong, Bangladesh", which
     in ICC's own vocabulary says the Seller carries the goods to Bangladesh
     and loads them there. A bank or a buyer reading it literally would be
     entitled to hold Koleex to exactly that. Caught on a live contract by an
     outside reader (2026-08-25).

     EXW/FCA/FAS/FOB name where the Seller hands over; the C and D rules name
     where the carriage the Seller paid for ends. */
  const incotermCode = (str("incotermCode") ?? "").toUpperCase();
  const originPort = str("loadingPort");
  const destinationPort = str("dischargePort");
  const incotermPlace = PLACE_IS_ORIGIN.has(incotermCode)
    ? (originPort ?? destinationPort)
    : PLACE_IS_DESTINATION.has(incotermCode)
      ? (destinationPort ?? originPort)
      : (destinationPort ?? originPort);

  /* ── The warranty the GOODS actually carry ───────────────────────────────
     A flat 12 was contradicting item descriptions that read "Warranty: 5
     YEARS" — the same document promising two different periods. Take the
     goods' own figure when every line agrees on one; fall back to the house
     12 only when they are silent or disagree with each other, and let the
     checker raise the disagreement rather than this route guessing. */
  const rawItemsForWarranty = Array.isArray(doc.items) ? (doc.items as Record<string, unknown>[]) : [];
  const statedWarranties = new Set(
    rawItemsForWarranty
      .map((it) => warrantyMonthsInText(typeof it.description === "string" ? it.description : ""))
      .filter((m): m is number => m != null),
  );
  const warrantyMonths = statedWarranties.size === 1 ? [...statedWarranties][0] : 12;

  const terms = {
    incoterm: str("incotermCode"),
    incotermId: str("incotermId"),
    incotermPlace,
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
    warrantyMonths,
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
