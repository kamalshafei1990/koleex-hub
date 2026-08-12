#!/usr/bin/env tsx

/* ===========================================================================
   Experience Refinement validator.

   Coverage (7 assertions) — source-content checks because the
   components are TSX (importing them under react-server conditions
   crashes on React.createContext).

   Assertions 01-03 covered RoleHome (the /home role dashboard). That screen
   was removed — it had no entry point anywhere in the Hub, and the drawer it
   carried was the privilege-escalation vector for dashboard_role. Its three
   checks went with it rather than being left to assert against a deleted file.
   See validate:role-experience 07 and 10 for what replaced them.

     04  FinanceWorkspace: top-actions reduced to 3 tiles
     05  FinanceWorkspace: Recent Activity + Nav cards wrapped in
         FocusBoundary
     06  ExecutiveDashboard: primary KPI row reduced to 4 cards
     07  ExecutiveDashboard: secondary KPIs + inventory-intel + FX
         wrapped in FocusBoundary
     08  Reports: OperationalReports renders SummaryStrip (Top
         contributor / Top-3 share / Everything else) above the table
     09  "+ Create" header chip wired on FinanceWorkspace +
         ExecutiveDashboard (opens SmartCreateDrawer)
     10  No raw "HTTP ${" leaks remaining in audited touch files
   ========================================================================== */

import fs from "node:fs/promises";

let passes = 0, failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function main() {
  console.log("─".repeat(72));
  console.log("  Experience Refinement validator");
  console.log("─".repeat(72));

  const workspace  = await fs.readFile("./src/components/finance/FinanceWorkspace.tsx", "utf8");
  const exec       = await fs.readFile("./src/components/executive/ExecutiveDashboard.tsx", "utf8");
  const reports    = await fs.readFile("./src/components/reports/OperationalReports.tsx", "utf8");

  /* 04 — FinanceWorkspace: "Top actions" section has 3 or 4 tiles
     (was 4 + 8 in the previous layout). 4 is the current shape after
     the Data-Entry discoverability fix added that tile. */
  const topActionsBlock = workspace.match(/Top actions[\s\S]*?<\/section>/)?.[0] ?? "";
  const topActionsCount = (topActionsBlock.match(/<ErpQuickAction\b/g) ?? []).length;
  ok("04  FinanceWorkspace: Top actions kept compact (3-4 tiles)",
     topActionsCount >= 3 && topActionsCount <= 4, `got ${topActionsCount}`);

  /* 05 */
  ok("05  FinanceWorkspace: Recent Activity + Nav cards inside FocusBoundary",
     workspace.includes("<FocusBoundary>") && workspace.includes("Recent Activity"));

  /* 06 — Exec primary KPI grid has exactly 4 KpiCards before the
     secondary FocusBoundary block. */
  const primaryBlock = exec.match(/Primary KPIs[\s\S]*?<\/div>/)?.[0] ?? "";
  const primaryCount = (primaryBlock.match(/<KpiCard\b/g) ?? []).length;
  ok("06  ExecutiveDashboard: primary KPI row reduced to 4 cards",
     primaryCount === 4, `got ${primaryCount}`);

  /* 07 */
  ok("07  ExecutiveDashboard: secondary KPIs + intel + FX wrapped in FocusBoundary",
     exec.includes("Secondary KPIs") && (exec.match(/<FocusBoundary>/g) ?? []).length >= 2);

  /* 08 */
  ok("08  OperationalReports: SummaryStrip renders above the table",
     reports.includes("function SummaryStrip") && reports.includes("<SummaryStrip"));

  /* 09 */
  const createChip = "openSmartCreate()";
  ok("09  '+ Create' chip wired on FinanceWorkspace + ExecutiveDashboard",
     workspace.includes(createChip) && exec.includes(createChip));

  /* 10 — Raw HTTP-status leaks must always go through humanizeError().
     `throw new Error(j.error || \`HTTP ${r.status}\`)` is OK only when
     wrapped in humanizeError(). */
  const lines = [workspace, exec, reports].flatMap((src) => src.split("\n"));
  const bad = lines.filter((line) =>
    /HTTP \$\{r\.status\}|Failed\s?\(\$\{r\.status\}\)/.test(line)
    && !line.includes("humanizeError"));
  ok("10  Touched surfaces always wrap HTTP status in humanizeError()",
     bad.length === 0,
     bad.length > 0 ? `still leaks in ${bad.length} line(s)` : "");

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
