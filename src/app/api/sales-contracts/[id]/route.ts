import "server-only";

/* ---------------------------------------------------------------------------
   /api/sales-contracts/[id]

   GET    fetch one contract, with the invoice it was raised from
   PATCH  edit the negotiated terms, status, dates, notes
   DELETE remove a contract that was never signed

   ── What signing does ──────────────────────────────────────────────────────
   PATCH { status: "signed" } is not an ordinary status change. It renders the
   contract as it stands — the general articles for THIS deal, the commercial
   schedule from the invoice, both parties — and writes the whole thing into
   `snapshot`. From that moment the document renders from the snapshot and the
   database trigger refuses every further edit.

   That is the point. A signed contract that silently re-rendered from live
   data would change its own terms whenever the master articles were edited or
   the invoice corrected, and the two parties would be holding different
   agreements. Freezing at signature is the only honest behaviour.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { articlesFor, TERMS_VERSION, type ContractContext } from "@/lib/contracts/general-terms";

const MODULE = "Invoices";

type Params = { params: Promise<{ id: string }> };

/** Terms as stored on the row — a superset of what the articles read. */
interface StoredTerms extends ContractContext {
  paymentTermId?: string;
  loadingPort?: string;
  dischargePort?: string;
  containerType?: string;
  shippingMarks?: string;
  bankCharges?: string;
  cancellationPolicy?: string;
  documents?: unknown[];
  specialConditions?: string[];
  buyer?: Record<string, unknown>;
}

async function loadContract(tenantId: string, id: string) {
  const { data } = await supabaseServer
    .from("sales_contracts")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const { id } = await params;
  const contract = await loadContract(auth.tenant_id, id);
  if (!contract) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

  /* The commercial schedule — goods, quantities, prices — is never copied
     onto the contract while it is a draft. It is read from the invoice so a
     correction there flows through, exactly once, to the contract that has
     not yet been signed. */
  let invoice: Record<string, unknown> | null = null;
  if (contract.invoice_id) {
    const { data } = await supabaseServer
      .from("invoices")
      .select("id, inv_no, deal_no, currency, total, doc")
      .eq("id", contract.invoice_id as string)
      .maybeSingle();
    invoice = (data as Record<string, unknown> | null) ?? null;
  }

  return NextResponse.json({ contract, invoice });
}

/** Everything a signed contract must keep, independent of every live row. */
function buildSnapshot(args: {
  contract: Record<string, unknown>;
  terms: StoredTerms;
  invoice: Record<string, unknown> | null;
}) {
  const { contract, terms, invoice } = args;
  const doc = ((invoice?.doc ?? {}) as Record<string, unknown>) ?? {};

  return {
    /* Stamped so a reader of the snapshot years later knows which edition of
       the general articles this text came from. */
    termsVersion: (contract.terms_version as string) ?? TERMS_VERSION,
    frozenAt: new Date().toISOString(),

    contractNo: contract.contract_no,
    contractDate: contract.contract_date,
    placeOfSigning: contract.place_of_signing,
    currency: contract.currency,
    total: contract.total,

    seller: {
      name: "Koleex International Corporation Taizhou Co., Ltd.",
    },
    buyer: terms.buyer ?? {},

    /* The commercial schedule, copied out of the invoice at this instant. */
    schedule: {
      invoiceNo: invoice?.inv_no ?? null,
      items: Array.isArray(doc.items) ? doc.items : [],
      currency: invoice?.currency ?? contract.currency ?? null,
      total: invoice?.total ?? contract.total ?? 0,
      shipping: doc.shipping ?? null,
      tax: doc.tax ?? null,
    },

    /* The negotiated set as agreed, and the general articles rendered for
       exactly this deal — numbered as they print. */
    terms,
    articles: articlesFor(terms).map((a) => ({ n: a.n, key: a.key, title: a.title, body: a.body })),
  };
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "edit");
  if (deny) return deny;

  const { id } = await params;
  const contract = await loadContract(auth.tenant_id, id);
  if (!contract) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

  /* Refuse in the API too, not only in the trigger. The trigger is the
     backstop that no code path can slip past; this is the message a person
     should actually read. */
  if (contract.status === "signed") {
    return NextResponse.json(
      { error: `${contract.contract_no} is signed. Raise an amendment rather than editing it.` },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    terms?: StoredTerms;
    status?: string;
    contract_date?: string | null;
    place_of_signing?: string | null;
    notes?: string | null;
    total?: number;
  } | null;
  if (!body) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.terms !== undefined) patch.terms = body.terms;
  if (body.contract_date !== undefined) patch.contract_date = body.contract_date;
  if (body.place_of_signing !== undefined) patch.place_of_signing = body.place_of_signing;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.total !== undefined) patch.total = body.total;

  if (body.status !== undefined) {
    const allowed = ["draft", "ready", "signed", "cancelled"];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: `Unknown status "${body.status}".` }, { status: 400 });
    }
    patch.status = body.status;

    if (body.status === "signed") {
      /* Freeze. Read the invoice fresh rather than trusting anything the
         client sent — the snapshot is the legal record. */
      let invoice: Record<string, unknown> | null = null;
      if (contract.invoice_id) {
        const { data } = await supabaseServer
          .from("invoices")
          .select("id, inv_no, currency, total, doc")
          .eq("id", contract.invoice_id as string)
          .maybeSingle();
        invoice = (data as Record<string, unknown> | null) ?? null;
      }
      const terms = (body.terms ?? (contract.terms as StoredTerms) ?? {}) as StoredTerms;
      patch.snapshot = buildSnapshot({ contract, terms, invoice });
      patch.signed_at = new Date().toISOString();
      patch.signed_by = auth.account_id;
    }
  }

  const { data, error } = await supabaseServer
    .from("sales_contracts")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "delete");
  if (deny) return deny;

  const { id } = await params;
  const contract = await loadContract(auth.tenant_id, id);
  if (!contract) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

  /* A signed contract is a record of what was agreed. Cancelling it is a
     status, not a deletion. */
  if (contract.status === "signed") {
    return NextResponse.json(
      { error: `${contract.contract_no} is signed and cannot be deleted. Cancel it instead.` },
      { status: 409 },
    );
  }

  const { error } = await supabaseServer
    .from("sales_contracts")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
