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

    /* opening + invoiced − received = closing reconciles. Closing
       now lives in `totals`, not in summary (R.2 surface change). */
    const opening = Number(cs.summary.find((s) => s.label === "Opening Balance")?.value ?? 0);
    const invoiced = Number(cs.summary.find((s) => s.label === "Invoiced")?.value ?? 0);
    const received = Number(cs.summary.find((s) => s.label === "Payments Received")?.value ?? 0);
    const closing = Number(cs.totals?.find((t) => t.label === "Closing Balance")?.value ?? 0);
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

    /* ── R.2 deepening assertions ────────────────────────────────── */

    /* 16 — customer statement carries the AP-style aging table with
       the five expected buckets. The buckets exist even when totals
       are zero (so an empty statement still shows them). */
    const csAging = cs.sections.find((s) => s.kind === "table" && s.title === "Outstanding by Age");
    const csAgingRows = (csAging && csAging.kind === "table" ? csAging.rows : []) as Array<Record<string, unknown>>;
    const expectedBuckets = ["Current", "31 – 60", "61 – 90", "91 – 180", "Over 180"];
    const hasAllCustomerBuckets = expectedBuckets.every((b) => csAgingRows.some((r) => r.bucket === b));
    ok("16 customer statement: 5 aging buckets present", hasAllCustomerBuckets);

    /* 17 — supplier statement has its AP aging block. */
    const ssAging = ss.sections.find((s) => s.kind === "table" && s.title === "Outstanding by Age");
    ok("17 supplier statement: outstanding-by-age table present",
      !!ssAging && ssAging.kind === "table" && ssAging.rows.length === 5);

    /* 18 — supplier statement deliberately exposes NO customer-side
       financial terms. (External report safety.) */
    const ssJson = JSON.stringify(ss).toLowerCase();
    const supplierLeakTerms = ["gross profit", "net profit", "margin", "customer_revenue", "customer revenue"];
    const ssLeaked = supplierLeakTerms.filter((t) => ssJson.includes(t));
    ok("18 supplier statement: no profit/margin leakage", ssLeaked.length === 0, ssLeaked.join(", ") || undefined);

    /* 19 — payment report carries the Money In / Money Out split
       AND the Status + Reconciliation kv blocks. */
    const hasMoneyIn  = pr.sections.some((s) => s.kind === "table" && s.title?.startsWith("Money In"));
    const hasMoneyOut = pr.sections.some((s) => s.kind === "table" && s.title?.startsWith("Money Out"));
    const hasStatusKv = pr.sections.some((s) => s.kind === "kv" && s.title === "Status Breakdown");
    const hasReconKv  = pr.sections.some((s) => s.kind === "kv" && s.title === "Reconciliation");
    ok("19 payment report: in/out split + status + recon kv", hasMoneyIn && hasMoneyOut && hasStatusKv && hasReconKv);

    /* 20 — payment report exposes the evidence column. */
    const prTable = pr.sections.find((s) => s.kind === "table");
    const hasEvidenceCol = prTable && prTable.kind === "table" && prTable.columns.some((c) => c.key === "evidence");
    ok("20 payment report: evidence column present", !!hasEvidenceCol);

    /* 21 — reconciliation report carries engine candidate state,
       movement totals, and the audit note. */
    const hasCandidateKv = rr.sections.some((s) => s.kind === "kv" && s.title === "Engine Candidate State");
    const hasMovementKv  = rr.sections.some((s) => s.kind === "kv" && s.title === "Movement Totals (this period)");
    const hasAuditNote   = rr.sections.some((s) => s.kind === "note" && s.title === "Audit note");
    ok("21 reconciliation report: state + totals + audit note", hasCandidateKv && hasMovementKv && hasAuditNote);

    /* 22 — treasury report has FX exposure + concentration tables. */
    const hasFxTable    = tr.sections.some((s) => s.kind === "table" && s.title === "FX Exposure by Currency");
    const hasConcTable  = tr.sections.some((s) => s.kind === "table" && s.title === "Account Concentration");
    ok("22 treasury report: FX exposure + concentration", hasFxTable && hasConcTable);

    /* 23 — expense report Detail table includes evidence_status. */
    const exDetail = er.sections.find((s) => s.kind === "table" && s.title === "Detail");
    const hasEvidenceStatusCol = exDetail && exDetail.kind === "table" && exDetail.columns.some((c) => c.key === "evidence_status");
    ok("23 expense report: evidence_status column present", !!hasEvidenceStatusCol);

    /* 24 — executive summary classified EXECUTIVE — DO NOT DISTRIBUTE. */
    ok("24 executive summary: EXECUTIVE classification",
      ex.internal_warning === "EXECUTIVE — DO NOT DISTRIBUTE");

    /* 25 — executive summary has the three required top-N tables. */
    const hasTopCust = ex.sections.some((s) => s.kind === "table" && s.title === "Top Customers (period)");
    const hasTopSup  = ex.sections.some((s) => s.kind === "table" && s.title === "Top Supplier Exposure");
    const hasTopOrd  = ex.sections.some((s) => s.kind === "table" && s.title === "Top Profitable Orders");
    ok("25 executive summary: top customers / suppliers / orders", hasTopCust && hasTopSup && hasTopOrd);

    /* 26 — executive summary has Profitability + Liquidity kv blocks. */
    const hasProfit  = ex.sections.some((s) => s.kind === "kv" && s.title === "Profitability");
    const hasLiq     = ex.sections.some((s) => s.kind === "kv" && s.title === "Liquidity");
    ok("26 executive summary: profitability + liquidity kv", hasProfit && hasLiq);

    /* 27 — multi-page table hygiene: every table section emits a
       <thead> with display:table-header-group so paginated rendering
       repeats the header. Spot-check the payment report (it has the
       largest detail table). */
    const prHtml = renderReportHtml(pr);
    const theadCount = (prHtml.match(/display:table-header-group/g) ?? []).length;
    ok("27 multi-page hygiene: thead group-display present", theadCount > 0, `count=${theadCount}`);

    /* Tiny local helper used by R.3 assertions to keep callsites tidy. */
    const csHtml = (p: unknown) => renderReportHtml(p as never);

    /* ── R.3 print-polish + multi-language assertions ────────────── */

    /* 28 — executive cover page renders with the headline KPI tiles,
       top risks, and narrative. Cover sits in its own A4 sheet via
       page-break-after:always. */
    ok("28 executive: cover page payload present",
      !!ex.cover && Array.isArray(ex.cover.headline) && ex.cover.headline.length >= 4);
    const exHtml = renderReportHtml(ex);
    ok("29 executive: cover page renders + page-break-after",
      exHtml.includes('class="rpt-cover"') && exHtml.includes("page-break-after:always"));

    /* 30 — formal signature block: every report carries either the
       payload-provided signatures OR the renderer-synthesised
       default set. Verify by checking the rendered HTML for the
       signature-line treatment. */
    ok("30 signature block rendered on every report",
      [csHtml(cs), csHtml(ss), csHtml(pr), csHtml(rr), csHtml(tr), csHtml(er), exHtml]
        .every((h) => h.includes('class="rpt-signature')));

    /* 31 — internal reports get the full Prepared/Reviewed/Approved
       chain; external reports get Prepared only. */
    const externalSigCount = (csHtml(cs).match(/Signature<\/span>/g) ?? []).length;
    const internalSigCount = (csHtml(pr).match(/Signature<\/span>/g) ?? []).length;
    const executiveSigCount = (exHtml.match(/Signature<\/span>/g) ?? []).length;
    ok("31 signature roles: external=1, internal=3, executive=4",
      externalSigCount === 1 && internalSigCount === 3 && executiveSigCount === 4,
      `ext=${externalSigCount}, int=${internalSigCount}, exec=${executiveSigCount}`);

    /* 32 — QR verification placeholder renders on the executive
       summary (only report that opts in via payload.verification). */
    ok("32 verification placeholder present on executive",
      exHtml.includes('class="rpt-verification') && exHtml.includes("QR"));

    /* 33 — print-safe utility classes emitted in the stylesheet. */
    ok("33 print-safe utility classes in stylesheet",
      exHtml.includes(".avoid-break") &&
      exHtml.includes(".keep-with-next") &&
      exHtml.includes(".section-safe") &&
      exHtml.includes(".totals-safe"));

    /* 34 — orphan/widow defence: body declares orphans:3 + widows:3
       and the @page rule is present. */
    ok("34 orphans/widows + @page rule present",
      exHtml.includes("orphans: 3") && exHtml.includes("widows: 3") && exHtml.includes("@page"));

    /* 35 — RTL locale renders without crashing AND emits dir="rtl". */
    const arPayload = { ...cs, meta: { ...cs.meta, locale: "ar-EG" } };
    const arHtml = renderReportHtml(arPayload);
    ok("35 RTL locale renders + dir=rtl",
      arHtml.includes('dir="rtl"') && arHtml.includes('lang="ar-EG"'));

    /* 36 — Chinese locale renders without crashing AND emits dir=ltr
       (CJK is LTR). */
    const zhPayload = { ...cs, meta: { ...cs.meta, locale: "zh-CN" } };
    const zhHtml = renderReportHtml(zhPayload);
    ok("36 CJK locale renders + dir=ltr",
      zhHtml.includes('dir="ltr"') && zhHtml.includes('lang="zh-CN"'));

    /* 37 — corporate-identity block present on every report. The
       sandbox tenant isn't named "KOLEEX", so the renderer falls
       back to the generic identity (tenant name + koleexgroup.com).
       The KOLEEX-specific Taizhou identity is exercised separately
       below. */
    ok("37a generic identity present (sandbox tenant)",
      exHtml.includes("koleexgroup.com") && exHtml.includes("Phase-R Sandbox"));
    const koleexPayload = { ...ex, meta: { ...ex.meta, tenant_name: "KOLEEX International Group" } };
    const koleexHtml = renderReportHtml(koleexPayload);
    ok("37b KOLEEX identity expands to Taizhou + finance@",
      koleexHtml.includes("Taizhou") && koleexHtml.includes("finance@koleexgroup.com"));

    /* 38 — per-page running footer template (Puppeteer) carries
       page X of Y + classification + report id. */
    const { pageFooterTemplate } = await import("../src/lib/reports/layout.js");
    const footerTpl = pageFooterTemplate(ex);
    ok("38 page footer template: classification + page X/Y",
      footerTpl.includes("EXECUTIVE") &&
      footerTpl.includes('class="pageNumber"') &&
      footerTpl.includes('class="totalPages"'));
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
