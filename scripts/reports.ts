#!/usr/bin/env tsx

/* ===========================================================================
   Phase R.1 — Reporting validators.

   Tests the visibility contract + tenant isolation + builder
   correctness for the 7 report types end-to-end. The harness exercises
   the builders directly (no HTTP) but uses the same supabaseServer
   client they do, so RLS / tenant_id behaviour is identical.

   Coverage:
     1.  Customer statement: external visibility flag
     2.  Customer statement: NO internal_warning leaked
     3.  Customer statement: NO profit/cost/margin words appear anywhere
     4.  Customer statement: opening + invoiced − received = closing
     5.  Supplier statement: external visibility flag
     6.  Supplier statement: NO internal_warning leaked
     7.  Payment report: internal visibility + warning band
     8.  Reconciliation report: internal visibility + warning band
     9.  Treasury report: internal visibility + USD aggregate present
    10.  Expense report: internal visibility + category roll-up
    11.  Executive summary: internal visibility + treasury + revenue
    12.  Tenant isolation: builder for tenant A returns 0 rows when
         data lives in tenant B
    13.  Registry: missing required filter raises a clear error
    14.  Renderer: external visibility strips internal_warning even if
         a builder accidentally sets one
    15.  Audit row written for non-preview channel
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.warn("[reports] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

/* Two sandbox tenants to confirm tenant isolation. */
const TENANT_A = "00000000-0000-4000-a000-0000000000A1";
const TENANT_B = "00000000-0000-4000-a000-0000000000B1";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function ensureTenants() {
  for (const id of [TENANT_A, TENANT_B]) {
    await supabase.from("tenants").upsert({
      id, slug: `phase-r-${id.slice(-4)}`, name: `Phase-R Sandbox ${id.slice(-4)}`, is_host: false, active: true,
    }, { onConflict: "id" });
  }
}

async function clean() {
  for (const t of [TENANT_A, TENANT_B]) {
    await supabase.from("finance_report_exports").delete().eq("tenant_id", t);
    await supabase.from("finance_payments").delete().eq("tenant_id", t);
    await supabase.from("finance_order_suppliers").delete().eq("tenant_id", t);
    await supabase.from("finance_orders").delete().eq("tenant_id", t);
    await supabase.from("finance_expenses").delete().eq("tenant_id", t);
    await supabase.from("finance_cash_movements").delete().eq("tenant_id", t);
    await supabase.from("finance_bank_accounts").delete().eq("tenant_id", t);
    await supabase.from("customers").delete().eq("tenant_id", t);
    await supabase.from("suppliers").delete().eq("tenant_id", t);
  }
}

interface Seeded {
  tenantId: string;
  customerId: string;
  supplierId: string;
  bankAccountId: string;
}

async function seed(tenantId: string): Promise<Seeded> {
  const customerId = randomUUID();
  const supplierId = randomUUID();
  const bankAccountId = randomUUID();

  await supabase.from("customers").insert({ id: customerId, tenant_id: tenantId, name: "Sandbox Customer", company_name: "Sandbox Customer Co", email: "cust@example.com" });
  await supabase.from("suppliers").insert({ id: supplierId, tenant_id: tenantId, name: "Sandbox Supplier", company_name: "Sandbox Supplier Inc", email: "supp@example.com" });
  await supabase.from("finance_bank_accounts").insert({
    id: bankAccountId, tenant_id: tenantId, bank_name: "Sandbox Bank", account_name: "Main", currency: "USD",
    opening_balance: 1000, current_balance: 5000, available_balance: 5000, status: "active", is_primary: true,
  });

  /* One order + one customer payment so the statement has motion. */
  const orderId = randomUUID();
  await supabase.from("finance_orders").insert({
    id: orderId, tenant_id: tenantId, order_no: `T-${tenantId.slice(-4)}-001`,
    customer_id: customerId, customer_name: "Sandbox Customer Co",
    order_date: "2026-04-01", currency: "USD",
    selling_price: 10_000, tax_refund_pct: 0, tax_refund_value: 0, financial_charges: 0,
    status: "open", payment_status: "partial",
  });
  await supabase.from("finance_payments").insert({
    id: randomUUID(), tenant_id: tenantId, direction: "in", party_type: "customer",
    party_id: customerId, party_name: "Sandbox Customer Co",
    amount: 3_000, currency: "USD", payment_date: "2026-04-15",
    payment_method: "wire", reference_no: "WIRE-1",
    status: "completed", reconciliation_status: "unreconciled", approval_status: "approved",
    linked_order_id: orderId,
  });

  /* Supplier purchase line + payment out. */
  await supabase.from("finance_order_suppliers").insert({
    id: randomUUID(), tenant_id: tenantId, order_id: orderId,
    supplier_id: supplierId, supplier_name: "Sandbox Supplier Inc",
    supplier_cost: 6_000, currency: "USD", payment_status: "partial", paid_amount: 2_000,
  });
  await supabase.from("finance_payments").insert({
    id: randomUUID(), tenant_id: tenantId, direction: "out", party_type: "supplier",
    party_id: supplierId, party_name: "Sandbox Supplier Inc",
    amount: 2_000, currency: "USD", payment_date: "2026-04-20",
    payment_method: "wire", reference_no: "WIRE-2",
    status: "completed", reconciliation_status: "unreconciled", approval_status: "approved",
    linked_order_id: orderId,
  });

  /* Expenses + a cash movement to feed the other reports. */
  await supabase.from("finance_expenses").insert({
    id: randomUUID(), tenant_id: tenantId, title: "Customs clearance",
    amount: 250, currency: "USD", expense_date: "2026-04-10",
    payment_status: "paid", approval_status: "approved",
  });
  await supabase.from("finance_cash_movements").insert({
    id: randomUUID(), tenant_id: tenantId, bank_account_id: bankAccountId,
    movement_type: "incoming", direction: "inflow", currency: "USD",
    amount: 3_000, movement_date: "2026-04-15",
    bank_reference: "WIRE-1", reconciliation_status: "matched", evidence_status: "verified",
  });

  return { tenantId, customerId, supplierId, bankAccountId };
}

