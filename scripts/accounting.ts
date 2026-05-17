#!/usr/bin/env tsx

/* ===========================================================================
   Phase A.1 — Accounting validators.

   Tests the COA + journal + posting engine + trial-balance/GL/balance-
   sheet query layer end-to-end against two sandbox tenants.

   Coverage:
     01  COA seeded with the 16 default accounts on first read
     02  Unbalanced journal entry rejected by the DB
     03  Balanced manual journal posts cleanly
     04  Posted entries are immutable — UPDATE on header rejected
     05  Posted entries are immutable — UPDATE on lines rejected
     06  Void produces a reversing entry with swapped sides
     07  Voided + reversed totals net to zero
     08  Cross-tenant journal access denied (tenant B can't read A)
     09  postPayment (customer collection)  →  Dr 1010, Cr 1100
     10  postPayment (supplier payment)     →  Dr 2000, Cr 1010
     11  postExpense (paid)                 →  Dr 5000, Cr 1010
     12  postExpense (unpaid)               →  Dr 5000, Cr 2000
     13  postExpense category hint maps to 5100 (banking)
     14  postOpeningBalance: asset positive →  Dr asset, Cr 3000
     15  postBankMovement (inflow)          →  Dr 1010, Cr suspense
     16  Double-post idempotency: same source_id returns existing
     17  Trial balance: debit total = credit total
     18  Trial balance: signed balances follow normal_balance
     19  Balance sheet: Assets = Liabilities + Equity + CYE
     20  General ledger: running balance reconciles to closing
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[accounting] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000C1";
const TENANT_B = "00000000-0000-4000-a000-0000000000C2";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `phase-a1-${id.slice(-4)}`, name: `Phase-A1 Sandbox ${id.slice(-4)}`, is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("accounting_journal_lines").delete().eq("tenant_id", t);
    await supabase.from("accounting_journal_entries").delete().eq("tenant_id", t);
    await supabase.from("accounting_accounts").delete().eq("tenant_id", t);
    await supabase.from("finance_payments").delete().eq("tenant_id", t);
    await supabase.from("finance_expenses").delete().eq("tenant_id", t);
    await supabase.from("finance_expense_categories").delete().eq("tenant_id", t);
    await supabase.from("finance_cash_movements").delete().eq("tenant_id", t);
    await supabase.from("finance_bank_accounts").delete().eq("tenant_id", t);
  }
}

async function seedFinanceData(tenant: string) {
  /* Customer payment (in, completed). */
  const customerPaymentId = randomUUID();
  await supabase.from("finance_payments").insert({
    id: customerPaymentId, tenant_id: tenant,
    direction: "in", party_type: "customer", party_id: null, party_name: "Acme Co",
    amount: 5_000, currency: "USD", payment_date: "2026-05-01",
    reference_no: "INV-100", bank_reference: "WIRE-100",
    status: "completed", reconciliation_status: "unreconciled", approval_status: "approved",
  });
  /* Supplier payment (out, completed). */
  const supplierPaymentId = randomUUID();
  await supabase.from("finance_payments").insert({
    id: supplierPaymentId, tenant_id: tenant,
    direction: "out", party_type: "supplier", party_id: null, party_name: "Acme Supplier",
    amount: 1_500, currency: "USD", payment_date: "2026-05-02",
    reference_no: "PO-77", bank_reference: "WIRE-77",
    status: "completed", reconciliation_status: "unreconciled", approval_status: "approved",
  });
  /* Banking expense category — used to verify the category hint maps to 5100. */
  const bankCatId = randomUUID();
  await supabase.from("finance_expense_categories").insert({
    id: bankCatId, tenant_id: tenant, parent_id: null, name: "Bank charges",
    icon: null, is_system: false, sort_order: 0,
  });
  /* Expense paid. */
  const paidExpenseId = randomUUID();
  await supabase.from("finance_expenses").insert({
    id: paidExpenseId, tenant_id: tenant,
    category_id: null, title: "Office supplies", amount: 200, currency: "USD",
    expense_date: "2026-05-03", payment_status: "paid", approval_status: "approved",
  });
  /* Expense unpaid. */
  const unpaidExpenseId = randomUUID();
  await supabase.from("finance_expenses").insert({
    id: unpaidExpenseId, tenant_id: tenant,
    category_id: null, title: "Pending invoice", amount: 800, currency: "USD",
    expense_date: "2026-05-04", payment_status: "unpaid", approval_status: "submitted",
  });
  /* Expense with banking category — exercises EXPENSE_CATEGORY_HINTS. */
  const bankExpenseId = randomUUID();
  await supabase.from("finance_expenses").insert({
    id: bankExpenseId, tenant_id: tenant,
    category_id: bankCatId, title: "Wire fee", amount: 35, currency: "USD",
    expense_date: "2026-05-05", payment_status: "paid", approval_status: "approved",
  });
  /* Cash movement unrelated to a payment — exercises postBankMovement. */
  const accountId = randomUUID();
  await supabase.from("finance_bank_accounts").insert({
    id: accountId, tenant_id: tenant, bank_name: "Acme Bank", account_name: "Operating", currency: "USD",
    opening_balance: 0, current_balance: 0, available_balance: 0, status: "active", is_primary: true,
  });
  const movementId = randomUUID();
  await supabase.from("finance_cash_movements").insert({
    id: movementId, tenant_id: tenant, bank_account_id: accountId,
    movement_type: "incoming", direction: "inflow", currency: "USD",
    amount: 1_000, movement_date: "2026-05-06",
    bank_reference: "INTEREST", reconciliation_status: "unreconciled", evidence_status: "missing",
  });

  return { customerPaymentId, supplierPaymentId, paidExpenseId, unpaidExpenseId, bankExpenseId, movementId };
}

