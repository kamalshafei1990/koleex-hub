import "server-only";

/* ===========================================================================
   Ledger hooks — how the other apps reach the books.

   The posting engine used to be reached only by a button in the Accounting
   Queue: an invoice sent, an expense approved or a payroll run signed off
   stayed outside the ledger until someone remembered to click. These
   helpers are called from the routes that change a document's state:

     ledgerDraft   the document is final → its journal entry is drafted now
                   and waits in the queue for the accountant's "Post"
     ledgerVoid    the document was cancelled → its entry is reversed
     refuseIfInLedger  a document already in the books cannot be edited or
                   deleted in place; the caller answers 409 and the operator
                   voids the journal first

   Drafting is best-effort by design: a failed draft (a missing FX rate, an
   unapproved source) is written on the source row as accounting_status
   'failed' with the reason, where the queue shows it — it never fails the
   business action that triggered it.
   ========================================================================== */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { draftSource, voidSourceEntry, type SourceKind } from "./posting";

export async function ledgerDraft(kind: SourceKind, sourceId: string, tenantId: string, actorId: string | null): Promise<void> {
  try {
    const r = await draftSource({ tenantId, postedByAccountId: actorId }, kind, sourceId);
    if (!r.ok) console.warn(`[ledger] draft ${kind}/${sourceId}: ${r.error}`);
  } catch (e) {
    console.error(`[ledger] draft ${kind}/${sourceId}:`, e instanceof Error ? e.message : e);
  }
}

export async function ledgerVoid(kind: SourceKind, sourceId: string, tenantId: string, actorId: string | null, reason: string): Promise<void> {
  try {
    const r = await voidSourceEntry({ tenantId, postedByAccountId: actorId }, kind, sourceId, reason);
    if (!r.ok) console.warn(`[ledger] void ${kind}/${sourceId}: ${r.error}`);
  } catch (e) {
    console.error(`[ledger] void ${kind}/${sourceId}:`, e instanceof Error ? e.message : e);
  }
}

/** 'drafted' | 'posted' when the row has a live journal entry, else null. */
export async function inLedger(table: string, id: string, tenantId: string): Promise<"drafted" | "posted" | null> {
  const { data } = await supabaseServer.from(table).select("accounting_status").eq("id", id).eq("tenant_id", tenantId).maybeSingle();
  const s = (data as { accounting_status?: string } | null)?.accounting_status;
  return s === "drafted" || s === "posted" ? s : null;
}

/** The 409 a mutation route returns when the document is already booked. */
export async function refuseIfInLedger(table: string, id: string, tenantId: string): Promise<NextResponse | null> {
  const status = await inLedger(table, id, tenantId);
  if (!status) return null;
  return NextResponse.json(
    { error: status === "posted"
        ? "This document is posted to the ledger. Void its journal entry first, then change it."
        : "This document has a drafted journal entry. Remove the draft in the Accounting queue first, then change it." },
    { status: 409 },
  );
}