async function main() {
  console.log("\n[Phase R.1 — Reports validators]\n");
  await ensureTenants();
  await clean();
  try {
    const a = await seed(TENANT_A);
    /* Seed tenant B with the SAME customer_id to confirm isolation:
       querying for that id from tenant A must NOT see tenant B's data. */
    await seed(TENANT_B);

    /* Import builders dynamically so the heavy server-only modules
       are only loaded once the env check above has passed. */
    const { buildCustomerStatement } = await import("../src/lib/reports/builders/customer-statement.js");
    const { buildSupplierStatement } = await import("../src/lib/reports/builders/supplier-statement.js");
    const { buildPaymentReport } = await import("../src/lib/reports/builders/payment-report.js");
    const { buildReconciliationReport } = await import("../src/lib/reports/builders/reconciliation-report.js");
    const { buildTreasuryReport } = await import("../src/lib/reports/builders/treasury-report.js");
    const { buildExpenseReport } = await import("../src/lib/reports/builders/expense-report.js");
    const { buildExecutiveSummary } = await import("../src/lib/reports/builders/executive-summary.js");
    const { renderReportHtml } = await import("../src/lib/reports/html-renderer.js");
    const { findMissingRequiredFilter } = await import("../src/lib/reports/registry.js");

    const baseCtx = (tenantId: string) => ({
      tenantId,
      tenantName: "",
      generatedByName: "test-operator",
      generatedByAccountId: null,
      filters: {},
    });

    /* ── Customer statement ───────────────────────────────────── */
    const cs = await buildCustomerStatement({
      ...baseCtx(TENANT_A),
      filters: { customer_id: a.customerId, date_from: "2026-01-01", date_to: "2026-12-31" },
    });
    ok("01 customer statement: visibility=external", cs.meta.visibility === "external");
    ok("02 customer statement: no internal_warning", cs.internal_warning === undefined);
    const csJson = JSON.stringify(cs).toLowerCase();
    const leakyTerms = ["profit", "margin", "supplier_cost", "supplier cost", "intelligence", "treasury risk"];
    const leaked = leakyTerms.filter((t) => csJson.includes(t));
    ok("03 customer statement: no leaky terms", leaked.length === 0, leaked.join(", ") || undefined);

    /* opening + invoiced − received = closing reconciles. */
    const opening = Number(cs.summary.find((s) => s.label === "Opening Balance")?.value ?? 0);
    const invoiced = Number(cs.summary.find((s) => s.label === "Invoiced")?.value ?? 0);
    const received = Number(cs.summary.find((s) => s.label === "Payments Received")?.value ?? 0);
    const closing = Number(cs.summary.find((s) => s.label === "Closing Balance")?.value ?? 0);
    ok("04 customer statement: balance arithmetic", Math.abs((opening + invoiced - received) - closing) < 0.01);

    /* ── Supplier statement ───────────────────────────────────── */
    const ss = await buildSupplierStatement({
      ...baseCtx(TENANT_A),
      filters: { supplier_id: a.supplierId, date_from: "2026-01-01", date_to: "2026-12-31" },
    });
    ok("05 supplier statement: visibility=external", ss.meta.visibility === "external");
    ok("06 supplier statement: no internal_warning", ss.internal_warning === undefined);

    /* ── Payment report ───────────────────────────────────────── */
    const pr = await buildPaymentReport({
      ...baseCtx(TENANT_A),
      filters: { date_from: "2026-01-01", date_to: "2026-12-31" },
    });
    ok("07 payment report: visibility=internal + warning", pr.meta.visibility === "internal" && !!pr.internal_warning);

    /* ── Reconciliation report ────────────────────────────────── */
    const rr = await buildReconciliationReport({
      ...baseCtx(TENANT_A),
      filters: { date_from: "2026-01-01", date_to: "2026-12-31" },
    });
    ok("08 reconciliation report: visibility=internal + warning", rr.meta.visibility === "internal" && !!rr.internal_warning);

    /* ── Treasury report ──────────────────────────────────────── */
    const tr = await buildTreasuryReport({
      ...baseCtx(TENANT_A),
      filters: {},
    });
    const treasuryUsdLabel = tr.summary.find((s) => s.label.includes("USD"));
    ok("09 treasury report: visibility=internal + USD aggregate", tr.meta.visibility === "internal" && !!treasuryUsdLabel);

    /* ── Expense report ───────────────────────────────────────── */
    const er = await buildExpenseReport({
      ...baseCtx(TENANT_A),
      filters: { date_from: "2026-01-01", date_to: "2026-12-31" },
    });
    const hasCategorySection = er.sections.some((s) => s.kind === "table" && s.title === "By Category");
    ok("10 expense report: visibility=internal + category roll-up", er.meta.visibility === "internal" && hasCategorySection);

    /* ── Executive summary ────────────────────────────────────── */
    const ex = await buildExecutiveSummary({
      ...baseCtx(TENANT_A),
      filters: { date_from: "2026-01-01", date_to: "2026-12-31" },
    });
    const hasRevenue = ex.summary.some((s) => s.label.toLowerCase().includes("revenue"));
    const hasTreasury = ex.summary.some((s) => s.label.toLowerCase().includes("treasury"));
    ok("11 executive summary: internal + revenue + treasury", ex.meta.visibility === "internal" && hasRevenue && hasTreasury);

    /* ── Tenant isolation: tenant A asks for tenant B's customer ─ */
    const seedB = await supabase.from("customers").select("id").eq("tenant_id", TENANT_B).limit(1).maybeSingle();
    const bCustomerId = (seedB.data as { id?: string } | null)?.id ?? null;
    if (bCustomerId) {
      const isolated = await buildCustomerStatement({
        ...baseCtx(TENANT_A),
        filters: { customer_id: bCustomerId, date_from: "2026-01-01", date_to: "2026-12-31" },
      });
      /* Two checks:
           a) the Account Activity table has only the opening-balance
              stub row (no payments / no invoices from tenant B leaked)
           b) the Outstanding by Age table — always present in the new
              document layout — shows zeros in every bucket */
      const activitySection = isolated.sections.find(
        (s) => s.kind === "table" && s.title === "Account Activity",
      );
      const activityRows = (activitySection && activitySection.kind === "table"
        ? activitySection.rows
        : []
      ).filter((r) => r.description !== "Opening balance");

      const agingSection = isolated.sections.find(
        (s) => s.kind === "table" && s.title === "Outstanding by Age",
      );
      const agingLeaked = (agingSection && agingSection.kind === "table" ? agingSection.rows : [])
        .some((r) => Number(r.amount) !== 0);

      ok(
        "12 tenant isolation: B's data invisible to A",
        activityRows.length === 0 && !agingLeaked,
        `activity=${activityRows.length}, aging_leaked=${agingLeaked}`,
      );
    } else {
      ok("12 tenant isolation: seed B customer present", false, "seed B did not insert a customer row");
    }

    /* ── Registry: missing required filter ────────────────────── */
    const missing = findMissingRequiredFilter("customer_statement", {});
    ok("13 registry: missing required filter caught", missing === "customer_id");

    /* ── Renderer: external strips internal_warning ───────────── */
    const fakeExternal = { ...cs, internal_warning: "SHOULD NEVER APPEAR" };
    const externalHtml = renderReportHtml(fakeExternal);
    ok("14 renderer: external strips internal_warning", !externalHtml.includes("SHOULD NEVER APPEAR"));

    /* ── Audit row written for non-preview channel ────────────── */
    const { buildAndAudit } = await import("../src/lib/reports/build.js");
    const fakeAuth = {
      account_id: null as unknown as string,
      tenant_id: TENANT_A,
      role_id: null as unknown as string,
      department: null,
      is_super_admin: true,
      can_view_private: true,
      username: "validator",
      login_email: "validator@example.com",
      status: "active",
      user_type: "employee",
    };
    const before = await supabase.from("finance_report_exports").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_A);
    const audited = await buildAndAudit({
      auth: fakeAuth,
      type: "customer_statement",
      filters: { customer_id: a.customerId, date_from: "2026-01-01", date_to: "2026-12-31" },
      channel: "pdf",
    });
    const after = await supabase.from("finance_report_exports").select("id", { count: "exact", head: true }).eq("tenant_id", TENANT_A);
    ok("15 audit row written for pdf channel",
      audited.ok && (after.count ?? 0) === (before.count ?? 0) + 1);
  } finally {
    await clean();
  }

  console.log(`\n[summary] ${passes} pass / ${failures} fail`);
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((e) => {
  console.error("[reports] crashed:", e);
  process.exit(2);
});
