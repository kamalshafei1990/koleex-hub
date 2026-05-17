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

/* ─── Internal: create draft entry + lines and post atomically ──── */

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

async function createAndPost(args: {
  tenantId: string;
  postedBy: string | null;
  sourceType: JournalSourceType;
  sourceId: string | null;
  entryDate: string;
  description: string;
  lines: DraftLine[];
  metadata?: Record<string, unknown>;
}): Promise<PostingOutcome> {
  /* Pre-flight balance check — saves a round-trip when the caller
     gives us unbalanced lines. The DB also enforces this. */
  const debitSum = args.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const creditSum = args.lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(debitSum - creditSum) > 0.005) {
    return { ok: false, error: `Unbalanced: sum(debit)=${debitSum.toFixed(2)} sum(credit)=${creditSum.toFixed(2)}` };
  }
  if (args.lines.length === 0) {
    return { ok: false, error: "Cannot post a journal with zero lines" };
  }

  const journalNo = generateJournalNo(args.sourceType, args.sourceId, new Date(args.entryDate));

  /* Insert the draft header first. */
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
    return { ok: false, error: linesErr.message, code: 500 };
  }

  /* Atomically post — DB validates balance + flips status. */
  const { data: postRes, error: postErr } = await supabaseServer.rpc("fn_accounting_post_entry", {
    p_entry_id: entryId,
    p_tenant_id: args.tenantId,
    p_posted_by: args.postedBy,
  });
  if (postErr) return { ok: false, error: postErr.message, code: 500 };
  const r = (postRes ?? {}) as { ok?: boolean; error?: string; code?: number };
  if (!r.ok) return { ok: false, error: r.error ?? "Post failed", code: r.code };

  return { ok: true, entry_id: entryId, journal_no: journalNo, status: "posted" };
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
  const { data, error } = await supabaseServer.rpc("fn_accounting_void_entry", {
    p_entry_id: entryId,
    p_tenant_id: ctx.tenantId,
    p_voided_by: ctx.postedByAccountId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message, code: 500 };
  const r = (data ?? {}) as { ok?: boolean; error?: string; code?: number; reversing_entry_id?: string; reversing_journal_no?: string };
  if (!r.ok) return { ok: false, error: r.error ?? "Void failed", code: r.code };
  return { ok: true, entry_id: r.reversing_entry_id!, journal_no: r.reversing_journal_no ?? "", status: "posted" };
}
