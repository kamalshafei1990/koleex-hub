#!/usr/bin/env node
/* validate:quotations-perf — Phase 4 Wave 2B.3 Quotations performance.
   Deterministic static guards (no DB):
   (A) the product picker no longer downloads the whole catalog on open —
       it does a bounded, debounced, abortable, stale-guarded server search;
   (B) the catalog-search endpoint stays auth + Quotations-gated and exposes
       NO supplier/cost fields (only a single display price);
   (C) the customer picker is debounced + abortable + stale-guarded;
   (D) privacy-safe quotations.* instrumentation is present and carries ONLY
       durations — never quotation numbers, customers, products, or prices;
   (E) save flow emits ack + error timings.
   Run: node --import tsx scripts/validate-quotations-perf.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p: string) => path.resolve(__dirname, "..", p);
const read = (p: string) => fs.readFileSync(R(p), "utf8");

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };

const pp = read("src/components/quotations/ProductPickerModal.tsx");
const cp = read("src/components/quotations/CustomerPickerModal.tsx");
const cs = read("src/app/api/quotations/catalog-search/route.ts");
const q = read("src/components/quotations/Quotations.tsx");

// ── (A) product picker: bounded server search, no full-catalog download ──
check("product picker no longer fetches the whole catalog (q=&limit=2000)", !/catalog-search\?q=&limit=2000/.test(pp));
check("product picker queries the server with the typed text", /catalog-search\?q=\$\{encodeURIComponent\(q\)\}/.test(pp));
check("product picker uses a small bounded limit", /limit=\$\{q \? 60 : 40\}/.test(pp));
check("product picker debounces keystrokes (setTimeout)", /setTimeout\(/.test(pp));
check("product picker aborts stale requests (AbortController)", /new AbortController\(\)/.test(pp));
check("product picker has a monotonic stale-response guard (seqRef)", /seqRef/.test(pp) && /seq !== seqRef\.current/.test(pp));
check("product picker records quotations.picker.product_ms", /quotations\.picker\.product_ms/.test(pp));

// ── (B) catalog-search endpoint: gated + no supplier/cost fields ──
check("catalog-search requireAuth", /requireAuth\(\)/.test(cs));
check("catalog-search Quotations-gated", /requireModuleAccess\(auth, "Quotations"\)/.test(cs));
check("catalog-search matches SKU server-side", /m\.sku/.test(cs) && /hay = `\$\{modelName\} \$\{m\.sku/.test(cs));
// The PickerRow the route returns must NOT carry supplier/cost/margin fields.
const pickerRowShape = (cs.match(/interface PickerRow \{([\s\S]*?)\}/) ?? ["", ""])[1];
check("catalog-search PickerRow exposes no cost/supplier/margin fields", !/cost|supplier|margin|head_only|complete_set|global_price/i.test(pickerRowShape));

// ── (C) customer picker: debounced + abortable + stale-guarded ──
check("customer picker debounces (setTimeout)", /setTimeout\(/.test(cp));
check("customer picker aborts stale requests (AbortController)", /new AbortController\(\)/.test(cp));
check("customer picker has a monotonic stale-response guard (seqRef)", /seqRef/.test(cp) && /seq !== seqRef\.current/.test(cp));
check("customer picker records quotations.picker.customer_ms", /quotations\.picker\.customer_ms/.test(cp));
check("customer picker uses a bounded limit (not 500)", !/limit=500/.test(cp) && /search-customers\?q=/.test(cp));

// ── (D) instrumentation present + privacy-safe ──
check("editor records first_usable_ms", /quotations\.editor\.first_usable_ms/.test(q));
check("save records ack_ms", /quotations\.save\.ack_ms/.test(q));
check("save records error", /quotations\.save\.error/.test(q));
// Only durations leave the browser: scan the DATA args of record()/event()
// (strip the leading metric-name string, which may contain harmless words).
const files = [q, pp, cp];
const metricCalls = files.flatMap((f) => [...f.matchAll(/\b(record|event)\(([^;]*?)\)/g)].map((m) => m[2]));
const dataArgs = metricCalls.map((a) => a.replace(/^\s*["'][^"']*["']\s*,?/, "").trim());
const FORBIDDEN = /quote_no|quotation|customer|product|model|\bsku\b|price|cost|margin|discount|total|amount|\bqty\b|\bsearch\b/i;
check("metric DATA args never carry quotation/customer/price values", dataArgs.every((a) => !FORBIDDEN.test(a)));
check("metric DATA args are numeric durations only", dataArgs.every((a) => a === "" || !/\b(current|item|items|row|q\b|query|customer|product)\b/.test(a)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
