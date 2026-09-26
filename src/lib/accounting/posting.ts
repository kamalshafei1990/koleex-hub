import "server-only";

/* ===========================================================================
   Posting engine — the only writer of the general ledger.

   One source document → one balanced journal entry, in two steps:
     draft   the lines are built from the source row and inserted as
             status='draft'; the source row mirrors accounting_status='drafted'
     post    fn_accounting_post_entry flips it to 'posted' after asserting
             debits = credits IN BASE CURRENCY and that the period is open

   Rules every builder follows:
     · the tenant is part of every read; a foreign id is "not found"
     · the source must be APPROVED (payments, expenses, bills, payroll) —
       the ledger never learns about something nobody signed off
     · every line carries the exchange rate to the tenant base currency,
       fixed at draft time from finance_fx_rates; a missing rate fails the
       draft with a message that says which rate to add
     · amounts are rounded to 2 dp before they are written
     · the partial unique index on (tenant, source_type, source_id) for
       non-voided entries makes re-posting a no-op; an existing DRAFT is
       posted rather than reported as already posted

   Debit / credit map (codes from fn_accounting_ensure_coa):
     customer collection      Dr 1010 Bank         / Cr 1100 A/R
     supplier payment         Dr 2000 A/P          / Cr 1010 Bank
     refund from supplier     Dr 1010 Bank         / Cr 2000 A/P
     refund to customer       Dr 1100 A/R          / Cr 1010 Bank
     other party in / out     Dr 1010 / Cr 4100    ·  Dr 5000 / Cr 1010
     expense                  Dr 5xxx (category)   / Cr 1010 if paid with no
                              linked payment, else Cr 2000 A/P
     bank movement            Dr/Cr 1010           / 1090 Bank Clearing
     opening balance          Dr/Cr account        / 3000 Owner Capital
     invoice (revenue)        Dr 1100 A/R          / Cr 4000 Sales, Cr 2200 Tax
     shipment (COGS)          Dr 5400 COGS         / Cr 1400 Inventory
     purchase receipt         Dr 1400 Inventory    / Cr 2010 GRNI
     vendor bill              Dr 2010 GRNI or 5xxx, Dr 2200 tax / Cr 2000 A/P
     payroll run              Dr 5500 Salaries, Dr 5510 Employer /
                              Cr 2300 Net pay, Cr 2310 Deductions
     FX exchange              Dr Bank(to) / Cr Bank(from), difference → 4900/5900
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency, resolveRate } from "@/lib/finance/currency";
import { employerTotal, payrollLines, totalsByCurrency, type CurrencyTotal } from "@/lib/hr/payroll-totals";
import type {
  AccountingAccount,
  PostingContext,
  PostingError,
  PostingOutcome,
  JournalSourceType,
} from "./types";

/* ─── Kinds a source document can be ────────────────────────────── */

export type SourceKind =
  | "payment"
  | "expense"
  | "cash_movement"
  | "inventory_cogs"
  | "sales_revenue"
  | "vendor_bill"
  | "inventory_receipt"
  | "payroll"
  | "fx_exchange";

export const SOURCE_KINDS: readonly SourceKind[] = [
  "payment", "expense", "cash_movement", "inventory_cogs", "sales_revenue",
  "vendor_bill", "inventory_receipt", "payroll", "fx_exchange",
];

export function isSourceKind(v: unknown): v is SourceKind {
  return typeof v === "string" && (SOURCE_KINDS as readonly string[]).includes(v);
}

/** The operational table that mirrors accounting_status for a source type. */
export function sourceTableFor(sourceType: JournalSourceType): string | null {
  switch (sourceType) {
    case "payment":           return "finance_payments";
    case "expense":           return "finance_expenses";
    case "cash_movement":     return "finance_cash_movements";
    case "inventory_cogs":    return "sales_shipments";
    case "sales_revenue":     return "invoices";
    case "vendor_bill":       return "vendor_bills";
    case "inventory_receipt": return "purchase_receipts";
    case "payroll":           return "hr_payroll_runs";
    case "fx_exchange":       return "finance_fx_exchanges";
    case "opening_balance":   return "finance_opening_balances";
    default:                  return null;
  }
}

/* ─── COA helpers ─────────────────────────────────────────────── */

async function loadAccountsByCode(tenantId: string): Promise<Map<string, AccountingAccount>> {
  /* Idempotent seed — ON CONFLICT DO NOTHING, so a seeded tenant is a no-op. */
  await supabaseServer.rpc("fn_accounting_ensure_coa", { p_tenant_id: tenantId });
  /* One child of 1010 per bank account, so a bank balance is a ledger figure. */
  await supabaseServer.rpc("fn_accounting_ensure_bank_accounts", { p_tenant_id: tenantId });
  const { data } = await supabaseServer
    .from("accounting_accounts")
    .select("id, code, name, type, subtype, normal_balance, is_active")
    .eq("tenant_id", tenantId);
  const map = new Map<string, AccountingAccount>();
  for (const a of (data ?? []) as AccountingAccount[]) map.set(a.code, a);
  return map;
}

interface BankRow { id: string; gl_account_id: string | null; currency: string; is_primary: boolean; status: string }

/** The GL account a bank-side line posts to: the named bank account's own
 *  sub-account; otherwise the tenant's primary account in that currency,
 *  then any active account in that currency, then the primary; the parent
 *  1010 only when the tenant has no bank accounts at all. */
async function resolveBankGl(tenantId: string, accts: Map<string, AccountingAccount>, bankAccountId: string | null | undefined, currency: string): Promise<AccountingAccount> {
  const { data } = await supabaseServer
    .from("finance_bank_accounts")
    .select("id, gl_account_id, currency, is_primary, status")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);
  const banks = (data ?? []) as BankRow[];
  const active = banks.filter((b) => b.status === "active");
  const ccy = currency.toUpperCase();
  const pick =
    (bankAccountId ? banks.find((b) => b.id === bankAccountId) : undefined) ??
    active.find((b) => b.currency.toUpperCase() === ccy && b.is_primary) ??
    active.find((b) => b.currency.toUpperCase() === ccy) ??
    active.find((b) => b.is_primary) ??
    active[0];
  if (pick?.gl_account_id) {
    for (const a of accts.values()) if (a.id === pick.gl_account_id) return a;
  }
  return requireAccount(accts, "1010");
}

function requireAccount(map: Map<string, AccountingAccount>, code: string): AccountingAccount {
  const a = map.get(code);
  if (!a) throw new Error(`Missing required account code ${code} — COA seeding incomplete`);
  return a;
}

/* ─── Period lock ─────────────────────────────────────────────── */

