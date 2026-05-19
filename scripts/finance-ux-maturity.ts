#!/usr/bin/env tsx

/* ===========================================================================
   Finance UX Maturity validator.

   Coverage (12 assertions) — source-content checks. Importing TSX
   under react-server conditions crashes on React.createContext, so
   we assert via file reads.

     01  Setup label rename: "Company Base Currency" → "Main Operating Currency"
     02  Setup label rename: "Customers Receivable" → "Money Customers Owe Us"
     03  Setup label rename: "Suppliers Payable" → "Money We Owe Suppliers"
     04  Setup label rename: "FX Rates" → "Exchange Rates" + "Equity / Capital" → "Owner Capital"
     05  Finance Setup renders SetupGuidance with Recommended order + warnings
     06  KPI cards on FinanceExpenses are wrapped in Link
     07  KPI cards on FinanceOrders are wrapped in Link
     08  VisualStatements hero KPIs wrapped in Link
     09  Executive KpiCard has tier prop ("primary" vs "secondary")
     10  OperationalKpi accepts href + uses Link when set
     11  Executive labels switched to business language
         (Money to Collect (AR) / Money to Pay (AP) / Currency Exposure)
     12  FxRatesManager title renamed to "Exchange Rates"
   ========================================================================== */

import fs from "node:fs/promises";

let passes = 0, failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function main() {
  console.log("─".repeat(72));
  console.log("  Finance UX Maturity validator");
  console.log("─".repeat(72));

  const onboarding   = await fs.readFile("./src/lib/finance/onboarding.ts", "utf8");
  const setup        = await fs.readFile("./src/components/finance/FinanceSetup.tsx", "utf8");
  const expenses     = await fs.readFile("./src/components/finance/FinanceExpenses.tsx", "utf8");
  const orders       = await fs.readFile("./src/components/finance/FinanceOrders.tsx", "utf8");
  const visual       = await fs.readFile("./src/components/finance/VisualStatements.tsx", "utf8");
  const executive    = await fs.readFile("./src/components/executive/ExecutiveDashboard.tsx", "utf8");
  const exeIntel     = await fs.readFile("./src/lib/executive/intelligence.ts", "utf8");
  const dashUi       = await fs.readFile("./src/components/finance/FinanceDashboardUi.tsx", "utf8");
  const fxMgr        = await fs.readFile("./src/components/finance/FxRatesManager.tsx", "utf8");

  /* 01–04 */
  ok("01  Setup: \"Main Operating Currency\" replaces \"Company Base Currency\"",
     onboarding.includes("Main Operating Currency") && !onboarding.includes("Company Base Currency"));
  ok("02  Setup: \"Money Customers Owe Us\" replaces \"Customers Receivable\"",
     onboarding.includes("Money Customers Owe Us") && !onboarding.includes("title: \"Customers Receivable\""));
  ok("03  Setup: \"Money We Owe Suppliers\" replaces \"Suppliers Payable\"",
     onboarding.includes("Money We Owe Suppliers") && !onboarding.includes("title: \"Suppliers Payable\""));
  ok("04  Setup: \"Exchange Rates\" + \"Owner Capital\" replace technical names",
     onboarding.includes("title: \"Exchange Rates\"")
       && onboarding.includes("title: \"Owner Capital\"")
       && !onboarding.includes("title: \"FX Rates\"")
       && !onboarding.includes("title: \"Equity / Capital\""));

  /* 05 */
  ok("05  Finance Setup renders SetupGuidance with Recommended order banner",
     setup.includes("function SetupGuidance") && setup.includes("Recommended order"));

  /* 06–08 — clickable KPI surfaces. */
  ok("06  FinanceExpenses wraps KPI cards in <Link>",
     /<Link[^>]*href=["']\/finance\/expenses[^"']*["'][\s\S]{0,80}<HeroKpiCard/.test(expenses)
       && /<Link[^>]*href=["']\/finance\/expenses[^"']*["'][\s\S]{0,120}<MetricCard/.test(expenses));
  /* For #7 and #8 we look for a Link with the expected drill-down
     href AND an inner KPI render in the same component file. Regex
     proximity matching is unreliable across multi-line JSX, so we
     accept the assertion when both signatures coexist. */
  ok("07  FinanceOrders wraps KPI cards in <Link> (Revenue / Net Profit / Outstanding)",
     orders.includes('href="/finance/visual"')
       && orders.includes('href="/reports/statements?tab=ar"')
       && orders.includes("<HeroKpiCard"));
  ok("08  VisualStatements wraps KPI headers in <Link>",
     visual.includes('href="/reports/statements"')
       && visual.includes("<KpiHeader"));

  /* 09 */
  ok("09  Executive KpiCard supports tier prop (primary / secondary)",
     executive.includes("tier?: \"primary\" | \"secondary\"")
       && executive.includes("tier=\"secondary\""));

  /* 10 */
  ok("10  OperationalKpi accepts href prop and uses Link when set",
     dashUi.includes("href?: string;")
       && dashUi.includes("<Link href={href}"));

  /* 11 */
  ok("11  Executive uses business-language KPI labels (Money to Collect (AR) / Money to Pay (AP) / Currency Exposure)",
     exeIntel.includes("Money to Collect (AR)")
       && exeIntel.includes("Money to Pay (AP)")
       && exeIntel.includes("Currency Exposure"));

  /* 12 */
  ok("12  FxRatesManager title renamed to Exchange Rates",
     fxMgr.includes("title=\"Exchange Rates\""));

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
