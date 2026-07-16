#!/usr/bin/env node
/* validate:finance-perf — Phase 4 Wave 2B.1 Finance dashboard performance.
   Deterministic static guards (no DB):
   (A) primary /finance dashboard shows a section skeleton on first load
       instead of blanking below the control bar;
   (B) privacy-safe instrumentation is present and records ONLY durations —
       never balances/revenue/costs/amounts/filters/ids;
   (C) /finance/intelligence has a stale-response guard + timing;
   (D) every finance dashboard endpoint stays auth-gated + Finance-module-gated
       + tenant-scoped (no security regression);
   (E) dead AppHomeMenu import removed from FinanceHome.
   Run: node --import tsx scripts/validate-finance-perf.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p: string) => path.resolve(__dirname, "..", p);
const read = (p: string) => fs.readFileSync(R(p), "utf8");

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };

const vs = read("src/components/finance/VisualStatements.tsx");
const fd = read("src/components/finance/FinanceDashboard.tsx");
const fh = read("src/components/finance/FinanceHome.tsx");

// ── (A) primary /finance first-load skeleton ──
check("VisualStatements defines a HeroSkeleton + BodySkeleton", /function HeroSkeleton/.test(vs) && /function BodySkeleton/.test(vs));
check("HeroSkeleton renders when snapshot is null (was blank below controls)", /!snap && !error && <HeroSkeleton/.test(vs));
check("BodySkeleton renders when snapshot is null", /!snap && !error && <BodySkeleton/.test(vs));
check("skeletons are reduced-motion-safe", /motion-reduce:animate-none/.test(vs));
check("stale snapshot still shown on refetch (not replaced by skeleton)", /opacity-60/.test(vs));

// ── (B) instrumentation present + privacy-safe ──
check("emits finance.dashboard.first_card_ms", /finance\.dashboard\.first_card_ms/.test(vs));
check("emits finance.dashboard.full_ready_ms", /finance\.dashboard\.full_ready_ms/.test(vs));
check("emits finance.filter.settled_ms", /finance\.filter\.settled_ms/.test(vs));
check("emits finance.dashboard.error", /finance\.dashboard\.error/.test(vs) && /finance\.dashboard\.error/.test(fd));
check("emits finance.dashboard.request_count", /finance\.dashboard\.request_count/.test(vs) && /finance\.dashboard\.request_count/.test(fd));
// no financial values leaked into metrics: the record()/event() call args must not
// reference balances/revenue/amounts/currency/filters as tags.
const metricCalls = [...vs.matchAll(/\b(record|event)\(([^;]*?)\)/g), ...fd.matchAll(/\b(record|event)\(([^;]*?)\)/g)].map((m) => m[2]);
// Drop the metric NAME (the leading quoted string) — only the DATA args (value +
// tags) can leak, and metric names legitimately contain words like "filter".
const dataArgs = metricCalls.map((a) => a.replace(/^\s*["'][^"']*["']\s*,?/, "").trim());
const FORBIDDEN = /revenue|balance|net_?income|net_?profit|amount|cost|payment|supplier|customer|account_number|currency|period_end|\bfilter\b|kpi\.|snap\.|totalRevenue/i;
check("metric DATA args never carry financial values / filters / ids", dataArgs.every((a) => !FORBIDDEN.test(a)));
check("metric DATA args are numeric durations, not record fields", dataArgs.every((a) => a === "" || !/\b(snap|kpi|orders|payments|expenses|treasury|accounts)\b/.test(a)));

// ── (C) intelligence dashboard guard + timing ──
check("FinanceDashboard has a monotonic stale-response guard (kpiSeq)", /kpiSeq/.test(fd) && /seq === kpiSeq\.current/.test(fd));
check("FinanceDashboard records total_ms on first mount", /finance\.dashboard\.total_ms/.test(fd));

// ── (D) security posture unchanged (endpoints gated + tenant-scoped) ──
const endpoints = [
  "src/app/api/finance/visual-statements/route.ts",
  "src/app/api/finance/dashboard/route.ts",
  "src/app/api/finance/orders/route.ts",
  "src/app/api/finance/payments/route.ts",
  "src/app/api/finance/expenses/route.ts",
  "src/app/api/finance/treasury/route.ts",
  "src/app/api/finance/reconciliation/candidates/route.ts",
  "src/app/api/finance/bank-imports/route.ts",
  "src/app/api/finance/treasury-plans/route.ts",
];
for (const e of endpoints) {
  const src = read(e);
  const name = e.split("/finance/")[1].replace("/route.ts", "");
  check(`endpoint ${name}: requireAuth`, /requireAuth\(\)/.test(src));
  check(`endpoint ${name}: Finance module gate`, /requireModuleAccess\(auth, "Finance"\)/.test(src));
  check(`endpoint ${name}: tenant-scoped`, /auth\.tenant_id/.test(src));
}

// ── (E) dead import removed ──
check("FinanceHome no longer imports the never-rendered AppHomeMenu", !/AppHomeMenu/.test(fh));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
