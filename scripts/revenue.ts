#!/usr/bin/env tsx

/* ===========================================================================
   Phase A.5 — Revenue + AR validator.

   Coverage (10 assertions):
     01  Confirmed invoice creates a draft entry (status='draft', prefix JE-REV)
     02  Debit = Credit
     03  Amount equals invoice.total
     04  Dr line uses 1100 Accounts Receivable
     05  Cr line uses 4000 Sales Revenue
     06  Source linkage: source_type='sales_revenue', source_id=invoice
     07  Duplicate draft is idempotent
     08  Posting flips journal AND invoices.accounting_status='posted'
     09  Voiding the journal cascades to invoices.accounting_status='voided'
     10  Tenant isolation — A cannot draft against B's invoice
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import {
  draftRevenueRecognition,
  postDraftedEntry,
  voidJournalEntry,
} from "../src/lib/accounting/posting";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[revenue] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT_A = "00000000-0000-4000-a000-0000000000A5";
const TENANT_B = "00000000-0000-4000-a000-0000000000B5";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}
function near(a: number, b: number, tol = 0.005) { return Math.abs(a - b) < tol; }

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `phase-a5-${id.slice(-4)}`,
      name: `Phase-A5 Sandbox ${id.slice(-4)}`,
      is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("accounting_journal_lines").delete().eq("tenant_id", t);
    await supabase.from("accounting_journal_entries").delete().eq("tenant_id", t);
    await supabase.from("accounting_accounts").delete().eq("tenant_id", t);
    const { data: invs } = await supabase.from("invoices").select("id").eq("tenant_id", t);
    const ids = ((invs ?? []) as Array<{ id: string }>).map((i) => i.id);
    if (ids.length > 0) {
      await supabase.from("invoice_items").delete().in("invoice_id", ids);
      await supabase.from("invoices").delete().in("id", ids);
    }
  }
}

async function ensureCustomer(tenantId: string): Promise<string> {
  const tag = `Phase-A5 ${tenantId.slice(-4)}`;
  const { data: existing } = await supabase.from("customers").select("id").eq("tenant_id", tenantId).eq("name", tag).limit(1);
  if (existing && existing.length > 0) return (existing[0] as { id: string }).id;
  const { data, error } = await supabase.from("customers").insert({ tenant_id: tenantId, name: tag }).select("id").single();
  if (error || !data) throw new Error(`customer seed: ${error?.message}`);
  return (data as { id: string }).id;
}

async function createInvoice(opts: { tenantId: string; customerId: string; total: number; status?: string }): Promise<string> {
  const total = opts.total;
  const { data, error } = await supabase.from("invoices").insert({
    tenant_id: opts.tenantId,
    inv_no: `INV-A5-${Date.now().toString(16).slice(-6).toUpperCase()}`,
    customer_id: opts.customerId,
    status: opts.status ?? "issued",
    currency: "USD",
    issue_date: new Date().toISOString().slice(0, 10),
    subtotal: total, tax_rate: 0, tax_total: 0,
    discount_percent: 0, discount_total: 0,
    total, amount_paid: 0, balance: total,
    doc: {},
  }).select("id").single();
  if (error || !data) throw new Error(`invoice insert: ${error?.message}`);
  return (data as { id: string }).id;
}

async function main() {
  console.log("─".repeat(72));
  console.log("Phase A.5 — Revenue + AR validator");
  console.log("─".repeat(72));

  await ensureTenants();
  await clean();
  const customerA = await ensureCustomer(TENANT_A);
  const customerB = await ensureCustomer(TENANT_B);

  const invoiceId = await createInvoice({ tenantId: TENANT_A, customerId: customerA, total: 1250 });

  /* 01 — Draft. */
  const drafted = await draftRevenueRecognition(
    { tenantId: TENANT_A, postedByAccountId: null }, invoiceId,
  );
  const draftedId = drafted.ok ? drafted.entry_id : "";
  const { data: entryRow } = await supabase
    .from("accounting_journal_entries")
    .select("id, source_type, source_id, status, journal_no")
    .eq("id", draftedId).maybeSingle();
  const entry = entryRow as { id: string; source_type: string; source_id: string; status: string; journal_no: string } | null;
  ok(
    "01  draftRevenueRecognition creates draft entry (JE-REV prefix)",
    drafted.ok && entry?.status === "draft" && entry.journal_no.startsWith("JE-REV"),
    `journal=${entry?.journal_no}`,
  );

  /* 02 — Debit = Credit. */
  const { data: lines } = await supabase
    .from("accounting_journal_lines")
    .select("debit, credit, account_id")
    .eq("entry_id", draftedId);
  const dr = ((lines ?? []) as Array<{ debit: number }>).reduce((s, l) => s + Number(l.debit  || 0), 0);
  const cr = ((lines ?? []) as Array<{ credit: number }>).reduce((s, l) => s + Number(l.credit || 0), 0);
  ok("02  debit total equals credit total", near(dr, cr) && dr > 0, `debit=${dr} credit=${cr}`);

  /* 03 — Amount equals invoice.total. */
  ok("03  entry amount equals invoice.total (1250)", near(dr, 1250), `amount=${dr}`);

  /* Account checks — Dr 1100, Cr 4000. */
  const { data: accts } = await supabase
    .from("accounting_accounts").select("id, code")
    .eq("tenant_id", TENANT_A).in("code", ["1100", "4000"]);
  const accs = ((accts ?? []) as Array<{ id: string; code: string }>);
  const arId  = accs.find((a) => a.code === "1100")?.id;
  const revId = accs.find((a) => a.code === "4000")?.id;
  const drLine = (lines ?? []).find((l) => Number((l as { debit: number }).debit)  > 0) as { account_id: string } | undefined;
  const crLine = (lines ?? []).find((l) => Number((l as { credit: number }).credit) > 0) as { account_id: string } | undefined;
  ok("04  Dr line uses 1100 Accounts Receivable", drLine?.account_id === arId);
  ok("05  Cr line uses 4000 Sales Revenue",       crLine?.account_id === revId);

  /* 06 — Source linkage. */
  ok(
    "06  source_type='sales_revenue', source_id=invoice",
    entry?.source_type === "sales_revenue" && entry?.source_id === invoiceId,
  );

  /* 07 — Idempotent. */
  const second = await draftRevenueRecognition(
    { tenantId: TENANT_A, postedByAccountId: null }, invoiceId,
  );
  const secondId = second.ok ? second.entry_id : "";
  ok(
    "07  duplicate draftRevenueRecognition returns same entry id",
    second.ok && secondId === draftedId,
    `id1=${draftedId.slice(0, 8)} id2=${secondId.slice(0, 8)}`,
  );

  /* 08 — Post draft → mirror invoice. */
  const posted = await postDraftedEntry(
    { tenantId: TENANT_A, postedByAccountId: null }, draftedId,
  );
  const { data: entryAfter } = await supabase
    .from("accounting_journal_entries").select("status").eq("id", draftedId).maybeSingle();
  const { data: invAfter } = await supabase
    .from("invoices")
    .select("accounting_status, accounting_entry_id, accounting_posted_at")
    .eq("id", invoiceId).maybeSingle();
  const invRow = invAfter as { accounting_status: string; accounting_entry_id: string | null; accounting_posted_at: string | null } | null;
  ok(
    "08  posting flips journal AND invoices.accounting_status='posted'",
    posted.ok &&
      (entryAfter as { status: string } | null)?.status === "posted" &&
      invRow?.accounting_status === "posted" &&
      invRow?.accounting_entry_id === draftedId &&
      !!invRow?.accounting_posted_at,
    `journal=${(entryAfter as { status?: string } | null)?.status} inv=${invRow?.accounting_status}`,
  );

  /* 09 — Void journal → mirror invoice. */
  const voidR = await voidJournalEntry(
    { tenantId: TENANT_A, postedByAccountId: null },
    draftedId,
    "test reversal",
  );
  const { data: entryVoid } = await supabase
    .from("accounting_journal_entries").select("status").eq("id", draftedId).maybeSingle();
  const { data: invVoid } = await supabase
    .from("invoices").select("accounting_status").eq("id", invoiceId).maybeSingle();
  ok(
    "09  voiding journal cascades to invoices.accounting_status='voided'",
    voidR.ok &&
      (entryVoid as { status: string } | null)?.status === "voided" &&
      (invVoid as { accounting_status: string } | null)?.accounting_status === "voided",
    `journal=${(entryVoid as { status?: string } | null)?.status} inv=${(invVoid as { accounting_status?: string } | null)?.accounting_status}`,
  );

  /* 10 — Tenant isolation. */
  const invB = await createInvoice({ tenantId: TENANT_B, customerId: customerB, total: 100 });
  const cross = await draftRevenueRecognition(
    { tenantId: TENANT_A, postedByAccountId: null }, invB,
  );
  const crossErr = !cross.ok ? cross : null;
  ok(
    "10  tenant isolation — A cannot draft revenue for B's invoice",
    !cross.ok && crossErr?.code === 404,
    crossErr?.error ?? "",
  );

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