export async function lockedThrough(tenantId: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("accounting_period_locks")
    .select("locked_through")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as { locked_through: string } | null)?.locked_through ?? null;
}

const dmy = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };

/** Null when the date may be posted into; otherwise the reason. */
export async function periodClosedReason(tenantId: string, entryDate: string): Promise<string | null> {
  const lock = await lockedThrough(tenantId);
  if (lock && entryDate <= lock) return `Period is closed through ${dmy(lock)} — date the entry after it or reopen the period`;
  return null;
}

/* ─── Exchange rates: every line knows its base value ───────────── */

interface DraftLine {
  account_id: string;
  debit: number;
  credit: number;
  currency: string;
  /** Base units per 1 unit of `currency`. Filled by stampRates when absent. */
  exchange_rate?: number;
  description?: string | null;
  party_id?: string | null;
  party_type?: "customer" | "supplier" | null;
  reference?: string | null;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

async function stampRates(tenantId: string, lines: DraftLine[], entryDate: string): Promise<DraftLine[] | PostingError> {
  const base = await resolveBaseCurrency(tenantId);
  const rates = new Map<string, number>();
  for (const l of lines) {
    const ccy = (l.currency || base).trim().toUpperCase();
    if (l.exchange_rate && Number.isFinite(l.exchange_rate) && l.exchange_rate > 0) continue;
    if (rates.has(ccy)) continue;
    if (ccy === base) { rates.set(ccy, 1); continue; }
    try {
      const r = await resolveRate({ tenantId, from: ccy, to: base, date: entryDate });
      rates.set(ccy, r.rate);
    } catch (e) {
      return { ok: false, code: 422, error: e instanceof Error ? e.message : `No FX rate ${ccy}→${base}` };
    }
  }
  return lines.map((l) => {
    const ccy = (l.currency || base).trim().toUpperCase();
    return { ...l, currency: ccy, debit: r2(l.debit), credit: r2(l.credit), exchange_rate: l.exchange_rate && l.exchange_rate > 0 ? l.exchange_rate : rates.get(ccy) ?? 1 };
  });
}

/* ─── Journal numbers ─────────────────────────────────────────── */

const PREFIX: Record<string, string> = {
  payment: "JE-PAY", expense: "JE-EXP", cash_movement: "JE-MOV", opening_balance: "JE-OB",
  inventory_cogs: "JE-COGS", sales_revenue: "JE-REV", vendor_bill: "JE-BILL",
  inventory_receipt: "JE-GRN", payroll: "JE-PAYROLL", fx_exchange: "JE-FX", manual: "JE-MAN",
};

/** Source-derived numbers are stable per source (the last 6 hex of its id),
 *  so an operator recognises the same document across re-drafts; a voided
 *  predecessor makes the next one `-R2`, `-R3`… Manual and opening entries
 *  take the tenant's sequence. */
async function nextJournalNo(tenantId: string, sourceType: JournalSourceType, sourceId: string | null, date: string): Promise<string> {
  const prefix = PREFIX[sourceType] ?? "JE-MAN";
  if (!sourceId) {
    const { data } = await supabaseServer.rpc("fn_accounting_next_journal_no", { p_tenant_id: tenantId, p_prefix: prefix });
    return (data as string | null) ?? `${prefix}-${Date.now().toString(16).toUpperCase()}`;
  }
  const base = `${prefix}-${date.replace(/-/g, "")}-${sourceId.replace(/-/g, "").slice(-6).toUpperCase()}`;
  const { count } = await supabaseServer
    .from("accounting_journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .like("journal_no", `${base}%`);
  return count && count > 0 ? `${base}-R${count + 1}` : base;
}

/* ─── Existing-entry probe ─────────────────────────────────────── */

async function findActiveEntryFor(tenantId: string, sourceType: JournalSourceType, sourceId: string): Promise<{ id: string; journal_no: string; status: "draft" | "posted" } | null> {
  const { data } = await supabaseServer
    .from("accounting_journal_entries")
    .select("id, journal_no, status")
    .eq("tenant_id", tenantId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .neq("status", "voided")
    .maybeSingle();
  return (data as { id: string; journal_no: string; status: "draft" | "posted" } | null) ?? null;
}

/* ─── Source-row mirror ─────────────────────────────────────────── */

type MirrorStatus = "pending" | "drafted" | "posted" | "failed" | "voided";

async function setSourceAccountingStatus(
  tenantId: string,
  sourceType: JournalSourceType,
  sourceId: string | null,
  patch: { accounting_status: MirrorStatus; accounting_entry_id?: string | null; accounting_last_error?: string | null; accounting_posted_at?: string | null },
): Promise<void> {
  if (!sourceId) return;
  const tbl = sourceTableFor(sourceType);
  if (!tbl) return;
  const { error } = await supabaseServer.from(tbl).update(patch).eq("id", sourceId).eq("tenant_id", tenantId);
  if (error) console.error(`[accounting] mirror ${tbl}/${sourceId}:`, error.message);
}

/* ─── Draft + post core ─────────────────────────────────────────── */

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
  const fail = async (error: string, code?: number): Promise<PostingError> => {
    await setSourceAccountingStatus(args.tenantId, args.sourceType, args.sourceId, { accounting_status: "failed", accounting_last_error: error });
    return { ok: false, error, code };
  };

  if (args.lines.length === 0) return fail("Cannot post a journal with zero lines", 422);
  const closed = await periodClosedReason(args.tenantId, args.entryDate);
  if (closed) return fail(closed, 423);

  const stamped = await stampRates(args.tenantId, args.lines, args.entryDate);
  if ("ok" in stamped) return fail(stamped.error, stamped.code);
  for (const l of stamped) {
    if ((l.debit > 0) === (l.credit > 0)) return fail("Each line must carry exactly one side (debit or credit) greater than zero", 422);
  }
  const debitBase  = stamped.reduce((s, l) => s + l.debit  * (l.exchange_rate ?? 1), 0);
  const creditBase = stamped.reduce((s, l) => s + l.credit * (l.exchange_rate ?? 1), 0);
  if (Math.abs(debitBase - creditBase) > 0.01) {
    return fail(`Unbalanced in base currency: debit ${debitBase.toFixed(2)} vs credit ${creditBase.toFixed(2)}`, 422);
  }

  const journalNo = await nextJournalNo(args.tenantId, args.sourceType, args.sourceId, args.entryDate);
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
      approval_status: "approved",
    })
    .select("id")
    .single();
  if (entryErr || !entryRow) {
    /* Most common cause: a concurrent draft for the same source hit the
       partial unique index. Hand back the existing entry instead of a failure. */
    if (args.sourceId) {
      const existing = await findActiveEntryFor(args.tenantId, args.sourceType, args.sourceId);
      if (existing) return { ok: true, entry_id: existing.id, journal_no: existing.journal_no, status: existing.status };
    }
    return fail(entryErr?.message ?? "Insert failed", 409);
  }
  const entryId = (entryRow as { id: string }).id;

