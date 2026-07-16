#!/usr/bin/env node
/* validate:crm-perf — Phase 4 Wave 2B.2 CRM performance.
   Deterministic static guards (no DB):
   (A) the deal modal no longer downloads the whole contact directory — the
       picker uses a bounded, debounced, cancellable server search;
   (B) the CRM contact-search endpoint is auth + CRM-gated + tenant-scoped,
       bounded, min-query, and returns only slim picker fields;
   (C) the board uses a slim `view=board` projection (no free-text description)
       and the modal hydrates the full row on open;
   (D) drag rolls back on server failure + emits privacy-safe drag metrics;
   (E) post-mutation reloads are "soft" (board is not blanked);
   (F) the kanban card is memoised;
   (G) crm.* metrics carry ONLY durations/counts — never deal/customer values;
   (H) every CRM endpoint stays auth + CRM-gated + tenant-scoped.
   Run: node --import tsx scripts/validate-crm-perf.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p: string) => path.resolve(__dirname, "..", p);
const read = (p: string) => fs.readFileSync(R(p), "utf8");

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };

const crm = read("src/components/crm/CRM.tsx");
const lib = read("src/lib/crm.ts");
const search = read("src/app/api/crm/contacts/search/route.ts");
const oppsRoute = read("src/app/api/crm/opportunities/route.ts");
const idRoute = read("src/app/api/crm/opportunities/[id]/route.ts");

// ── (A) picker no longer streams the whole directory ──
check("CRM no longer imports fetchContacts (whole-directory download)", !/fetchContacts/.test(crm));
check("picker uses bounded server search (searchCrmContacts)", /searchCrmContacts/.test(crm));
check("picker debounces (setTimeout) keystrokes", /setTimeout\(/.test(crm));
check("picker aborts stale requests (AbortController)", /new AbortController\(\)/.test(crm) && /abortRef\.current\?\.abort\(\)/.test(crm));
check("picker has a monotonic stale-response guard (seqRef)", /seqRef/.test(crm) && /seq !== seqRef\.current/.test(crm));
check("picker is IME-safe (composition handlers)", /onCompositionStart/.test(crm) && /onCompositionEnd/.test(crm));
check("picker keeps a selected contact without a broad fetch (linkedContact)", /linkedContact/.test(crm));

// ── (B) contact-search endpoint: gated, bounded, slim ──
check("search endpoint requireAuth", /requireAuth\(\)/.test(search));
check("search endpoint CRM-gated", /requireModuleAccess\(auth, "CRM"\)/.test(search));
check("search endpoint tenant-scoped", /auth\.tenant_id/.test(search) && /\.eq\("tenant_id", auth\.tenant_id\)/.test(search));
check("search endpoint enforces a minimum query length", /MIN_QUERY/.test(search) && /q\.length < MIN_QUERY/.test(search));
check("search endpoint caps the result count", /Math\.min\(/.test(search) && /limit/.test(search));
// Inspect the actual .select(...) projection (not the surrounding comments,
// which legitimately name the excluded columns).
const searchSelect = (search.match(/\.select\(\s*([\s\S]*?)\)/) ?? ["", ""])[1];
check("search endpoint returns ONLY slim picker fields (no notes/credit/tax/score)", !/notes|credit|tax_id|internal_score|payment_terms/i.test(searchSelect));

// ── searchCrmContacts lib helper is cancellable + min-2 ──
check("searchCrmContacts is cancellable + min-2 gated", /searchCrmContacts/.test(lib) && /needle\.length < 2/.test(lib) && /signal: opts\?\.signal/.test(lib));

// ── (C) board slim projection + modal hydrate ──
check("board route supports a slim view=board projection", /view === "board"/.test(oppsRoute) && /BOARD_COLUMNS/.test(oppsRoute));
check("board projection excludes the free-text description", /BOARD_COLUMNS =/.test(oppsRoute) && !/BOARD_COLUMNS =[^;]*description/.test(oppsRoute));
check("client board load requests view=board", /view: "board"/.test(crm) && /params\.set\("view", "board"\)/.test(lib));
check("[id] route exposes a single-row GET for modal hydrate", /export async function GET/.test(idRoute));
check("fetchOpportunity hydrates via the single-row route", /\/api\/crm\/opportunities\/\$\{id\}/.test(lib));
check("modal hydrates description on open, guarded by descDirty", /descDirty/.test(crm) && /setDescription\(full\.description\)/.test(crm));

// ── (D) drag rollback + instrumentation ──
check("drag rolls back the optimistic move on server failure", /if \(!ok\)/.test(crm) && /crm\.drag\.rollback/.test(crm));
check("drag records drop ack + reconcile timings", /crm\.drag\.drop_ack_ms/.test(crm) && /crm\.drag\.reconcile_ms/.test(crm));
check("drag records board rerender count", /crm\.board\.rerender_count/.test(crm));

// ── (E) soft reload keeps the board on screen ──
check("reload supports a soft (no-blank) mode", /opts\?\.soft/.test(crm) && /if \(!soft\) setLoading\(true\)/.test(crm));
check("modal save uses a soft reload", /reload\(\{ soft: true \}\)/.test(crm));

// ── (F) memoised card ──
check("OpportunityCard is memoised", /const OpportunityCard = memo\(/.test(crm));

// ── (G) instrumentation present + privacy-safe ──
check("emits crm.board.total_ms + request_count", /crm\.board\.total_ms/.test(crm) && /crm\.board\.request_count/.test(crm));
check("emits crm.modal.open_ms", /crm\.modal\.open_ms/.test(crm));
check("emits crm.picker.search_ms + cancelled", /crm\.picker\.search_ms/.test(crm) && /crm\.picker\.cancelled/.test(crm));
check("emits crm.filter.settled_ms", /crm\.filter\.settled_ms/.test(crm));
check("emits crm.mutation.error", /crm\.mutation\.error/.test(crm));
// no deal/customer values leaked into metrics: scan only the DATA args of
// record()/event() (strip the leading metric-name string, which legitimately
// contains words like "filter").
const metricCalls = [...crm.matchAll(/\b(record|event)\(([^;]*?)\)/g)].map((m) => m[2]);
const dataArgs = metricCalls.map((a) => a.replace(/^\s*["'][^"']*["']\s*,?/, "").trim());
const FORBIDDEN = /revenue|company|contact|email|phone|amount|value|title|name|notes|stage_name|\bsearch\b|\bfilter\b/i;
check("metric DATA args never carry deal/customer values or search text", dataArgs.every((a) => !FORBIDDEN.test(a)));
check("metric DATA args are numeric durations/counts only", dataArgs.every((a) => a === "" || !/\b(opp|opps|deal|kpi|contact|customer)\b/.test(a)));

// ── (H) security posture unchanged (all endpoints gated + tenant-scoped) ──
const endpoints = [
  "src/app/api/crm/opportunities/route.ts",
  "src/app/api/crm/opportunities/[id]/route.ts",
  "src/app/api/crm/opportunities/[id]/move/route.ts",
  "src/app/api/crm/stages/route.ts",
  "src/app/api/crm/activities/route.ts",
  "src/app/api/crm/contacts/search/route.ts",
];
for (const e of endpoints) {
  const src = read(e);
  const name = e.split("/crm/")[1].replace("/route.ts", "");
  check(`endpoint ${name}: requireAuth`, /requireAuth\(\)/.test(src));
  check(`endpoint ${name}: CRM module gate`, /requireModuleAccess\(auth, "CRM"\)|requireModuleAction\(auth, "CRM"/.test(src));
  check(`endpoint ${name}: tenant-scoped`, /auth\.tenant_id/.test(src));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
