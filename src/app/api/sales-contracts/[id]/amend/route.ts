import "server-only";

/* ---------------------------------------------------------------------------
   /api/sales-contracts/[id]/amend

   POST → a draft amendment of a signed contract.

   The original is NOT retired here. It stays in force until the amendment is
   signed, because an amendment sits in draft for days and a deal must never
   pass through a window where the old agreement is marked retired and the new
   one is unsigned. The supersede happens in the PATCH that signs the
   amendment — the same instant the replacement becomes binding.

   The amendment starts from what was ACTUALLY AGREED — the signed snapshot —
   not from the live invoice. The invoice may have moved on; the thing being
   amended is the contract as executed.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { TERMS_VERSION } from "@/lib/contracts/general-terms";

const MODULE = "Invoices";

type Params = { params: Promise<{ id: string }> };

/** KL-CN-12352-2, then -3 … An amendment takes the deal's number with a
    suffix so it files beside what it replaces rather than hiding behind a
    number of its own. */
async function amendmentNumberFor(tenantId: string, dealNo: number): Promise<string> {
  const base = `KL-CN-${dealNo}`;
  const { data } = await supabaseServer
    .from("sales_contracts")
    .select("contract_no")
    .eq("tenant_id", tenantId)
    .eq("deal_no", dealNo);
  const taken = new Set((data ?? []).map((r) => (r as { contract_no: string }).contract_no));
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Deal ${dealNo} already has 999 contracts.`);
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const { id } = await params;

  const { data: original } = await supabaseServer
    .from("sales_contracts")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!original) return NextResponse.json({ error: "Contract not found." }, { status: 404 });

  /* Only a signed contract needs amending. A draft is simply edited, and
     offering "amend" on one would produce two live drafts of the same
     agreement with nothing to say which is real. */
  if (original.status !== "signed") {
    return NextResponse.json(
      {
        error:
          original.status === "superseded"
            ? `${original.contract_no} has already been superseded. Amend the contract that replaced it.`
            : `${original.contract_no} is not signed, so it can be edited directly rather than amended.`,
      },
      { status: 409 },
    );
  }

  /* One open amendment at a time. Two people each raising one would produce
     two drafts that both claim to replace the same agreement. */
  const { data: openAmendment } = await supabaseServer
    .from("sales_contracts")
    .select("id, contract_no, status")
    .eq("amends_id", id)
    .in("status", ["draft", "ready"])
    .maybeSingle();
  if (openAmendment) {
    return NextResponse.json({ contract: openAmendment, existing: true });
  }

  const snapshot = (original.snapshot ?? {}) as Record<string, unknown>;
  /* What was agreed, not what the invoice says now. */
  const terms = (snapshot.terms ?? original.terms ?? {}) as Record<string, unknown>;

  let contract_no: string;
  try {
    contract_no = await amendmentNumberFor(auth.tenant_id, original.deal_no as number);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Numbering failed" }, { status: 500 });
  }

  const { data: amendment, error } = await supabaseServer
    .from("sales_contracts")
    .insert({
      tenant_id: auth.tenant_id,
      deal_no: original.deal_no,
      contract_no,
      order_id: original.order_id,
      invoice_id: original.invoice_id,
      customer_id: original.customer_id,
      amends_id: original.id,
      status: "draft",
      contract_date: new Date().toISOString().slice(0, 10),
      place_of_signing: original.place_of_signing,
      currency: original.currency,
      total: original.total,
      terms,
      /* Drawn against the CURRENT edition of the general articles — an
         amendment is a new agreement, not a patch to the old text. */
      terms_version: TERMS_VERSION,
      notes: `Amends ${original.contract_no}.`,
      created_by: auth.account_id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: amendment });
}