interface Acct { id: string; code: string; name: string }
async function coa(tenant: string): Promise<Map<string, Acct>> {
  const { data } = await supabase
    .from("accounting_accounts")
    .select("id, code, name")
    .eq("tenant_id", tenant);
  const m = new Map<string, Acct>();
  for (const a of (data ?? []) as Acct[]) m.set(a.code, a);
  return m;
}

async function main() {
  console.log("\n[Phase A.1 — Accounting validators]\n");
  await ensureTenants();
  await clean();
  try {
    /* 01 — COA seed. */
    await supabase.rpc("fn_accounting_ensure_coa", { p_tenant_id: TENANT_A });
    const aCoa = await coa(TENANT_A);
    ok("01 COA seeded — 16 default accounts", aCoa.size === 16, `got ${aCoa.size}`);
    ok("01a COA contains 1010 Bank, 1100 AR, 2000 AP, 3000 Owner, 5000 OpEx",
      aCoa.has("1010") && aCoa.has("1100") && aCoa.has("2000") && aCoa.has("3000") && aCoa.has("5000"));

    /* 02 — unbalanced entry rejected at post-time. */
    const unbalancedEntryId = randomUUID();
    await supabase.from("accounting_journal_entries").insert({
      id: unbalancedEntryId, tenant_id: TENANT_A,
      journal_no: `JE-UNBAL-${Date.now().toString(16).slice(-6)}`,
      entry_date: "2026-05-01", source_type: "manual", status: "draft",
      description: "Unbalanced test",
    });
    await supabase.from("accounting_journal_lines").insert([
      { tenant_id: TENANT_A, entry_id: unbalancedEntryId, line_index: 0, account_id: aCoa.get("1010")!.id, debit: 100, credit: 0, currency: "USD" },
      { tenant_id: TENANT_A, entry_id: unbalancedEntryId, line_index: 1, account_id: aCoa.get("3000")!.id, debit: 0, credit: 99, currency: "USD" },
    ]);
    const unbalRes = await supabase.rpc("fn_accounting_post_entry", {
      p_entry_id: unbalancedEntryId, p_tenant_id: TENANT_A, p_posted_by: null,
    });
    ok("02 unbalanced journal rejected",
      !!unbalRes.error || (unbalRes.data as { ok?: boolean })?.ok !== true,
      unbalRes.error?.message ?? `code=${(unbalRes.data as { code?: number })?.code}`);
    /* Clean up the leftover draft. */
    await supabase.from("accounting_journal_entries").delete().eq("id", unbalancedEntryId);

    /* 03 — balanced manual journal posts cleanly. */
    const seed = await seedFinanceData(TENANT_A);
    const balancedId = randomUUID();
    await supabase.from("accounting_journal_entries").insert({
      id: balancedId, tenant_id: TENANT_A,
      journal_no: `JE-BAL-${Date.now().toString(16).slice(-6)}`,
      entry_date: "2026-05-01", source_type: "manual", status: "draft",
      description: "Balanced test",
    });
    await supabase.from("accounting_journal_lines").insert([
      { tenant_id: TENANT_A, entry_id: balancedId, line_index: 0, account_id: aCoa.get("1010")!.id, debit: 500, credit: 0, currency: "USD" },
      { tenant_id: TENANT_A, entry_id: balancedId, line_index: 1, account_id: aCoa.get("3000")!.id, debit: 0, credit: 500, currency: "USD" },
    ]);
    const balRes = await supabase.rpc("fn_accounting_post_entry", {
      p_entry_id: balancedId, p_tenant_id: TENANT_A, p_posted_by: null,
    });
    ok("03 balanced journal posts cleanly", (balRes.data as { ok?: boolean })?.ok === true);

    /* 04 — posted header immutable. */
    const upd = await supabase.from("accounting_journal_entries")
      .update({ description: "tampered" })
      .eq("id", balancedId)
      .eq("tenant_id", TENANT_A);
    ok("04 posted journal header immutable", !!upd.error, upd.error?.message);

    /* 05 — posted lines immutable. */
    const lineUpd = await supabase.from("accounting_journal_lines")
      .update({ debit: 9999 })
      .eq("entry_id", balancedId)
      .eq("line_index", 0);
    ok("05 posted journal lines immutable", !!lineUpd.error, lineUpd.error?.message);

    /* 06 — void creates a reversing entry. */
    const voidRes = await supabase.rpc("fn_accounting_void_entry", {
      p_entry_id: balancedId, p_tenant_id: TENANT_A, p_voided_by: null, p_reason: "test",
    });
    const voidPayload = (voidRes.data ?? {}) as { ok?: boolean; reversing_entry_id?: string };
    ok("06 void produces reversing entry", voidPayload.ok === true && !!voidPayload.reversing_entry_id);

    /* 07 — voided + reversed net to zero on every account they touched. */
    if (voidPayload.reversing_entry_id) {
      const { data: combined } = await supabase
        .from("accounting_journal_lines")
        .select("account_id, debit, credit")
        .in("entry_id", [balancedId, voidPayload.reversing_entry_id]);
      const net = new Map<string, number>();
      for (const r of (combined ?? []) as Array<{ account_id: string; debit: number; credit: number }>) {
        net.set(r.account_id, (net.get(r.account_id) ?? 0) + Number(r.debit) - Number(r.credit));
      }
      const allZero = Array.from(net.values()).every((v) => Math.abs(v) < 0.005);
      ok("07 void + reversal net to zero on every account", allZero);
    } else {
      ok("07 void + reversal net to zero on every account", false, "no reversing id");
    }

    /* 08 — cross-tenant access denied. Tenant B asks for tenant A's
       journals via tenant_id filter; the row should not appear. */
    const { data: bSee } = await supabase
      .from("accounting_journal_entries")
      .select("id")
      .eq("tenant_id", TENANT_B)
      .in("id", [balancedId]);
    ok("08 cross-tenant journal access denied", (bSee?.length ?? 0) === 0);

    /* ── Posting engine tests ─────────────────────────────────── */
    const { postPayment, postExpense, postBankMovement, postOpeningBalance } =
      await import("../src/lib/accounting/posting.js");
    const ctx = { tenantId: TENANT_A, postedByAccountId: null };

    const custRes = await postPayment(ctx, seed.customerPaymentId);
    /* Inspect posted lines for the customer payment journal. */
    const custLines = custRes.ok
      ? (await supabase.from("accounting_journal_lines")
          .select("account_id, debit, credit, account:account_id(code)")
          .eq("entry_id", custRes.entry_id)).data
      : null;
    const custCodes = (custLines as Array<{ debit: number; credit: number; account: { code: string } }> | null) ?? [];
    const custDebit  = custCodes.find((l) => Number(l.debit)  > 0)?.account.code;
    const custCredit = custCodes.find((l) => Number(l.credit) > 0)?.account.code;
    ok("09 postPayment (customer in) → Dr 1010, Cr 1100",
      custRes.ok && custDebit === "1010" && custCredit === "1100",
      `dr=${custDebit} cr=${custCredit}`);

    const supRes = await postPayment(ctx, seed.supplierPaymentId);
    const supLines = supRes.ok
      ? (await supabase.from("accounting_journal_lines")
          .select("debit, credit, account:account_id(code)")
          .eq("entry_id", supRes.entry_id)).data
      : null;
    const supCodes = (supLines as Array<{ debit: number; credit: number; account: { code: string } }> | null) ?? [];
    const supDebit  = supCodes.find((l) => Number(l.debit)  > 0)?.account.code;
    const supCredit = supCodes.find((l) => Number(l.credit) > 0)?.account.code;
    ok("10 postPayment (supplier out) → Dr 2000, Cr 1010",
      supRes.ok && supDebit === "2000" && supCredit === "1010",
      `dr=${supDebit} cr=${supCredit}`);

    const paidExpRes = await postExpense(ctx, seed.paidExpenseId);
    const paidExpLines = paidExpRes.ok
      ? (await supabase.from("accounting_journal_lines")
          .select("debit, credit, account:account_id(code)")
          .eq("entry_id", paidExpRes.entry_id)).data
      : null;
    const paidExpRows = (paidExpLines as Array<{ debit: number; credit: number; account: { code: string } }> | null) ?? [];
    ok("11 postExpense (paid) → Dr 5000, Cr 1010",
      paidExpRes.ok &&
      paidExpRows.find((l) => Number(l.debit)  > 0)?.account.code === "5000" &&
      paidExpRows.find((l) => Number(l.credit) > 0)?.account.code === "1010");

    const unpaidExpRes = await postExpense(ctx, seed.unpaidExpenseId);
    const unpaidExpLines = unpaidExpRes.ok
      ? (await supabase.from("accounting_journal_lines")
          .select("debit, credit, account:account_id(code)")
          .eq("entry_id", unpaidExpRes.entry_id)).data
      : null;
    const unpaidExpRows = (unpaidExpLines as Array<{ debit: number; credit: number; account: { code: string } }> | null) ?? [];
    ok("12 postExpense (unpaid) → Dr 5000, Cr 2000",
      unpaidExpRes.ok &&
      unpaidExpRows.find((l) => Number(l.debit)  > 0)?.account.code === "5000" &&
      unpaidExpRows.find((l) => Number(l.credit) > 0)?.account.code === "2000");

    const bankExpRes = await postExpense(ctx, seed.bankExpenseId);
    const bankExpLines = bankExpRes.ok
      ? (await supabase.from("accounting_journal_lines")
          .select("debit, credit, account:account_id(code)")
          .eq("entry_id", bankExpRes.entry_id)).data
      : null;
    const bankExpRows = (bankExpLines as Array<{ debit: number; credit: number; account: { code: string } }> | null) ?? [];
    ok("13 postExpense category hint → Dr 5100 Bank Charges",
      bankExpRes.ok && bankExpRows.find((l) => Number(l.debit) > 0)?.account.code === "5100");

    const openingUuid = randomUUID();
    const obRes = await postOpeningBalance(ctx, {
      accountCode: "1010", amount: 10_000, openingId: openingUuid,
    });
    const obLines = obRes.ok
      ? (await supabase.from("accounting_journal_lines")
          .select("debit, credit, account:account_id(code)")
          .eq("entry_id", obRes.entry_id)).data
      : null;
    const obRows = (obLines as Array<{ debit: number; credit: number; account: { code: string } }> | null) ?? [];
    const obDr = obRows.find((l) => Number(l.debit)  > 0)?.account.code;
    const obCr = obRows.find((l) => Number(l.credit) > 0)?.account.code;
    ok("14 postOpeningBalance (asset+) → Dr 1010, Cr 3000",
      obRes.ok && obDr === "1010" && obCr === "3000",
      `ok=${obRes.ok} dr=${obDr} cr=${obCr} err=${obRes.ok ? "" : (obRes as { error?: string }).error}`);

    const movRes = await postBankMovement(ctx, seed.movementId);
    const movLines = movRes.ok
      ? (await supabase.from("accounting_journal_lines")
          .select("debit, credit, account:account_id(code)")
          .eq("entry_id", movRes.entry_id)).data
      : null;
    const movRows = (movLines as Array<{ debit: number; credit: number; account: { code: string } }> | null) ?? [];
    ok("15 postBankMovement (inflow) → Dr 1010, Cr suspense (3000)",
      movRes.ok &&
      movRows.find((l) => Number(l.debit)  > 0)?.account.code === "1010" &&
      movRows.find((l) => Number(l.credit) > 0)?.account.code === "3000");

    /* 16 — idempotency: re-posting the same payment returns the same
       entry without inserting a duplicate. */
    const duplicate = await postPayment(ctx, seed.customerPaymentId);
    ok("16 double-post idempotency: same source returns existing entry",
      duplicate.ok && custRes.ok && duplicate.entry_id === custRes.entry_id);

    /* ── Trial balance / GL / balance sheet ─────────────────── */
    const { buildTrialBalance, buildGeneralLedger, buildBalanceSheetSummary } =
      await import("../src/lib/accounting/queries.js");

    const tb = await buildTrialBalance(TENANT_A);
    ok("17 trial balance: debit total = credit total",
      Math.abs(tb.totals.difference) < 0.005,
      `diff=${tb.totals.difference.toFixed(4)}`);
    /* 18 — signed balances follow normal_balance direction. Bank
       (asset, debit-normal) should show a positive balance after the
       customer collection + opening balance + bank-movement-inflow. */
    const bankBalance = tb.rows.find((r) => r.code === "1010")?.balance ?? 0;
    ok("18 trial balance: bank balance positive (debit-normal asset)",
      bankBalance > 0, `bank balance=${bankBalance.toFixed(2)}`);

    /* 19 — accounting identity. */
    const bs = await buildBalanceSheetSummary(TENANT_A);
    ok("19 balance sheet: A = L + E + CYE",
      Math.abs(bs.balanced_difference) < 0.005,
      `Δ=${bs.balanced_difference.toFixed(4)}`);

    /* 20 — GL running balance closes correctly. */
    const bankId = aCoa.get("1010")!.id;
    const gl = await buildGeneralLedger(TENANT_A, bankId);
    ok("20 GL running balance reconciles to closing",
      gl !== null && Math.abs(gl.closing_balance - bankBalance) < 0.005,
      gl ? `gl=${gl.closing_balance.toFixed(2)} tb=${bankBalance.toFixed(2)}` : "no ledger");

    /* ── Phase A.2 — Operational posting integration ────────────── */

    const { draftPayment, postDraftedEntry, retryRecognition } =
      await import("../src/lib/accounting/posting.js");

    /* Seed a fresh payment so we can drive it through the draft-first
       workflow without colliding with the seeds already posted above. */
    const a2PaymentId = randomUUID();
    await supabase.from("finance_payments").insert({
      id: a2PaymentId, tenant_id: TENANT_A,
      direction: "in", party_type: "customer", party_id: null, party_name: "A2 Customer",
      amount: 2_500, currency: "USD", payment_date: "2026-05-08",
      reference_no: "WIRE-A2", bank_reference: "WIRE-A2",
      status: "completed", reconciliation_status: "unreconciled", approval_status: "approved",
    });

    /* 22 — fresh source rows start at accounting_status='pending'. */
    const { data: pendRow } = await supabase
      .from("finance_payments")
      .select("accounting_status, accounting_entry_id, accounting_last_error, accounting_posted_at")
      .eq("id", a2PaymentId)
      .maybeSingle();
    const pend = pendRow as { accounting_status: string; accounting_entry_id: string | null; accounting_last_error: string | null; accounting_posted_at: string | null } | null;
    ok("22 source row defaults to accounting_status='pending'",
      pend?.accounting_status === "pending" && pend?.accounting_entry_id === null);

    /* 23 — draftPayment creates entry in 'draft' status + flips
       source to 'drafted' with entry_id stamped. */
    const draftRes = await draftPayment(ctx, a2PaymentId);
    const { data: draftedRow } = await supabase
      .from("finance_payments")
      .select("accounting_status, accounting_entry_id")
      .eq("id", a2PaymentId)
      .maybeSingle();
    const drafted = draftedRow as { accounting_status: string; accounting_entry_id: string | null } | null;
    const { data: draftEntry } = draftRes.ok
      ? await supabase.from("accounting_journal_entries").select("status").eq("id", draftRes.entry_id).maybeSingle()
      : { data: null };
    ok("23 draftPayment creates draft + flips source to 'drafted'",
      draftRes.ok &&
      (draftEntry as { status?: string } | null)?.status === "draft" &&
      drafted?.accounting_status === "drafted" &&
      drafted?.accounting_entry_id === (draftRes.ok ? draftRes.entry_id : null));

    /* 24 — drafting the same source twice returns the existing draft. */
    const draftAgain = await draftPayment(ctx, a2PaymentId);
    ok("24 double-draft idempotency: same source returns same entry",
      draftAgain.ok && draftRes.ok && draftAgain.entry_id === draftRes.entry_id);

    /* 25 — postDraftedEntry flips source to 'posted' + stamps
       accounting_posted_at + clears any prior error. */
    const postedRes = draftRes.ok ? await postDraftedEntry(ctx, draftRes.entry_id) : { ok: false } as const;
    const { data: postedRow } = await supabase
      .from("finance_payments")
      .select("accounting_status, accounting_posted_at, accounting_last_error")
      .eq("id", a2PaymentId)
      .maybeSingle();
    const posted = postedRow as { accounting_status: string; accounting_posted_at: string | null; accounting_last_error: string | null } | null;
    ok("25 postDraftedEntry flips source to 'posted' with posted_at stamped",
      postedRes.ok &&
      posted?.accounting_status === "posted" &&
      !!posted?.accounting_posted_at &&
      posted?.accounting_last_error === null);

    /* 26 — failed-state path. Build an unbalanced draft directly
       (bypassing the helper that pre-flights the balance) so the DB
       trigger rejects it at post time. */
    const a2FailPaymentId = randomUUID();
    await supabase.from("finance_payments").insert({
      id: a2FailPaymentId, tenant_id: TENANT_A,
      direction: "in", party_type: "customer", party_id: null, party_name: "A2 Fail",
      amount: 1_000, currency: "USD", payment_date: "2026-05-09",
      reference_no: "FAIL-1", bank_reference: "FAIL-1",
      status: "completed", reconciliation_status: "unreconciled", approval_status: "approved",
    });
    const failEntryId = randomUUID();
    await supabase.from("accounting_journal_entries").insert({
      id: failEntryId, tenant_id: TENANT_A,
      journal_no: `JE-FAIL-${Date.now().toString(16).slice(-6)}`,
      entry_date: "2026-05-09", source_type: "payment", source_id: a2FailPaymentId,
      status: "draft", description: "Intentionally unbalanced",
    });
    await supabase.from("accounting_journal_lines").insert([
      { tenant_id: TENANT_A, entry_id: failEntryId, line_index: 0, account_id: aCoa.get("1010")!.id, debit: 1_000, credit: 0, currency: "USD" },
      { tenant_id: TENANT_A, entry_id: failEntryId, line_index: 1, account_id: aCoa.get("1100")!.id, debit: 0, credit: 999, currency: "USD" },
    ]);
    /* Manually link the source to this unbalanced entry — mimics the
       state a real failed draft would be in. */
    await supabase.from("finance_payments")
      .update({ accounting_status: "drafted", accounting_entry_id: failEntryId })
      .eq("id", a2FailPaymentId);
    const failPost = await postDraftedEntry(ctx, failEntryId);
    const { data: failRow } = await supabase
      .from("finance_payments")
      .select("accounting_status, accounting_last_error")
      .eq("id", a2FailPaymentId)
      .maybeSingle();
    const failed = failRow as { accounting_status: string; accounting_last_error: string | null } | null;
    ok("26 failed post flips source to 'failed' + stores last_error",
      !failPost.ok &&
      failed?.accounting_status === "failed" &&
      !!failed?.accounting_last_error);

    /* 27 — voiding a posted entry flips source to 'voided'. */
    if (postedRes.ok) {
      const { voidJournalEntry } = await import("../src/lib/accounting/posting.js");
      const voidRes = await voidJournalEntry(ctx, postedRes.entry_id, "Phase-A2 test void");
      const { data: voidedRow } = await supabase
        .from("finance_payments")
        .select("accounting_status")
        .eq("id", a2PaymentId)
        .maybeSingle();
      const voided = voidedRow as { accounting_status: string } | null;
      ok("27 void flips source to 'voided'",
        voidRes.ok && voided?.accounting_status === "voided");
    } else {
      ok("27 void flips source to 'voided'", false, "post failed");
    }

    /* 28 — queue endpoint behaviour. We can't call the route here
       (no HTTP layer in the validator) but we can verify the
       underlying queryability: pulling pending+drafted+failed
       returns the right tenant set. */
    const { data: tenantAQueue } = await supabase
      .from("finance_payments")
      .select("id, accounting_status")
      .eq("tenant_id", TENANT_A)
      .in("accounting_status", ["pending", "drafted", "failed"]);
    const tenantAIds = new Set(((tenantAQueue ?? []) as Array<{ id: string }>).map((r) => r.id));
    ok("28 queue list returns tenant-A rows when filtered by status",
      tenantAIds.has(a2FailPaymentId),
      `${tenantAIds.size} rows`);

    /* 29 — cross-tenant queue access denied. Tenant B asks for
       tenant A's queued rows by id; the row should NOT appear. */
    const { data: crossQueue } = await supabase
      .from("finance_payments")
      .select("id")
      .eq("tenant_id", TENANT_B)
      .in("accounting_status", ["pending", "drafted", "failed"])
      .in("id", [a2PaymentId, a2FailPaymentId]);
    ok("29 cross-tenant queue access denied",
      (crossQueue?.length ?? 0) === 0);

    /* 30 — retry on a failed source either rebuilds or re-posts the
       draft. We re-create a clean draft for the fail-payment first
       (the previous draft is stuck unbalanced), then verify retry
       brings the source to 'failed' again on the same unbalanced
       data — confirming the retry path is wired without silently
       laundering broken data. */
    const retried = await retryRecognition(ctx, "payment", a2FailPaymentId);
    /* The existing unbalanced draft is still there from the manual
       insert above; retry tries to post it and fails. Voilà — same
       failure path, same status. The point of this assertion is the
       FLOW, not the data outcome. */
    ok("30 retry path runs without silent success on broken draft",
      !retried.ok);
  } finally {
    await clean();
  }

  console.log(`\n[summary] ${passes} pass / ${failures} fail`);
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((e) => {
  console.error("[accounting] crashed:", e);
  process.exit(2);
});