  const { error: linesErr } = await supabaseServer.from("accounting_journal_lines").insert(
    stamped.map((l, i) => ({
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
    })),
  );
  if (linesErr) {
    await supabaseServer.from("accounting_journal_entries").delete().eq("id", entryId).eq("tenant_id", args.tenantId);
    return fail(linesErr.message, 500);
  }

  await setSourceAccountingStatus(args.tenantId, args.sourceType, args.sourceId, {
    accounting_status: "drafted", accounting_entry_id: entryId, accounting_last_error: null,
  });
  return { ok: true, entry_id: entryId, journal_no: journalNo, status: "draft" };
}

async function postExistingDraft(tenantId: string, postedBy: string | null, entryId: string): Promise<PostingOutcome> {
  const { data: entryData } = await supabaseServer
    .from("accounting_journal_entries")
    .select("id, source_type, source_id, journal_no, status")
    .eq("id", entryId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!entryData) return { ok: false, error: "Entry not found", code: 404 };
  const entry = entryData as { id: string; source_type: JournalSourceType; source_id: string | null; journal_no: string; status: string };
  if (entry.status === "posted") return { ok: true, entry_id: entry.id, journal_no: entry.journal_no, status: "posted" };
  if (entry.status === "voided") return { ok: false, error: "Entry was voided", code: 409 };

  const { data: postRes, error: postErr } = await supabaseServer.rpc("fn_accounting_post_entry", {
    p_entry_id: entryId, p_tenant_id: tenantId, p_posted_by: postedBy,
  });
  const r = (postRes ?? {}) as { ok?: boolean; error?: string; code?: number };
  if (postErr || !r.ok) {
    const error = postErr?.message ?? r.error ?? "Post failed";
    await setSourceAccountingStatus(tenantId, entry.source_type, entry.source_id, { accounting_status: "failed", accounting_last_error: error });
    return { ok: false, error, code: postErr ? 500 : r.code };
  }
  await setSourceAccountingStatus(tenantId, entry.source_type, entry.source_id, {
    accounting_status: "posted", accounting_entry_id: entry.id, accounting_posted_at: new Date().toISOString(), accounting_last_error: null,
  });
  return { ok: true, entry_id: entry.id, journal_no: entry.journal_no, status: "posted" };
}

async function createAndPost(args: DraftArgs): Promise<PostingOutcome> {
  const drafted = await createDraft(args);
  if (!drafted.ok) return drafted;
  if (drafted.status === "posted") return drafted;
  return postExistingDraft(args.tenantId, args.postedBy, drafted.entry_id);
}

/* ═══════════════════════════════════════════════════════════════════
   BUILDERS — one per source document. Each returns DraftArgs or an error.
   ═══════════════════════════════════════════════════════════════════ */

const APPROVED = new Set(["approved", "partially_approved"]);
const notApproved = (what: string, status: string | null): PostingError => ({
  ok: false, code: 409, error: `${what} is ${status ?? "not approved"} — approve it before it reaches the ledger`,
});

async function buildPayment(ctx: PostingContext, paymentId: string): Promise<DraftArgs | PostingError> {
  const { data } = await supabaseServer
    .from("finance_payments")
    .select("id, direction, party_type, party_id, party_name, amount, currency, payment_date, reference_no, status, approval_status, linked_invoice_id, linked_expense_id, bank_account_id")
    .eq("id", paymentId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Payment not found", code: 404 };
  const p = data as { id: string; direction: "in" | "out"; party_type: string; party_id: string | null; party_name: string; amount: number; currency: string; payment_date: string; reference_no: string | null; status: string; approval_status: string | null; linked_invoice_id: string | null; linked_expense_id: string | null; bank_account_id: string | null };
  if (p.status !== "completed") return { ok: false, error: `Cannot post a ${p.status} payment`, code: 409 };
  if (!APPROVED.has(p.approval_status ?? "")) return notApproved("Payment", p.approval_status);

  const accts = await loadAccountsByCode(ctx.tenantId);
  const bank = await resolveBankGl(ctx.tenantId, accts, p.bank_account_id, p.currency);
  const amt = r2(p.amount);
  const ref = p.reference_no;
  const party = { party_id: p.party_id, party_type: (p.party_type === "customer" || p.party_type === "supplier" ? p.party_type : null) as "customer" | "supplier" | null };

  let lines: DraftLine[];
  let description: string;
  if (p.direction === "in" && p.party_type === "customer") {
    description = `Customer collection — ${p.party_name}`;
    lines = [
      { account_id: bank.id, debit: amt, credit: 0, currency: p.currency, description: "Cash received", reference: ref },
      { account_id: requireAccount(accts, "1100").id, debit: 0, credit: amt, currency: p.currency, description: "Settle receivable", reference: ref, ...party },
    ];
  } else if (p.direction === "out" && p.party_type === "supplier") {
    description = `Supplier payment — ${p.party_name}`;
    lines = [
      { account_id: requireAccount(accts, "2000").id, debit: amt, credit: 0, currency: p.currency, description: "Settle payable", reference: ref, ...party },
      { account_id: bank.id, debit: 0, credit: amt, currency: p.currency, description: "Cash disbursed", reference: ref },
    ];
  } else if (p.direction === "in" && p.party_type === "supplier") {
    description = `Refund from supplier — ${p.party_name}`;
    lines = [
      { account_id: bank.id, debit: amt, credit: 0, currency: p.currency, description: "Refund received", reference: ref },
      { account_id: requireAccount(accts, "2000").id, debit: 0, credit: amt, currency: p.currency, description: "Reduce payable", reference: ref, ...party },
    ];
  } else if (p.direction === "out" && p.party_type === "customer") {
    description = `Refund to customer — ${p.party_name}`;
    lines = [
      { account_id: requireAccount(accts, "1100").id, debit: amt, credit: 0, currency: p.currency, description: "Refund receivable", reference: ref, ...party },
      { account_id: bank.id, debit: 0, credit: amt, currency: p.currency, description: "Refund paid", reference: ref },
    ];
  } else if (p.direction === "in") {
    description = `Other receipt — ${p.party_name}`;
    lines = [
      { account_id: bank.id, debit: amt, credit: 0, currency: p.currency, description: "Cash received", reference: ref },
      { account_id: requireAccount(accts, "4100").id, debit: 0, credit: amt, currency: p.currency, description: "Other income", reference: ref },
    ];
  } else {
    description = `Other disbursement — ${p.party_name}`;
    lines = [
      { account_id: requireAccount(accts, "5000").id, debit: amt, credit: 0, currency: p.currency, description: "Operating expense", reference: ref },
      { account_id: bank.id, debit: 0, credit: amt, currency: p.currency, description: "Cash disbursed", reference: ref },
    ];
  }
  if (ref) description += ` (ref ${ref})`;

  return {
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "payment", sourceId: p.id, entryDate: p.payment_date, description,
    metadata: { payment_id: p.id, party_id: p.party_id, party_type: p.party_type, direction: p.direction, invoice_id: p.linked_invoice_id, expense_id: p.linked_expense_id, bank_account_id: p.bank_account_id, bank_gl: bank.code },
    lines,
  };
}

/** Expense category → debit account, by the category name. Later a mapping
 *  column on finance_expense_categories replaces the word match. */
const EXPENSE_CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/bank/i, "5100"], [/freight|shipping|courier/i, "5200"], [/customs|duty/i, "5300"],
  [/salar|payroll|wage/i, "5500"], [/depreciat/i, "5600"],
];

