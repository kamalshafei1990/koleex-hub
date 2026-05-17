import "server-only";

/* ===========================================================================
   Phase A.1 — Posting engine.

   Every posting function follows the same shape:
     1. Resolve the COA accounts it needs (and ensure the seed is in
        place for this tenant).
     2. Load the source row (payment / expense / movement / …).
     3. Build a balanced set of journal lines.
     4. INSERT a draft entry + lines in a single transaction.
     5. Call fn_accounting_post_entry to flip to 'posted' (this asserts
        debits = credits at the DB layer — defence in depth).

   The DB-level partial unique index on (tenant_id, source_type,
   source_id) for non-voided entries guarantees we never double-post
   the same source. The function returns the existing posted entry
   when re-called.

   Accounting math anchor — the Hub uses standard cash-basis +
   accrual hybrid:
     · customer payment in   →  Dr Bank,         Cr A/R
     · supplier payment out  →  Dr A/P,          Cr Bank
     · paid expense          →  Dr <expense acct>, Cr Bank
     · unpaid expense        →  Dr <expense acct>, Cr A/P
     · cash movement (other) →  Dr Bank,         Cr Owner Capital  (adjustment)
     · opening balance       →  Dr <asset/exp>,  Cr Owner Capital  (or reverse)

   No tax, no inventory valuation, no FX revaluation — those land in
   later accounting phases.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type {
  AccountingAccount,
  PostingContext,
  PostingError,
  PostingOutcome,
  JournalSourceType,
} from "./types";

/* ─── COA helpers ─────────────────────────────────────────────── */

async function ensureCoa(tenantId: string): Promise<void> {
  /* Idempotent — `fn_accounting_ensure_coa` is ON CONFLICT DO NOTHING
     so re-running on an already-seeded tenant is a no-op. */
  await supabaseServer.rpc("fn_accounting_ensure_coa", { p_tenant_id: tenantId });
}

async function loadAccountsByCode(tenantId: string): Promise<Map<string, AccountingAccount>> {
  await ensureCoa(tenantId);
  const { data } = await supabaseServer
    .from("accounting_accounts")
    .select("*")
    .eq("tenant_id", tenantId);
  const map = new Map<string, AccountingAccount>();
  for (const a of (data ?? []) as AccountingAccount[]) map.set(a.code, a);
  return map;
}

function requireAccount(map: Map<string, AccountingAccount>, code: string): AccountingAccount {
  const a = map.get(code);
  if (!a) throw new Error(`Missing required account code ${code} — COA seeding incomplete`);
  return a;
}

/* ─── Journal-number generator ─────────────────────────────────
   Format: JE-YYYYMMDD-XXXXXX where XXXXXX is the last 6 hex chars
   of the source id (when present) or a Date.now() hex tail (manual /
   opening). Stable across re-posts because the SAME source id maps
   to the SAME journal_no — handy for the operator AND for the
   uniqueness constraint. */

function generateJournalNo(sourceType: JournalSourceType, sourceId: string | null, date: Date): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const tail = sourceId
    ? sourceId.replace(/-/g, "").slice(-6).toUpperCase()
    : Date.now().toString(16).slice(-6).toUpperCase();
  const prefix =
    sourceType === "payment" ? "JE-PAY" :
    sourceType === "expense" ? "JE-EXP" :
    sourceType === "cash_movement" ? "JE-MOV" :
    sourceType === "opening_balance" ? "JE-OB" :
    sourceType === "inventory_cogs" ? "JE-COGS" :
    "JE-MAN";
  return `${prefix}-${ymd}-${tail}`;
}

/* ─── Existing-posting probe ────────────────────────────────────
   The partial unique index protects against duplicate active
   entries, but for clean operator UX we first look for one and
   return it without raising. */

