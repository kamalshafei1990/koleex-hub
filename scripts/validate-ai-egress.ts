#!/usr/bin/env tsx

/* ===========================================================================
   PHASE 1 — Egress-scanner calibration suite (audit Issue 2, P0).

   A scanner that blocks "Cairo weather today" breaks the feature it is meant
   to protect, and a scanner that lets a quotation total through protects
   nothing. Both directions are asserted here, because only testing one is how
   you end up with a scanner nobody trusts (so it gets disabled) or one that
   quietly does nothing.

   MUST-ALLOW cases are taken from the tool's own description — the queries it
   exists to serve.
   ========================================================================== */

import { scanEgress } from "../src/lib/server/ai/security/egress-scanner";

let pass = 0, fail = 0;

/* Queries search_web exists to answer. A false block here is a product bug. */
const MUST_ALLOW = [
  "Cairo weather today",
  "USD to CNY rate",
  "latest news about container shipping",
  "what is the current exchange rate for the yuan",
  "Canton Fair 2026 dates",
  "convert 5000 USD to CNY",
  "port congestion Shanghai",
  "Incoterms 2020 CIF definition",
  "how does a lockstitch machine work",
  "China public holidays 2026",
  "best practices for garment quality control",
  "weather in Guangzhou this week",
];

/* Queries that would put Koleex data on a third party's server. */
const MUST_BLOCK = [
  "Alpha Textiles quotation 250000 USD margin 18%",
  "contact john.smith@alphatextiles.com about the order",
  "customer credit limit 50000 EGP",
  "quotation KL-QU-4471 status",
  "Q-202608-0001 delivery date",
  "XF-A10 supplier cost",
  "call +20 100 123 4567 about the shipment",
  "a3f8c2d1-4b5e-6789-0abc-def012345678 record",
  "our price for the spreading machine is $12,400",
  "供应商 报价 50000 CNY",
];

console.log("\n── MUST ALLOW — a false block here breaks the feature ──");
for (const q of MUST_ALLOW) {
  const v = scanEgress(q);
  if (v.allowed) { pass++; console.log(`  ✓ ${q}${v.warnings.length ? `  [warn: ${v.warnings.join(", ")}]` : ""}`); }
  else { fail++; console.error(`  ✗ FALSE BLOCK: ${q}\n      ↳ ${v.reason}`); }
}

console.log("\n── MUST BLOCK — each of these is a leak ──");
for (const q of MUST_BLOCK) {
  const v = scanEgress(q);
  if (!v.allowed) { pass++; console.log(`  ✓ blocked (${v.matched}) — ${q}`); }
  else { fail++; console.error(`  ✗ LEAKED: ${q}`); }
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log("Known limit: tenant customer/supplier NAMES are not matched yet — that needs a cached per-tenant index (Phase 5). This reduces exposure; it does not eliminate it.\n");
process.exit(fail > 0 ? 1 : 0);