async function buildExpense(ctx: PostingContext, expenseId: string): Promise<DraftArgs | PostingError> {
  const { data } = await supabaseServer
    .from("finance_expenses")
    .select("id, title, amount, currency, expense_date, payment_status, approval_status, linked_supplier_id, category_id, category:category_id ( name )")
    .eq("id", expenseId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Expense not found", code: 404 };
  const e = data as unknown as { id: string; title: string; amount: number; currency: string; expense_date: string; payment_status: string; approval_status: string | null; linked_supplier_id: string | null; category_id: string | null; category: { name?: string } | { name?: string }[] | null };
  if (!APPROVED.has(e.approval_status ?? "")) return notApproved("Expense", e.approval_status);

  /* A payment row that settles this expense posts its own Dr A/P / Cr Bank,
     so the expense credits A/P even when it is marked paid — otherwise the
     bank would be credited twice. */
  const { count: linkedPayments } = await supabaseServer
    .from("finance_payments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .eq("linked_expense_id", e.id)
    .eq("status", "completed");
  const paidDirect = e.payment_status === "paid" && !(linkedPayments && linkedPayments > 0);

  const accts = await loadAccountsByCode(ctx.tenantId);
  const cat = Array.isArray(e.category) ? e.category[0] : e.category;
  const name = cat?.name ?? "";
  const debitCode = EXPENSE_CATEGORY_HINTS.find(([re]) => re.test(name))?.[1] ?? "5000";
  const debitAccount = requireAccount(accts, debitCode);
  const creditAccount = requireAccount(accts, paidDirect ? "1010" : "2000");
  const amt = r2(e.amount);
  const party = { party_id: e.linked_supplier_id, party_type: (e.linked_supplier_id ? "supplier" : null) as "supplier" | null };

  return {
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "expense", sourceId: e.id, entryDate: e.expense_date,
    description: `Expense — ${e.title}`,
    metadata: { expense_id: e.id, payment_status: e.payment_status, category: name || null },
    lines: [
      { account_id: debitAccount.id, debit: amt, credit: 0, currency: e.currency, description: e.title, ...party },
      { account_id: creditAccount.id, debit: 0, credit: amt, currency: e.currency, description: paidDirect ? "Cash disbursed" : "Recognise payable", ...party },
    ],
  };
}

async function buildCashMovement(ctx: PostingContext, movementId: string): Promise<DraftArgs | PostingError | { redirectPaymentId: string }> {
  const { data } = await supabaseServer
    .from("finance_cash_movements")
    .select("id, direction, amount, currency, movement_date, bank_reference, counterparty_name, related_payment_id, bank_account_id")
    .eq("id", movementId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Cash movement not found", code: 404 };
  const m = data as { id: string; direction: string; amount: number; currency: string; movement_date: string; bank_reference: string | null; counterparty_name: string | null; related_payment_id: string | null; bank_account_id: string | null };
  if (m.related_payment_id) return { redirectPaymentId: m.related_payment_id };

  const accts = await loadAccountsByCode(ctx.tenantId);
  const bank = await resolveBankGl(ctx.tenantId, accts, m.bank_account_id, m.currency);
  const clearing = requireAccount(accts, "1090");
  const amt = r2(m.amount);
  const inflow = m.direction === "inflow";
  const ref = m.bank_reference;
  return {
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "cash_movement", sourceId: m.id, entryDate: m.movement_date,
    description: `Bank movement — ${m.counterparty_name ?? "unattributed"}${ref ? ` (ref ${ref})` : ""}`,
    metadata: { movement_id: m.id, direction: m.direction, clearing: true, bank_account_id: m.bank_account_id, bank_gl: bank.code },
    lines: inflow
      ? [
          { account_id: bank.id,     debit: amt, credit: 0,   currency: m.currency, description: "Unclassified inflow", reference: ref },
          { account_id: clearing.id, debit: 0,   credit: amt, currency: m.currency, description: "Awaiting classification", reference: ref },
        ]
      : [
          { account_id: clearing.id, debit: amt, credit: 0,   currency: m.currency, description: "Awaiting classification", reference: ref },
          { account_id: bank.id,     debit: 0,   credit: amt, currency: m.currency, description: "Unclassified outflow", reference: ref },
        ],
  };
}

async function buildInventoryCogs(ctx: PostingContext, shipmentId: string): Promise<DraftArgs | PostingError> {
  const { data: shipRow } = await supabaseServer
    .from("sales_shipments")
    .select("id, sales_order_id, shipment_no, status, customer_id, shipped_at, created_at")
    .eq("id", shipmentId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!shipRow) return { ok: false, error: "Shipment not found", code: 404 };
  const ship = shipRow as { id: string; sales_order_id: string; shipment_no: string; status: string; customer_id: string | null; shipped_at: string | null; created_at: string };
  if (ship.status !== "shipped") return { ok: false, error: `Cannot draft COGS for shipment with status '${ship.status}'`, code: 409 };

  const { data: shipLines } = await supabaseServer
    .from("sales_shipment_items")
    .select("inventory_movement_id")
    .eq("shipment_id", shipmentId)
    .eq("tenant_id", ctx.tenantId);
  const movementIds = ((shipLines ?? []) as Array<{ inventory_movement_id: string | null }>).map((l) => l.inventory_movement_id).filter((x): x is string => !!x);
  if (movementIds.length === 0) return { ok: false, error: "Shipment has no inventory movements — nothing to recognise as COGS", code: 422 };

  const { data: movements } = await supabaseServer
    .from("inventory_stock_movements")
    .select("total_cost, currency")
    .in("id", movementIds)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "posted");
  const rows = (movements ?? []) as Array<{ total_cost: number | null; currency: string }>;
  const totalCost = r2(rows.reduce((acc, m) => acc + (Number(m.total_cost) || 0), 0));
  if (totalCost <= 0) return { ok: false, error: "Shipment total_cost is zero — no COGS to recognise", code: 422 };
  const currency = rows[0]?.currency ?? (await resolveBaseCurrency(ctx.tenantId));

  const accts = await loadAccountsByCode(ctx.tenantId);
  return {
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "inventory_cogs", sourceId: ship.id,
    entryDate: (ship.shipped_at ?? ship.created_at).slice(0, 10),
    description: `COGS · ${ship.shipment_no}`,
    metadata: { shipment_no: ship.shipment_no, sales_order_id: ship.sales_order_id, customer_id: ship.customer_id },
    lines: [
      { account_id: requireAccount(accts, "5400").id, debit: totalCost, credit: 0, currency, description: "Cost of Goods Sold", reference: ship.shipment_no },
      { account_id: requireAccount(accts, "1400").id, debit: 0, credit: totalCost, currency, description: "Inventory Asset", reference: ship.shipment_no },
    ],
  };
}

const REVENUE_ELIGIBLE_STATUSES = new Set(["issued", "sent", "partial", "paid", "overdue"]);

async function buildRevenue(ctx: PostingContext, invoiceId: string): Promise<DraftArgs | PostingError> {
  const { data } = await supabaseServer
    .from("invoices")
    .select("id, inv_no, status, customer_id, currency, total, tax_total, issue_date, cancelled_at")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Invoice not found", code: 404 };
  const inv = data as { id: string; inv_no: string | null; status: string; customer_id: string | null; currency: string; total: number; tax_total: number | null; issue_date: string; cancelled_at: string | null };
  if (inv.cancelled_at) return { ok: false, error: "Invoice is cancelled", code: 409 };
  if (!REVENUE_ELIGIBLE_STATUSES.has(inv.status)) return { ok: false, error: `Cannot draft revenue for invoice in status '${inv.status}'`, code: 409 };

  const total = r2(inv.total);
  const tax = Math.min(r2(inv.tax_total ?? 0), total);
  if (total <= 0) return { ok: false, error: "Invoice total is zero — no revenue to recognise", code: 422 };
  const currency = inv.currency || (await resolveBaseCurrency(ctx.tenantId));
  const accts = await loadAccountsByCode(ctx.tenantId);
  const ref = inv.inv_no;
  const lines: DraftLine[] = [
    { account_id: requireAccount(accts, "1100").id, debit: total, credit: 0, currency, description: "Accounts Receivable", reference: ref, party_id: inv.customer_id, party_type: "customer" },
    { account_id: requireAccount(accts, "4000").id, debit: 0, credit: r2(total - tax), currency, description: "Sales Revenue", reference: ref },
  ];
  if (tax > 0) lines.push({ account_id: requireAccount(accts, "2200").id, debit: 0, credit: tax, currency, description: "Output tax", reference: ref });
  return {
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "sales_revenue", sourceId: inv.id, entryDate: inv.issue_date,
    description: `Revenue · ${inv.inv_no ?? inv.id.slice(0, 8)}`,
    metadata: { invoice_no: inv.inv_no, customer_id: inv.customer_id, tax_total: tax },
    lines,
  };
}

async function buildVendorBill(ctx: PostingContext, billId: string): Promise<DraftArgs | PostingError> {
  const { data } = await supabaseServer
    .from("vendor_bills")
    .select("id, bill_no, supplier_invoice_no, supplier_id, receipt_id, status, bill_date, currency, subtotal, tax_total, shipping_cost, other_charges, total, approval_status")
    .eq("id", billId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Vendor bill not found", code: 404 };
  const b = data as { id: string; bill_no: string | null; supplier_invoice_no: string | null; supplier_id: string | null; receipt_id: string | null; status: string; bill_date: string; currency: string; subtotal: number | null; tax_total: number | null; shipping_cost: number | null; other_charges: number | null; total: number; approval_status: string | null };
  if (["draft", "cancelled", "void", "voided"].includes(b.status)) return { ok: false, error: `Cannot post a ${b.status} bill`, code: 409 };
  if (b.approval_status && !APPROVED.has(b.approval_status)) return notApproved("Vendor bill", b.approval_status);

  const total = r2(b.total);
  const tax = Math.min(r2(b.tax_total ?? 0), total);
  const goods = r2(total - tax);
  if (total <= 0) return { ok: false, error: "Bill total is zero", code: 422 };
  const accts = await loadAccountsByCode(ctx.tenantId);
  const ref = b.supplier_invoice_no ?? b.bill_no;
  /* A bill that invoices a received PO clears GRNI (the receipt already put
     the goods in inventory); a bill without a receipt is an expense. */
  const debitAccount = requireAccount(accts, b.receipt_id ? "2010" : "5000");
  const lines: DraftLine[] = [
    { account_id: debitAccount.id, debit: goods, credit: 0, currency: b.currency, description: b.receipt_id ? "Clear goods received not invoiced" : "Purchase expense", reference: ref, party_id: b.supplier_id, party_type: "supplier" },
  ];
  if (tax > 0) lines.push({ account_id: requireAccount(accts, "2200").id, debit: tax, credit: 0, currency: b.currency, description: "Input tax", reference: ref });
  lines.push({ account_id: requireAccount(accts, "2000").id, debit: 0, credit: total, currency: b.currency, description: "Accounts Payable", reference: ref, party_id: b.supplier_id, party_type: "supplier" });
  return {
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "vendor_bill", sourceId: b.id, entryDate: b.bill_date,
    description: `Vendor bill · ${b.bill_no ?? b.id.slice(0, 8)}`,
    metadata: { bill_no: b.bill_no, supplier_id: b.supplier_id, receipt_id: b.receipt_id, tax_total: tax },
    lines,
  };
}

async function buildInventoryReceipt(ctx: PostingContext, receiptId: string): Promise<DraftArgs | PostingError> {
  const { data } = await supabaseServer
    .from("purchase_receipts")
    .select("id, gr_no, supplier_id, status, received_at, created_at, destination_mode")
    .eq("id", receiptId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Receipt not found", code: 404 };
  const rc = data as { id: string; gr_no: string | null; supplier_id: string | null; status: string; received_at: string | null; created_at: string; destination_mode: string | null };
  if (rc.status !== "posted") return { ok: false, error: `Cannot draft a ${rc.status} receipt`, code: 409 };

  const { data: items } = await supabaseServer.from("purchase_receipt_items").select("id").eq("receipt_id", rc.id).eq("tenant_id", ctx.tenantId);
  const lineIds = ((items ?? []) as Array<{ id: string }>).map((i) => i.id);
  if (lineIds.length === 0) return { ok: false, error: "Receipt has no lines", code: 422 };
  const { data: movements } = await supabaseServer
    .from("inventory_stock_movements")
    .select("total_cost, currency")
    .eq("tenant_id", ctx.tenantId)
    .eq("source_type", "purchase_receipt")
    .in("source_id", lineIds)
    .eq("status", "posted")
    .eq("direction", "in");
  const rows = (movements ?? []) as Array<{ total_cost: number | null; currency: string }>;
  const total = r2(rows.reduce((s, m) => s + (Number(m.total_cost) || 0), 0));
  if (total <= 0) return { ok: false, error: "Receipt moved no costed stock — nothing to capitalise", code: 422 };
  const currency = rows[0]?.currency ?? (await resolveBaseCurrency(ctx.tenantId));

  const accts = await loadAccountsByCode(ctx.tenantId);
  return {
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "inventory_receipt", sourceId: rc.id,
    entryDate: (rc.received_at ?? rc.created_at).slice(0, 10),
    description: `Goods received · ${rc.gr_no ?? rc.id.slice(0, 8)}`,
    metadata: { gr_no: rc.gr_no, supplier_id: rc.supplier_id, destination_mode: rc.destination_mode },
    lines: [
      { account_id: requireAccount(accts, "1400").id, debit: total, credit: 0, currency, description: "Inventory received", reference: rc.gr_no },
      { account_id: requireAccount(accts, "2010").id, debit: 0, credit: total, currency, description: "Goods received not invoiced", reference: rc.gr_no, party_id: rc.supplier_id, party_type: "supplier" },
    ],
  };
}

async function buildPayroll(ctx: PostingContext, runId: string): Promise<DraftArgs | PostingError> {
  const { data } = await supabaseServer
    .from("hr_payroll_runs")
    .select("id, period, country, status, currency, total_gross, total_net, total_employer, approved_at")
    .eq("id", runId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Payroll run not found", code: 404 };
  const run = data as { id: string; period: string; country: string | null; status: string; currency: string | null; total_gross: number | null; total_net: number | null; total_employer: number | null };
  if (run.status === "draft") return notApproved("Payroll run", "draft");

  /* Per currency, from the run's own slips (lib/hr/payroll-totals): a run
     that pays EGP and USD is two balanced groups of lines, each valued at
     its own rate — never one sum in the first slip's currency. A run from
     before its slips carried a currency falls back to its row. */
  const { data: slipRows, error: slipErr } = await supabaseServer
    .from("hr_payslips")
    .select("currency, gross_amount, net_amount, employer_contributions")
    .eq("payroll_run_id", run.id);
  if (slipErr) return { ok: false, error: `Payroll slips: ${slipErr.message}`, code: 500 };
  const slips = (slipRows ?? []) as Array<{ currency: string | null; gross_amount: number | null; net_amount: number | null; employer_contributions: Record<string, unknown> | null }>;
  const groups: CurrencyTotal[] = slips.length
    ? totalsByCurrency(slips.map((s) => ({ currency: s.currency, gross: s.gross_amount, net: s.net_amount, employer: employerTotal(s.employer_contributions) })))
    : [{ currency: run.currency || (await resolveBaseCurrency(ctx.tenantId)), employees: 0, gross: r2(run.total_gross ?? 0), net: r2(run.total_net ?? 0), employer: r2(run.total_employer ?? 0) }];
  if (!groups.some((g) => g.gross > 0)) return { ok: false, error: "Payroll run has no gross pay", code: 422 };
  /* Dated the last day of the month it pays for. */
  const [y, m] = run.period.split("-").map(Number);
  const entryDate = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const accts = await loadAccountsByCode(ctx.tenantId);
  const lines: DraftLine[] = payrollLines(groups, {
    salaries: requireAccount(accts, "5500").id, employer: requireAccount(accts, "5510").id,
    netOwed: requireAccount(accts, "2300").id, deductionsOwed: requireAccount(accts, "2310").id,
  }, run.period);
  return {
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "payroll", sourceId: run.id, entryDate,
    description: `Payroll · ${run.period}${run.country ? ` · ${run.country}` : ""}`,
    metadata: { period: run.period, country: run.country, by_currency: groups.map(({ currency, gross, net, employer }) => ({ currency, gross, net, employer })) },
    lines,
  };
}

async function buildFxExchange(ctx: PostingContext, exchangeId: string): Promise<DraftArgs | PostingError> {
  const { data } = await supabaseServer
    .from("finance_fx_exchanges")
    .select("id, exchange_no, exchange_date, from_currency, to_currency, from_amount, to_amount, status, from_bank_id, to_bank_id")
    .eq("id", exchangeId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data) return { ok: false, error: "FX exchange not found", code: 404 };
  const x = data as { id: string; exchange_no: string | null; exchange_date: string; from_currency: string; to_currency: string; from_amount: number; to_amount: number; status: string; from_bank_id: string | null; to_bank_id: string | null };
  if (x.status === "voided" || x.status === "cancelled") return { ok: false, error: `Exchange is ${x.status}`, code: 409 };
  const fromAmt = r2(x.from_amount);
  const toAmt = r2(x.to_amount);
  if (fromAmt <= 0 || toAmt <= 0) return { ok: false, error: "Exchange amounts must be positive", code: 422 };

  /* Both legs are valued at the tenant's rate on the day; the difference to
     what the bank actually gave is the realised FX result. */
  const base = await resolveBaseCurrency(ctx.tenantId);
  const rateOf = async (ccy: string) => (ccy.toUpperCase() === base ? 1 : (await resolveRate({ tenantId: ctx.tenantId, from: ccy, to: base, date: x.exchange_date })).rate);
  let fromRate: number, toRate: number;
  try { fromRate = await rateOf(x.from_currency); toRate = await rateOf(x.to_currency); }
  catch (e) { return { ok: false, code: 422, error: e instanceof Error ? e.message : "Missing FX rate" }; }
  const diff = r2(toAmt * toRate - fromAmt * fromRate); // + gain, − loss in base

  const accts = await loadAccountsByCode(ctx.tenantId);
  const toBank = await resolveBankGl(ctx.tenantId, accts, x.to_bank_id, x.to_currency);
  const fromBank = await resolveBankGl(ctx.tenantId, accts, x.from_bank_id, x.from_currency);
  const ref = x.exchange_no;
  const lines: DraftLine[] = [
    { account_id: toBank.id, debit: toAmt, credit: 0, currency: x.to_currency, exchange_rate: toRate, description: `Bought ${x.to_currency}`, reference: ref },
    { account_id: fromBank.id, debit: 0, credit: fromAmt, currency: x.from_currency, exchange_rate: fromRate, description: `Sold ${x.from_currency}`, reference: ref },
  ];
  if (diff > 0) lines.push({ account_id: requireAccount(accts, "4900").id, debit: 0, credit: diff, currency: base, exchange_rate: 1, description: "Realised FX gain", reference: ref });
  if (diff < 0) lines.push({ account_id: requireAccount(accts, "5900").id, debit: -diff, credit: 0, currency: base, exchange_rate: 1, description: "Realised FX loss", reference: ref });
  return {
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "fx_exchange", sourceId: x.id, entryDate: x.exchange_date,
    description: `FX exchange · ${x.from_currency}→${x.to_currency}${ref ? ` · ${ref}` : ""}`,
    metadata: { exchange_no: ref, from_rate: fromRate, to_rate: toRate, fx_result_base: diff },
    lines,
  };
}

async function buildFor(ctx: PostingContext, kind: SourceKind, sourceId: string): Promise<DraftArgs | PostingError> {
  switch (kind) {
    case "payment":           return buildPayment(ctx, sourceId);
    case "expense":           return buildExpense(ctx, sourceId);
    case "cash_movement": {
      const r = await buildCashMovement(ctx, sourceId);
      if ("redirectPaymentId" in r) return { ok: false, code: 409, error: "This movement is reconciled to a payment — post the payment instead", details: { payment_id: r.redirectPaymentId } };
      return r;
    }
    case "inventory_cogs":    return buildInventoryCogs(ctx, sourceId);
    case "sales_revenue":     return buildRevenue(ctx, sourceId);
    case "vendor_bill":       return buildVendorBill(ctx, sourceId);
    case "inventory_receipt": return buildInventoryReceipt(ctx, sourceId);
    case "payroll":           return buildPayroll(ctx, sourceId);
    case "fx_exchange":       return buildFxExchange(ctx, sourceId);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════════ */

/** Draft the entry for a source document (idempotent). */
export async function draftSource(ctx: PostingContext, kind: SourceKind, sourceId: string): Promise<PostingOutcome> {
  const existing = await findActiveEntryFor(ctx.tenantId, kind, sourceId);
  if (existing) return { ok: true, entry_id: existing.id, journal_no: existing.journal_no, status: existing.status };
  const args = await buildFor(ctx, kind, sourceId);
  if ("ok" in args) return args;
  return createDraft(args);
}

/** Draft if needed, then post (idempotent: an existing draft is posted,
 *  an existing posted entry is returned). */
export async function postSource(ctx: PostingContext, kind: SourceKind, sourceId: string): Promise<PostingOutcome> {
  const existing = await findActiveEntryFor(ctx.tenantId, kind, sourceId);
  if (existing) {
    if (existing.status === "posted") return { ok: true, entry_id: existing.id, journal_no: existing.journal_no, status: "posted" };
    return postExistingDraft(ctx.tenantId, ctx.postedByAccountId, existing.id);
  }
  const args = await buildFor(ctx, kind, sourceId);
  if ("ok" in args) return args;
  return createAndPost(args);
}

/** Post a drafted entry the accountant approved in the queue. */
export async function postDraftedEntry(ctx: PostingContext, entryId: string): Promise<PostingOutcome> {
  return postExistingDraft(ctx.tenantId, ctx.postedByAccountId, entryId);
}

/** Recover a failed or stuck source: post its draft if one exists,
 *  otherwise rebuild it from the current source row and post. */
export async function retryRecognition(ctx: PostingContext, kind: SourceKind, sourceId: string): Promise<PostingOutcome> {
  return postSource(ctx, kind, sourceId);
}

/** Void the ACTIVE entry of a source document (posted → reversal; draft →
 *  deleted). The source row mirrors 'voided' (or 'pending' for a deleted
 *  draft) so it can be drafted again after the document is corrected. */
export async function voidSourceEntry(ctx: PostingContext, kind: SourceKind, sourceId: string, reason: string): Promise<PostingOutcome | { ok: true; entry_id: null; journal_no: ""; status: "none" }> {
  const existing = await findActiveEntryFor(ctx.tenantId, kind, sourceId);
  if (!existing) return { ok: true, entry_id: null, journal_no: "", status: "none" };
  if (existing.status === "draft") {
    await supabaseServer.from("accounting_journal_entries").delete().eq("id", existing.id).eq("tenant_id", ctx.tenantId);
    await setSourceAccountingStatus(ctx.tenantId, kind, sourceId, { accounting_status: "pending", accounting_entry_id: null, accounting_last_error: null });
    return { ok: true, entry_id: null, journal_no: "", status: "none" };
  }
  return voidJournalEntry(ctx, existing.id, reason);
}

/** Reverse a posted entry (the DB writes the mirror-image lines). */
export async function voidJournalEntry(ctx: PostingContext, entryId: string, reason: string): Promise<PostingOutcome> {
  const { data: entryData } = await supabaseServer
    .from("accounting_journal_entries")
    .select("source_type, source_id")
    .eq("id", entryId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  const { data, error } = await supabaseServer.rpc("fn_accounting_void_entry", {
    p_entry_id: entryId, p_tenant_id: ctx.tenantId, p_voided_by: ctx.postedByAccountId, p_reason: reason,
  });
  if (error) return { ok: false, error: error.message, code: 500 };
  const r = (data ?? {}) as { ok?: boolean; error?: string; code?: number; reversing_entry_id?: string; reversing_journal_no?: string };
  if (!r.ok) return { ok: false, error: r.error ?? "Void failed", code: r.code };
  if (entryData) {
    const src = entryData as { source_type: JournalSourceType; source_id: string | null };
    await setSourceAccountingStatus(ctx.tenantId, src.source_type, src.source_id, { accounting_status: "voided", accounting_last_error: null });
  }
  return { ok: true, entry_id: r.reversing_entry_id!, journal_no: r.reversing_journal_no ?? "", status: "posted" };
}

/* ─── Named entry points kept for the routes, hooks and validators ─── */

export const draftPayment            = (ctx: PostingContext, id: string) => draftSource(ctx, "payment", id);
export const draftExpense            = (ctx: PostingContext, id: string) => draftSource(ctx, "expense", id);
export const draftCashMovement       = (ctx: PostingContext, id: string) => draftSource(ctx, "cash_movement", id);
export const draftInventoryCogs      = (ctx: PostingContext, id: string) => draftSource(ctx, "inventory_cogs", id);
export const draftRevenueRecognition = (ctx: PostingContext, id: string) => draftSource(ctx, "sales_revenue", id);
export const draftVendorBill         = (ctx: PostingContext, id: string) => draftSource(ctx, "vendor_bill", id);
export const draftInventoryReceipt   = (ctx: PostingContext, id: string) => draftSource(ctx, "inventory_receipt", id);
export const draftPayrollRun         = (ctx: PostingContext, id: string) => draftSource(ctx, "payroll", id);
export const draftFxExchange         = (ctx: PostingContext, id: string) => draftSource(ctx, "fx_exchange", id);

export const postPayment             = (ctx: PostingContext, id: string) => postSource(ctx, "payment", id);
export const postCustomerCollection  = postPayment;
export const postSupplierPayment     = postPayment;
export const postExpense             = (ctx: PostingContext, id: string) => postSource(ctx, "expense", id);
export const postBankMovement        = (ctx: PostingContext, id: string) => postSource(ctx, "cash_movement", id);
export const postInventoryCogs       = (ctx: PostingContext, id: string) => postSource(ctx, "inventory_cogs", id);
export const postRevenueRecognition  = (ctx: PostingContext, id: string) => postSource(ctx, "sales_revenue", id);
export const postVendorBill          = (ctx: PostingContext, id: string) => postSource(ctx, "vendor_bill", id);
export const postInventoryReceipt    = (ctx: PostingContext, id: string) => postSource(ctx, "inventory_receipt", id);
export const postPayrollRun          = (ctx: PostingContext, id: string) => postSource(ctx, "payroll", id);
export const postFxExchange          = (ctx: PostingContext, id: string) => postSource(ctx, "fx_exchange", id);

/* ─── Opening balances ─────────────────────────────────────────── */

export interface OpeningBalanceArgs {
  accountCode: string;
  amount: number;
  currency?: string;
  entryDate?: string;
  description?: string;
  /** The finance_opening_balances row id — makes the posting idempotent and
   *  mirrors accounting_status onto that row. */
  openingId?: string;
  partyId?: string | null;
  partyType?: "customer" | "supplier" | null;
}

export async function postOpeningBalance(ctx: PostingContext, args: OpeningBalanceArgs): Promise<PostingOutcome> {
  const accts = await loadAccountsByCode(ctx.tenantId);
  const target = accts.get(args.accountCode);
  if (!target) return { ok: false, error: `Account code ${args.accountCode} not found`, code: 404 };
  const owner = requireAccount(accts, "3000");
  const amt = r2(args.amount);
  if (amt === 0) return { ok: false, error: "Opening balance amount must be non-zero", code: 400 };

  const sourceId = args.openingId ?? null;
  if (sourceId) {
    const existing = await findActiveEntryFor(ctx.tenantId, "opening_balance", sourceId);
    if (existing) {
      if (existing.status === "posted") return { ok: true, entry_id: existing.id, journal_no: existing.journal_no, status: "posted" };
      return postExistingDraft(ctx.tenantId, ctx.postedByAccountId, existing.id);
    }
  }
  const entryDate = args.entryDate ?? new Date().toISOString().slice(0, 10);
  const currency = args.currency ?? (await resolveBaseCurrency(ctx.tenantId));
  const description = args.description ?? `Opening balance — ${target.code} ${target.name}`;
  const debitOnTarget = target.normal_balance === "debit" ? amt > 0 : amt < 0;
  const abs = Math.abs(amt);
  const party = { party_id: args.partyId ?? null, party_type: args.partyType ?? null };

  return createAndPost({
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "opening_balance", sourceId, entryDate, description,
    metadata: { account_code: target.code, opening_id: sourceId },
    lines: debitOnTarget
      ? [
          { account_id: target.id, debit: abs, credit: 0,   currency, description, ...party },
          { account_id: owner.id,  debit: 0,   credit: abs, currency, description: "Opening — Owner Capital" },
        ]
      : [
          { account_id: owner.id,  debit: abs, credit: 0,   currency, description: "Opening — Owner Capital" },
          { account_id: target.id, debit: 0,   credit: abs, currency, description, ...party },
        ],
  });
}

/* ─── Manual journals ──────────────────────────────────────────── */

export interface ManualLine {
  account_id: string;
  debit?: number;
  credit?: number;
  currency?: string;
  description?: string | null;
  party_id?: string | null;
  party_type?: "customer" | "supplier" | null;
  reference?: string | null;
}

/** An adjusting entry typed by the accountant. Accounts must belong to the
 *  tenant and be active; each line carries one side; the date must be in an
 *  open period. Posted in one step — the person writing it is the approver. */
export async function postManualJournal(
  ctx: PostingContext,
  input: { entry_date?: string; description?: string; lines: ManualLine[]; metadata?: Record<string, unknown>; post?: boolean },
): Promise<PostingOutcome> {
  if (!Array.isArray(input.lines) || input.lines.length < 2) return { ok: false, error: "At least two lines are required", code: 400 };
  const entryDate = input.entry_date && /^\d{4}-\d{2}-\d{2}$/.test(input.entry_date) ? input.entry_date : new Date().toISOString().slice(0, 10);
  const ids = Array.from(new Set(input.lines.map((l) => l.account_id).filter(Boolean)));
  const { data: accts } = await supabaseServer
    .from("accounting_accounts")
    .select("id, is_active")
    .eq("tenant_id", ctx.tenantId)
    .in("id", ids);
  const known = new Map(((accts ?? []) as Array<{ id: string; is_active: boolean }>).map((a) => [a.id, a.is_active]));
  for (const id of ids) {
    if (!known.has(id)) return { ok: false, error: "A line names an account that is not in this company's chart of accounts", code: 422 };
    if (!known.get(id)) return { ok: false, error: "A line names an inactive account", code: 422 };
  }
  const base = await resolveBaseCurrency(ctx.tenantId);
  const args: DraftArgs = {
    tenantId: ctx.tenantId, postedBy: ctx.postedByAccountId,
    sourceType: "manual", sourceId: null, entryDate,
    description: input.description?.trim() || "Manual journal",
    metadata: input.metadata ?? {},
    lines: input.lines.map((l) => ({
      account_id: l.account_id,
      debit: r2(l.debit ?? 0),
      credit: r2(l.credit ?? 0),
      currency: (l.currency ?? base).toUpperCase(),
      description: l.description ?? null,
      party_id: l.party_id ?? null,
      party_type: l.party_type ?? null,
      reference: l.reference ?? null,
    })),
  };
  return input.post === false ? createDraft(args) : createAndPost(args);
}