async function findActiveEntryFor(tenantId: string, sourceType: JournalSourceType, sourceId: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("accounting_journal_entries")
    .select("id, journal_no, status")
    .eq("tenant_id", tenantId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .neq("status", "voided")
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/* ─── Internal: create draft entry + lines, optionally promote ───
   Phase A.2 splits the old `createAndPost` into two halves:

     1. createDraft       inserts entry as status='draft', inserts
                          lines, returns the entry id WITHOUT calling
                          the post RPC. Also flips the operational
                          source row's accounting_status to 'drafted'
                          and stamps accounting_entry_id.

     2. postExistingDraft calls fn_accounting_post_entry on a draft
                          entry. On success flips the source row to
                          'posted' and stamps accounting_posted_at.
                          On failure flips to 'failed' + stores the
                          error so the queue surface can show a
                          retry button with the original message.

   `createAndPost` is preserved as a back-compat one-shot wrapper —
   the legacy public posters keep using it. New callers that want a
   draft-first workflow call createDraft alone, then postExistingDraft
   when the accountant approves.
   ================================================================ */

interface DraftLine {
  account_id: string;
  debit: number;
  credit: number;
  currency: string;
  exchange_rate?: number;
  description?: string | null;
  party_id?: string | null;
  party_type?: "customer" | "supplier" | null;
  reference?: string | null;
}

/* Map source_type → operational table name. Used to keep the
   accounting_status on the operational row in sync with the journal.
   Opening-balance + manual + void sources have no operational row to
   update. */
function sourceTableFor(sourceType: JournalSourceType): string | null {
  if (sourceType === "payment") return "finance_payments";
  if (sourceType === "expense") return "finance_expenses";
  if (sourceType === "cash_movement") return "finance_cash_movements";
  /* Phase A.4 — Sales Shipment COGS mirrors its status on the
     sales_shipments row. */
  if (sourceType === "inventory_cogs") return "sales_shipments";
  return null;
}

async function setSourceAccountingStatus(
  tenantId: string,
  sourceType: JournalSourceType,
  sourceId: string | null,
  patch: {
    accounting_status: "pending" | "drafted" | "posted" | "failed" | "voided";
    accounting_entry_id?: string | null;
    accounting_last_error?: string | null;
    accounting_posted_at?: string | null;
  },
): Promise<void> {
  if (!sourceId) return;
  const tbl = sourceTableFor(sourceType);
  if (!tbl) return;
  await supabaseServer
    .from(tbl)
    .update(patch)
    .eq("id", sourceId)
    .eq("tenant_id", tenantId);
}

interface DraftArgs {
  tenantId: string;
  postedBy: string | null;
  sourceType: JournalSourceType;
  sourceId: string | null;
  entryDate: string;
  description: string;
  lines: DraftLine[];
  metadata?: Record<string, unknown>;
}

async function createDraft(args: DraftArgs): Promise<PostingOutcome> {
  /* Pre-flight balance check — saves a round-trip when the caller
     gives us unbalanced lines. The DB also enforces this. */
  const debitSum = args.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const creditSum = args.lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(debitSum - creditSum) > 0.005) {
    const err = `Unbalanced: sum(debit)=${debitSum.toFixed(2)} sum(credit)=${creditSum.toFixed(2)}`;
    await setSourceAccountingStatus(args.tenantId, args.sourceType, args.sourceId, {
      accounting_status: "failed",
      accounting_last_error: err,
    });
    return { ok: false, error: err };
  }
  if (args.lines.length === 0) {
    return { ok: false, error: "Cannot post a journal with zero lines" };
  }

  const journalNo = generateJournalNo(args.sourceType, args.sourceId, new Date(args.entryDate));

  /* Insert the draft header. */
  const { data: entryRow, error: entryErr } = await supabaseServer
    .from("accounting_journal_entries")
    .insert({
      tenant_id: args.tenantId,
      journal_no: journalNo,
      entry_date: args.entryDate,
      source_type: args.sourceType,
      source_id: args.sourceId,
      status: "draft",
      description: args.description,
      created_by: args.postedBy,
      metadata: args.metadata ?? {},
    })
    .select("id")
    .single();
  if (entryErr || !entryRow) {
    /* Most common cause: duplicate (tenant_id, source_type, source_id)
       — surface that explicitly. */
    await setSourceAccountingStatus(args.tenantId, args.sourceType, args.sourceId, {
      accounting_status: "failed",
      accounting_last_error: entryErr?.message ?? "Insert failed",
    });
    return { ok: false, error: entryErr?.message ?? "Insert failed", code: 409 };
  }
  const entryId = (entryRow as { id: string }).id;

  /* Insert lines. */
  const lineRows = args.lines.map((l, i) => ({
    tenant_id: args.tenantId,
    entry_id: entryId,
    line_index: i,
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    currency: l.currency,
    exchange_rate: l.exchange_rate ?? 1,
    description: l.description ?? null,
    party_id: l.party_id ?? null,
    party_type: l.party_type ?? null,
    reference: l.reference ?? null,
  }));
  const { error: linesErr } = await supabaseServer
    .from("accounting_journal_lines")
    .insert(lineRows);
  if (linesErr) {
    /* Compensating delete — the entry exists in draft but lines
       failed, so wipe it before returning. */
    await supabaseServer.from("accounting_journal_entries").delete().eq("id", entryId).eq("tenant_id", args.tenantId);
    await setSourceAccountingStatus(args.tenantId, args.sourceType, args.sourceId, {
      accounting_status: "failed",
      accounting_last_error: linesErr.message,
    });
    return { ok: false, error: linesErr.message, code: 500 };
  }

  /* Mirror the new draft state to the operational row so the queue
     UI sees the transition immediately. Clears any previous error. */
  await setSourceAccountingStatus(args.tenantId, args.sourceType, args.sourceId, {
    accounting_status: "drafted",
    accounting_entry_id: entryId,
    accounting_last_error: null,
  });

  return { ok: true, entry_id: entryId, journal_no: journalNo, status: "draft" };
}

async function postExistingDraft(
  tenantId: string,
  postedBy: string | null,
  entryId: string,
): Promise<PostingOutcome> {
  /* Read the entry's source so we can mirror the status flip back
     to the operational row. */
  const { data: entryData } = await supabaseServer
    .from("accounting_journal_entries")
    .select("id, source_type, source_id, journal_no, status")
    .eq("id", entryId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!entryData) return { ok: false, error: "Entry not found", code: 404 };
  const entry = entryData as { id: string; source_type: JournalSourceType; source_id: string | null; journal_no: string; status: string };

  /* Already posted — idempotent return without re-running the RPC. */
  if (entry.status === "posted") {
    return { ok: true, entry_id: entry.id, journal_no: entry.journal_no, status: "posted" };
  }

  const { data: postRes, error: postErr } = await supabaseServer.rpc("fn_accounting_post_entry", {
    p_entry_id: entryId,
    p_tenant_id: tenantId,
    p_posted_by: postedBy,
  });
  if (postErr) {
    await setSourceAccountingStatus(tenantId, entry.source_type, entry.source_id, {
      accounting_status: "failed",
      accounting_last_error: postErr.message,
    });
    return { ok: false, error: postErr.message, code: 500 };
  }
  const r = (postRes ?? {}) as { ok?: boolean; error?: string; code?: number };
  if (!r.ok) {
    await setSourceAccountingStatus(tenantId, entry.source_type, entry.source_id, {
      accounting_status: "failed",
      accounting_last_error: r.error ?? "Post failed",
    });
    return { ok: false, error: r.error ?? "Post failed", code: r.code };
  }

  /* Mirror posted state to the source row. */
  await setSourceAccountingStatus(tenantId, entry.source_type, entry.source_id, {
    accounting_status: "posted",
    accounting_entry_id: entry.id,
    accounting_posted_at: new Date().toISOString(),
    accounting_last_error: null,
  });

  return { ok: true, entry_id: entry.id, journal_no: entry.journal_no, status: "posted" };
}

/* Legacy one-shot helper — preserved so existing public posters
   (postPayment, postExpense, etc.) keep their atomic behaviour. */
async function createAndPost(args: DraftArgs): Promise<PostingOutcome> {
  const draftResult = await createDraft(args);
  if (!draftResult.ok) return draftResult;
  return postExistingDraft(args.tenantId, args.postedBy, draftResult.entry_id);
}

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC POSTING FUNCTIONS
   ═══════════════════════════════════════════════════════════════════ */

/* ─── postPayment ───────────────────────────────────────────────
   Dispatches to postCustomerCollection or postSupplierPayment based
   on the payment direction + party type. The thin wrapper exists so
   callers that only have a payment id can post without knowing the
   direction up front. */

export async function postPayment(ctx: PostingContext, paymentId: string): Promise<PostingOutcome> {
  const { data: pay } = await supabaseServer
    .from("finance_payments")
    .select("id, direction, party_type, party_id, party_name, amount, currency, payment_date, reference_no, status, linked_order_id")
    .eq("id", paymentId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!pay) return { ok: false, error: "Payment not found", code: 404 };
  const p = pay as { direction: string; party_type: string; status: string };
  if (p.status !== "completed") {
    return { ok: false, error: `Cannot post a ${p.status} payment`, code: 409 };
  }
  if (p.direction === "in" && p.party_type === "customer") return postCustomerCollection(ctx, paymentId);
  if (p.direction === "out" && p.party_type === "supplier") return postSupplierPayment(ctx, paymentId);
  /* Other direction/party combos (refund-out to a customer, refund-in
     from a supplier, etc.) fall back to a generic bank-movement
     posting against the appropriate accounts. */
  if (p.direction === "in")  return postCustomerCollection(ctx, paymentId);
  return postSupplierPayment(ctx, paymentId);
}

/* ─── postCustomerCollection ────────────────────────────────────
   Cash received from a customer.
     Dr Bank — Operating       (1010)
     Cr Accounts Receivable    (1100)
*/

export async function postCustomerCollection(ctx: PostingContext, paymentId: string): Promise<PostingOutcome> {
  const existing = await findActiveEntryFor(ctx.tenantId, "payment", paymentId);
  if (existing) return { ok: true, entry_id: existing, journal_no: "", status: "posted" };

  const { data: pay } = await supabaseServer
    .from("finance_payments")
    .select("id, party_id, party_name, amount, currency, payment_date, reference_no")
    .eq("id", paymentId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!pay) return { ok: false, error: "Payment not found", code: 404 };
  const p = pay as { id: string; party_id: string | null; party_name: string; amount: number; currency: string; payment_date: string; reference_no: string | null };

  const accts = await loadAccountsByCode(ctx.tenantId);
  const bank = requireAccount(accts, "1010");
  const ar   = requireAccount(accts, "1100");
  const amt  = Number(p.amount) || 0;

  return createAndPost({
    tenantId: ctx.tenantId,
    postedBy: ctx.postedByAccountId,
    sourceType: "payment",
    sourceId: p.id,
    entryDate: p.payment_date,
    description: `Customer collection — ${p.party_name}${p.reference_no ? ` (ref ${p.reference_no})` : ""}`,
    metadata: { payment_id: p.id, party_id: p.party_id, party_type: "customer" },
    lines: [
      {
        account_id: bank.id,
        debit: amt,
        credit: 0,
        currency: p.currency,
        description: "Cash received",
        reference: p.reference_no,
      },
      {
        account_id: ar.id,
        debit: 0,
        credit: amt,
        currency: p.currency,
        description: "Settle receivable",
        party_id: p.party_id,
        party_type: "customer",
        reference: p.reference_no,
      },
    ],
  });
}

/* ─── postSupplierPayment ───────────────────────────────────────
   Cash paid to a supplier.
     Dr Accounts Payable       (2000)
     Cr Bank — Operating       (1010)
*/

export async function postSupplierPayment(ctx: PostingContext, paymentId: string): Promise<PostingOutcome> {
  const existing = await findActiveEntryFor(ctx.tenantId, "payment", paymentId);
  if (existing) return { ok: true, entry_id: existing, journal_no: "", status: "posted" };

  const { data: pay } = await supabaseServer
    .from("finance_payments")
    .select("id, party_id, party_name, amount, currency, payment_date, reference_no")
    .eq("id", paymentId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!pay) return { ok: false, error: "Payment not found", code: 404 };
  const p = pay as { id: string; party_id: string | null; party_name: string; amount: number; currency: string; payment_date: string; reference_no: string | null };

  const accts = await loadAccountsByCode(ctx.tenantId);
  const bank = requireAccount(accts, "1010");
  const ap   = requireAccount(accts, "2000");
  const amt  = Number(p.amount) || 0;

  return createAndPost({
    tenantId: ctx.tenantId,
    postedBy: ctx.postedByAccountId,
    sourceType: "payment",
    sourceId: p.id,
    entryDate: p.payment_date,
    description: `Supplier payment — ${p.party_name}${p.reference_no ? ` (ref ${p.reference_no})` : ""}`,
    metadata: { payment_id: p.id, party_id: p.party_id, party_type: "supplier" },
    lines: [
      {
        account_id: ap.id,
        debit: amt,
        credit: 0,
        currency: p.currency,
        description: "Settle payable",
        party_id: p.party_id,
        party_type: "supplier",
        reference: p.reference_no,
      },
      {
        account_id: bank.id,
        debit: 0,
        credit: amt,
        currency: p.currency,
        description: "Cash disbursed",
        reference: p.reference_no,
      },
    ],
  });
}

/* ─── postExpense ───────────────────────────────────────────────
   Maps the expense category to a debit account; the credit side
   depends on payment_status:
     · paid    →  Cr Bank — Operating  (1010)
     · unpaid  →  Cr Accounts Payable  (2000)

   Category mapping is intentionally coarse for A.1 — every expense
   posts against the generic Operating Expenses account (5000) unless
   the subtype matches one of the seeded subtypes (banking/shipping/
   customs). Later phases bind specific finance_expense_categories
   to specific GL accounts via a mapping table.
*/

const EXPENSE_CATEGORY_HINTS: Record<string, string> = {
  banking: "5100",
  bank:    "5100",
  freight: "5200",
  shipping:"5200",
  customs: "5300",
};

export async function postExpense(ctx: PostingContext, expenseId: string): Promise<PostingOutcome> {
  const existing = await findActiveEntryFor(ctx.tenantId, "expense", expenseId);
  if (existing) return { ok: true, entry_id: existing, journal_no: "", status: "posted" };

  const { data: exp } = await supabaseServer
    .from("finance_expenses")
    .select("id, title, amount, currency, expense_date, payment_status, linked_supplier_id, category_id")
    .eq("id", expenseId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!exp) return { ok: false, error: "Expense not found", code: 404 };
  const e = exp as { id: string; title: string; amount: number; currency: string; expense_date: string; payment_status: string; linked_supplier_id: string | null; category_id: string | null };

  const accts = await loadAccountsByCode(ctx.tenantId);
  /* Resolve the debit account from the category subtype hint, falling
     back to Operating Expenses (5000). */
  let debitCode = "5000";
  if (e.category_id) {
    const { data: cat } = await supabaseServer
      .from("finance_expense_categories")
      .select("name")
      .eq("id", e.category_id)
      .maybeSingle();
    const name = ((cat as { name?: string } | null)?.name ?? "").toLowerCase();
    for (const [hint, code] of Object.entries(EXPENSE_CATEGORY_HINTS)) {
      if (name.includes(hint)) { debitCode = code; break; }
    }
  }
  const debitAccount = requireAccount(accts, debitCode);
  const creditAccount = e.payment_status === "paid"
    ? requireAccount(accts, "1010")    // bank
    : requireAccount(accts, "2000");    // AP
  const amt = Number(e.amount) || 0;

  return createAndPost({
    tenantId: ctx.tenantId,
    postedBy: ctx.postedByAccountId,
    sourceType: "expense",
    sourceId: e.id,
    entryDate: e.expense_date,
    description: `Expense — ${e.title}`,
    metadata: { expense_id: e.id, payment_status: e.payment_status },
    lines: [
      {
        account_id: debitAccount.id,
        debit: amt,
        credit: 0,
        currency: e.currency,
        description: e.title,
        party_id: e.linked_supplier_id,
        party_type: e.linked_supplier_id ? "supplier" : null,
      },
      {
        account_id: creditAccount.id,
        debit: 0,
        credit: amt,
        currency: e.currency,
        description: e.payment_status === "paid" ? "Cash disbursed" : "Recognise payable",
        party_id: e.linked_supplier_id,
        party_type: e.linked_supplier_id ? "supplier" : null,
      },
    ],
  });
}

/* ─── postBankMovement ──────────────────────────────────────────
   A bank-reconciliation movement that isn't tied to an operational
   payment (one-off bank charge, interest credit, transfer between
   own accounts). Posts the value against the bank account on the
   appropriate side; the offset goes against a suspense account
   (Owner Capital, 3000) — operator can re-classify via a manual
   journal later. */

export async function postBankMovement(ctx: PostingContext, movementId: string): Promise<PostingOutcome> {
  const existing = await findActiveEntryFor(ctx.tenantId, "cash_movement", movementId);
  if (existing) return { ok: true, entry_id: existing, journal_no: "", status: "posted" };

  const { data: mov } = await supabaseServer
    .from("finance_cash_movements")
    .select("id, direction, amount, currency, movement_date, bank_reference, counterparty_name, related_payment_id")
    .eq("id", movementId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!mov) return { ok: false, error: "Cash movement not found", code: 404 };
  const m = mov as { id: string; direction: string; amount: number; currency: string; movement_date: string; bank_reference: string | null; counterparty_name: string | null; related_payment_id: string | null };
  /* If the movement is already tied to a payment, route through the
     payment posting so the AR/AP side reads correctly. */
  if (m.related_payment_id) return postPayment(ctx, m.related_payment_id);

  const accts = await loadAccountsByCode(ctx.tenantId);
  const bank = requireAccount(accts, "1010");
  const suspense = requireAccount(accts, "3000");     // Owner Capital — operator reclassifies later
  const amt = Number(m.amount) || 0;
  const inflow = m.direction === "inflow";

  return createAndPost({
    tenantId: ctx.tenantId,
    postedBy: ctx.postedByAccountId,
    sourceType: "cash_movement",
    sourceId: m.id,
    entryDate: m.movement_date,
    description: `Bank movement — ${m.counterparty_name ?? "unattributed"} ${m.bank_reference ? `(ref ${m.bank_reference})` : ""}`,
    metadata: { movement_id: m.id, direction: m.direction, suspense_default: true },
    lines: inflow
      ? [
          { account_id: bank.id,     debit: amt, credit: 0,   currency: m.currency, description: "Unclassified inflow",  reference: m.bank_reference },
          { account_id: suspense.id, debit: 0,   credit: amt, currency: m.currency, description: "Pending classification (Owner Capital — reclassify)", reference: m.bank_reference },
        ]
      : [
          { account_id: suspense.id, debit: amt, credit: 0,   currency: m.currency, description: "Pending classification (Owner Capital — reclassify)", reference: m.bank_reference },
          { account_id: bank.id,     debit: 0,   credit: amt, currency: m.currency, description: "Unclassified outflow", reference: m.bank_reference },
        ],
  });
}

/* ─── postOpeningBalance ────────────────────────────────────────
   Plant an initial balance on an asset / liability / equity account
   when migrating into KOLEEX Hub from another system.

   Convention:
     · positive amount on an asset/expense  →  Dr <account>, Cr Owner Capital
     · positive amount on a liability/equity/revenue → Dr Owner Capital, Cr <account>

   Owner Capital is the standard contra account for opening entries.
*/

export interface OpeningBalanceArgs {
  accountCode: string;
  amount: number;
  currency?: string;
  entryDate?: string;
  description?: string;
  /** Optional UUID-format unique id so the same opening balance can't
   *  post twice (the source_id partial unique index uses this column
   *  and the DB stores it as a uuid — callers must pass a real UUID,
   *  e.g. via `crypto.randomUUID()` or a deterministic v5 of their
   *  external bookkeeping reference). */
  openingId?: string;
}

export async function postOpeningBalance(ctx: PostingContext, args: OpeningBalanceArgs): Promise<PostingOutcome> {
  const accts = await loadAccountsByCode(ctx.tenantId);
  const target = accts.get(args.accountCode);
  if (!target) return { ok: false, error: `Account code ${args.accountCode} not found`, code: 404 };
  const owner = requireAccount(accts, "3000");
  const amt = Number(args.amount) || 0;
  if (amt === 0) return { ok: false, error: "Opening balance amount must be non-zero", code: 400 };

  /* Idempotency — if the caller passes openingId, use it as the
     source_id. Without it we accept the risk of duplicates. */
  const sourceId = args.openingId ?? null;
  if (sourceId) {
    const existing = await findActiveEntryFor(ctx.tenantId, "opening_balance", sourceId);
    if (existing) return { ok: true, entry_id: existing, journal_no: "", status: "posted" };
  }

  const entryDate = args.entryDate ?? new Date().toISOString().slice(0, 10);
  const currency = args.currency ?? "USD";
  const description = args.description ?? `Opening balance — ${target.code} ${target.name}`;

  /* For debit-normal accounts (asset / expense), a positive opening
     amount sits on the debit side. For credit-normal accounts, the
     positive amount sits on the credit side. Negative amounts flip
     the sides automatically. */
  const debitOnTarget = target.normal_balance === "debit" ? amt > 0 : amt < 0;
  const abs = Math.abs(amt);

  return createAndPost({
    tenantId: ctx.tenantId,
    postedBy: ctx.postedByAccountId,
    sourceType: "opening_balance",
    sourceId,
    entryDate,
    description,
    metadata: { account_code: target.code, opening_id: sourceId },
    lines: debitOnTarget
      ? [
          { account_id: target.id, debit: abs, credit: 0,   currency, description },
          { account_id: owner.id,  debit: 0,   credit: abs, currency, description: "Opening — Owner Capital" },
        ]
      : [
          { account_id: owner.id,  debit: abs, credit: 0,   currency, description: "Opening — Owner Capital" },
          { account_id: target.id, debit: 0,   credit: abs, currency, description },
        ],
  });
}

/* ─── Void helper ─────────────────────────────────────────────── */

export async function voidJournalEntry(ctx: PostingContext, entryId: string, reason: string): Promise<PostingOutcome> {
  /* Look up the entry's source so we can flip the operational row's
     accounting_status='voided' AFTER the reversal posts. The void RPC
     is atomic on the accounting side; this just mirrors the status. */
  const { data: entryData } = await supabaseServer
    .from("accounting_journal_entries")
    .select("source_type, source_id")
    .eq("id", entryId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  const { data, error } = await supabaseServer.rpc("fn_accounting_void_entry", {
    p_entry_id: entryId,
    p_tenant_id: ctx.tenantId,
    p_voided_by: ctx.postedByAccountId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message, code: 500 };
  const r = (data ?? {}) as { ok?: boolean; error?: string; code?: number; reversing_entry_id?: string; reversing_journal_no?: string };
  if (!r.ok) return { ok: false, error: r.error ?? "Void failed", code: r.code };

  /* Mirror the void back to the operational row. */
  if (entryData) {
    const src = entryData as { source_type: JournalSourceType; source_id: string | null };
    await setSourceAccountingStatus(ctx.tenantId, src.source_type, src.source_id, {
      accounting_status: "voided",
      accounting_last_error: null,
    });
  }

  return { ok: true, entry_id: r.reversing_entry_id!, journal_no: r.reversing_journal_no ?? "", status: "posted" };
}

/* ═══════════════════════════════════════════════════════════════════
   Phase A.2 — DRAFT-FIRST WORKFLOW PUBLIC API

   The functions below are the new operator-driven recognition path:
   create a draft now, review it in the Accounting Queue, post it
   when the accountant approves.

   Each draftXxx() resolves the right Dr/Cr accounts (same logic as
   the legacy postXxx) and creates a draft entry WITHOUT promoting
   it to posted. The operational row's accounting_status flips to
   'drafted' so the queue UI shows the new state immediately.
   ═══════════════════════════════════════════════════════════════════ */

/** Resolve the draft inputs for a payment, returning the
 *  DraftArgs (or an error). Shared by draftPayment + the
 *  retry path so the Dr/Cr math stays in one place. */
async function buildPaymentDraftArgs(ctx: PostingContext, paymentId: string): Promise<DraftArgs | PostingError> {
  const { data: pay } = await supabaseServer
    .from("finance_payments")
    .select("id, direction, party_type, party_id, party_name, amount, currency, payment_date, reference_no, status")
    .eq("id", paymentId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!pay) return { ok: false, error: "Payment not found", code: 404 };
  const p = pay as { id: string; direction: string; party_type: string; party_id: string | null; party_name: string; amount: number; currency: string; payment_date: string; reference_no: string | null; status: string };
  if (p.status !== "completed") {
    return { ok: false, error: `Cannot draft a ${p.status} payment`, code: 409 };
  }

  const accts = await loadAccountsByCode(ctx.tenantId);
  const bank = requireAccount(accts, "1010");
  const ar   = requireAccount(accts, "1100");
  const ap   = requireAccount(accts, "2000");
  const amt  = Number(p.amount) || 0;
  const isCustomerCollection = p.direction === "in";

  return {
    tenantId: ctx.tenantId,
    postedBy: ctx.postedByAccountId,
    sourceType: "payment",
    sourceId: p.id,
    entryDate: p.payment_date,
    description: isCustomerCollection
      ? `Customer collection — ${p.party_name}${p.reference_no ? ` (ref ${p.reference_no})` : ""}`
      : `Supplier payment — ${p.party_name}${p.reference_no ? ` (ref ${p.reference_no})` : ""}`,
    metadata: { payment_id: p.id, party_id: p.party_id, party_type: p.party_type, direction: p.direction },
    lines: isCustomerCollection
      ? [
          { account_id: bank.id, debit: amt, credit: 0, currency: p.currency, description: "Cash received", reference: p.reference_no },
          { account_id: ar.id,   debit: 0, credit: amt, currency: p.currency, description: "Settle receivable", party_id: p.party_id, party_type: "customer", reference: p.reference_no },
        ]
      : [
          { account_id: ap.id,   debit: amt, credit: 0, currency: p.currency, description: "Settle payable", party_id: p.party_id, party_type: "supplier", reference: p.reference_no },
          { account_id: bank.id, debit: 0, credit: amt, currency: p.currency, description: "Cash disbursed", reference: p.reference_no },
        ],
  };
}

const EXPENSE_CATEGORY_HINTS_DRAFT: Record<string, string> = {
  banking: "5100", bank: "5100", freight: "5200", shipping: "5200", customs: "5300",
};

async function buildExpenseDraftArgs(ctx: PostingContext, expenseId: string): Promise<DraftArgs | PostingError> {
  const { data: exp } = await supabaseServer
    .from("finance_expenses")
    .select("id, title, amount, currency, expense_date, payment_status, linked_supplier_id, category_id")
    .eq("id", expenseId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!exp) return { ok: false, error: "Expense not found", code: 404 };
  const e = exp as { id: string; title: string; amount: number; currency: string; expense_date: string; payment_status: string; linked_supplier_id: string | null; category_id: string | null };

  const accts = await loadAccountsByCode(ctx.tenantId);
  let debitCode = "5000";
  if (e.category_id) {
    const { data: cat } = await supabaseServer
      .from("finance_expense_categories")
      .select("name")
      .eq("id", e.category_id)
      .maybeSingle();
    const name = ((cat as { name?: string } | null)?.name ?? "").toLowerCase();
    for (const [hint, code] of Object.entries(EXPENSE_CATEGORY_HINTS_DRAFT)) {
      if (name.includes(hint)) { debitCode = code; break; }
    }
  }
  const debitAccount = requireAccount(accts, debitCode);
  const creditAccount = e.payment_status === "paid"
    ? requireAccount(accts, "1010")
    : requireAccount(accts, "2000");
  const amt = Number(e.amount) || 0;

  return {
    tenantId: ctx.tenantId,
    postedBy: ctx.postedByAccountId,
    sourceType: "expense",
    sourceId: e.id,
    entryDate: e.expense_date,
    description: `Expense — ${e.title}`,
    metadata: { expense_id: e.id, payment_status: e.payment_status },
    lines: [
      { account_id: debitAccount.id, debit: amt, credit: 0, currency: e.currency, description: e.title, party_id: e.linked_supplier_id, party_type: e.linked_supplier_id ? "supplier" : null },
      { account_id: creditAccount.id, debit: 0, credit: amt, currency: e.currency, description: e.payment_status === "paid" ? "Cash disbursed" : "Recognise payable", party_id: e.linked_supplier_id, party_type: e.linked_supplier_id ? "supplier" : null },
    ],
  };
}

async function buildCashMovementDraftArgs(ctx: PostingContext, movementId: string): Promise<DraftArgs | PostingError | { redirectPaymentId: string }> {
  const { data: mov } = await supabaseServer
    .from("finance_cash_movements")
    .select("id, direction, amount, currency, movement_date, bank_reference, counterparty_name, related_payment_id")
    .eq("id", movementId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!mov) return { ok: false, error: "Cash movement not found", code: 404 };
  const m = mov as { id: string; direction: string; amount: number; currency: string; movement_date: string; bank_reference: string | null; counterparty_name: string | null; related_payment_id: string | null };
  if (m.related_payment_id) return { redirectPaymentId: m.related_payment_id };

  const accts = await loadAccountsByCode(ctx.tenantId);
  const bank = requireAccount(accts, "1010");
  const suspense = requireAccount(accts, "3000");
  const amt = Number(m.amount) || 0;
  const inflow = m.direction === "inflow";

  return {
    tenantId: ctx.tenantId,
    postedBy: ctx.postedByAccountId,
    sourceType: "cash_movement",
    sourceId: m.id,
    entryDate: m.movement_date,
    description: `Bank movement — ${m.counterparty_name ?? "unattributed"} ${m.bank_reference ? `(ref ${m.bank_reference})` : ""}`,
    metadata: { movement_id: m.id, direction: m.direction, suspense_default: true },
    lines: inflow
      ? [
          { account_id: bank.id,     debit: amt, credit: 0,   currency: m.currency, description: "Unclassified inflow",  reference: m.bank_reference },
          { account_id: suspense.id, debit: 0,   credit: amt, currency: m.currency, description: "Pending classification (Owner Capital — reclassify)", reference: m.bank_reference },
        ]
      : [
          { account_id: suspense.id, debit: amt, credit: 0,   currency: m.currency, description: "Pending classification (Owner Capital — reclassify)", reference: m.bank_reference },
          { account_id: bank.id,     debit: 0,   credit: amt, currency: m.currency, description: "Unclassified outflow", reference: m.bank_reference },
        ],
  };
}

/* Draft-only public posters. Each returns the new draft entry id;
   the operator promotes it to posted via postDraftedEntry. */

export async function draftPayment(ctx: PostingContext, paymentId: string): Promise<PostingOutcome> {
  /* Idempotent — if an active (non-voided) entry already exists for
     this source we return that one. Drafted, posted, and failed all
     count as "exists"; only voided makes a slot available. */
  const existing = await findActiveEntryFor(ctx.tenantId, "payment", paymentId);
  if (existing) return { ok: true, entry_id: existing, journal_no: "", status: "draft" };

  const args = await buildPaymentDraftArgs(ctx, paymentId);
  if ("ok" in args && args.ok === false) return args;
  return createDraft(args as DraftArgs);
}

export async function draftExpense(ctx: PostingContext, expenseId: string): Promise<PostingOutcome> {
  const existing = await findActiveEntryFor(ctx.tenantId, "expense", expenseId);
  if (existing) return { ok: true, entry_id: existing, journal_no: "", status: "draft" };
  const args = await buildExpenseDraftArgs(ctx, expenseId);
  if ("ok" in args && args.ok === false) return args;
  return createDraft(args as DraftArgs);
}

export async function draftCashMovement(ctx: PostingContext, movementId: string): Promise<PostingOutcome> {
  const existing = await findActiveEntryFor(ctx.tenantId, "cash_movement", movementId);
  if (existing) return { ok: true, entry_id: existing, journal_no: "", status: "draft" };
  const args = await buildCashMovementDraftArgs(ctx, movementId);
  if ("redirectPaymentId" in args) return draftPayment(ctx, args.redirectPaymentId);
  if ("ok" in args && args.ok === false) return args;
  return createDraft(args as DraftArgs);
}

/** Promote a drafted entry to posted. Looks up the entry's source
 *  internally so the operational row's status mirrors the journal. */
export async function postDraftedEntry(ctx: PostingContext, entryId: string): Promise<PostingOutcome> {
  return postExistingDraft(ctx.tenantId, ctx.postedByAccountId, entryId);
}

/** Retry a failed source. Looks for an existing active draft and
 *  posts it; if none exists, re-runs the appropriate draftXxx then
 *  posts. Clears accounting_last_error on success. */
export async function retryRecognition(ctx: PostingContext, kind: "payment" | "expense" | "cash_movement", sourceId: string): Promise<PostingOutcome> {
  const existing = await findActiveEntryFor(ctx.tenantId, kind, sourceId);
  if (existing) {
    return postExistingDraft(ctx.tenantId, ctx.postedByAccountId, existing);
  }
  /* No surviving draft — rebuild from scratch and post. */
  const drafted = kind === "payment" ? await draftPayment(ctx, sourceId)
    : kind === "expense" ? await draftExpense(ctx, sourceId)
    : await draftCashMovement(ctx, sourceId);
  if (!drafted.ok) return drafted;
  return postExistingDraft(ctx.tenantId, ctx.postedByAccountId, drafted.entry_id);
}

/* ═══════════════════════════════════════════════════════════════════
   Phase A.4 — Inventory COGS recognition

   When a sales shipment is shipped, every shipment line is backed by
   a posted inventory OUT movement. Phase O.5 stamped each of those
   with `total_cost = qty × current_avg`. Summing them gives the
   shipment-level COGS:

     Dr 5400  Cost of Goods Sold
     Cr 1400  Inventory Asset

   This is drafted only — the accountant promotes it to posted from
   the queue. No auto-post.
   ═══════════════════════════════════════════════════════════════════ */

async function buildInventoryCogsDraftArgs(
  ctx: PostingContext,
  shipmentId: string,
): Promise<DraftArgs | PostingError> {
  /* Load the shipment header. */
  const { data: shipRow } = await supabaseServer
    .from("sales_shipments")
    .select("id, sales_order_id, shipment_no, status, customer_id, shipped_at, created_at")
    .eq("id", shipmentId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!shipRow) return { ok: false, error: "Shipment not found", code: 404 };
  const ship = shipRow as { id: string; sales_order_id: string; shipment_no: string; status: string; customer_id: string | null; shipped_at: string | null; created_at: string };
  if (ship.status !== "shipped") {
    return { ok: false, error: `Cannot draft COGS for shipment with status '${ship.status}'`, code: 409 };
  }

  /* Sum total_cost from every linked OUT movement. The shipment line
     already stores inventory_movement_id; we read the movements to
     respect the append-only ledger as the cost-of-truth. */
  const { data: shipLines } = await supabaseServer
    .from("sales_shipment_items")
    .select("id, inventory_movement_id")
    .eq("shipment_id", shipmentId)
    .eq("tenant_id", ctx.tenantId);
  const movementIds = ((shipLines ?? []) as Array<{ inventory_movement_id: string | null }>)
    .map((l) => l.inventory_movement_id)
    .filter((x): x is string => !!x);

  if (movementIds.length === 0) {
    return { ok: false, error: "Shipment has no inventory movements — nothing to recognise as COGS", code: 422 };
  }

  const { data: movements } = await supabaseServer
    .from("inventory_stock_movements")
    .select("id, total_cost, currency, status")
    .in("id", movementIds)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "posted");
  const rows = ((movements ?? []) as Array<{ id: string; total_cost: number | null; currency: string; status: string }>);

  const totalCost = rows.reduce((acc, m) => acc + (Number(m.total_cost) || 0), 0);
  const currency = rows[0]?.currency ?? "USD";

  if (totalCost <= 0) {
    /* A shipment whose lines all had zero cost (e.g. opening balance
       items with no cost basis) cannot be drafted — there's nothing
       to recognise. The operator can wait until cost basis exists. */
    return { ok: false, error: "Shipment total_cost is zero — no COGS to recognise", code: 422 };
  }

  const accts = await loadAccountsByCode(ctx.tenantId);
  const cogs       = requireAccount(accts, "5400");
  const invAsset   = requireAccount(accts, "1400");
  const entryDate  = (ship.shipped_at ?? ship.created_at).slice(0, 10);

  return {
    tenantId: ctx.tenantId,
    postedBy: ctx.postedByAccountId,
    sourceType: "inventory_cogs",
    sourceId: ship.id,
    entryDate,
    description: `COGS · ${ship.shipment_no}`,
    metadata: { shipment_no: ship.shipment_no, sales_order_id: ship.sales_order_id },
    lines: [
      { account_id: cogs.id,     debit: totalCost, credit: 0,         currency, description: "Cost of Goods Sold", reference: ship.shipment_no },
      { account_id: invAsset.id, debit: 0,         credit: totalCost, currency, description: "Inventory Asset",    reference: ship.shipment_no },
    ],
  };
}

/** Draft (only) a COGS entry for a shipped sales shipment.
 *  Idempotent — repeats return the existing active draft. */
export async function draftInventoryCogs(
  ctx: PostingContext,
  shipmentId: string,
): Promise<PostingOutcome> {
  const existing = await findActiveEntryFor(ctx.tenantId, "inventory_cogs", shipmentId);
  if (existing) return { ok: true, entry_id: existing, journal_no: "", status: "draft" };

  const args = await buildInventoryCogsDraftArgs(ctx, shipmentId);
  if ("ok" in args && args.ok === false) return args;
  return createDraft(args as DraftArgs);
}

/** Convenience: draft + post in one call. The validator uses this
 *  to assert the end state; production flow keeps it operator-driven
 *  via the queue UI. */
export async function postInventoryCogs(
  ctx: PostingContext,
  shipmentId: string,
): Promise<PostingOutcome> {
  const drafted = await draftInventoryCogs(ctx, shipmentId);
  if (!drafted.ok) return drafted;
  return postExistingDraft(ctx.tenantId, ctx.postedByAccountId, drafted.entry_id);
}
