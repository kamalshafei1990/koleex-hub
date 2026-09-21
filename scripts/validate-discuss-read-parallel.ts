/* validate:discuss-read-parallel — regression lock for the Discuss full-page
   read path (server-query parallelization phase).

   WHAT THIS PINS, and why each lock exists:

   · The three enrichment queries (reactions / reply previews / thread
     aggregation) are INDEPENDENT and must resolve concurrently. Re-introducing
     a sequential `await` is invisible in a code review and invisible in tests —
     it only shows up as latency. So it is pinned here.
   · The conditional skips must survive. "No reply targets → no reply query" is
     a real saving that a naive `Promise.all([a, b, c])` refactor silently
     destroys by always issuing all three.
   · Failure semantics must stay as they ARE (silent partial enrichment), not as
     they arguably SHOULD be. Changing them is a product decision, not a side
     effect of a performance change — so both the current behaviour and the
     absence of a new rejection path are pinned.
   · The `after=` incremental path must stay untouched by this phase.

   This validator reads the SOURCE, not a mock: it is a lock, not a unit test.
   Behavioural equivalence is proven separately by the differential HTTP capture
   against the staging fixture (identical response bodies, sequential vs
   parallel) — a static file cannot prove that and does not pretend to. */

import { readFileSync } from "node:fs";

const ROUTE = "src/app/api/discuss/read/route.ts";
const src = readFileSync(ROUTE, "utf8");

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string) {
  if (cond) passed++;
  else failures.push(msg);
}

/* Comments describe intent; they must never satisfy an assertion. Strip them
   before every grep, or a validator can be "passed" by a promise in prose. */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/* Scope every assertion to the block it is about. A match anywhere in a
   500-line file proves nothing about the branch under test. */
function slice(from: string, to: string): string {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + 1);
  if (a < 0 || b < 0) throw new Error(`cannot slice ${from} → ${to} — route shape changed`);
  return stripComments(src.slice(a, b));
}

const full = slice('const limit = Math.min(Number(url.searchParams.get("limit"))', 'case "thread"');
const incremental = slice('const after = url.searchParams.get("after");', "const limit = Math.min(");

/* ── 1. the three enrichment queries resolve concurrently ────────────────── */
ok(/await Promise\.all\(\[/.test(full), "full page: enrichment must resolve via a single Promise.all");
ok(
  /Promise\.all\(\[\s*timedQuery\(reactionsQuery\),\s*timedQuery\(replyPreviewQuery\),\s*timedQuery\(threadQuery\),?\s*\]\)/.test(full),
  "full page: all THREE named queries must be in the Promise.all (not a subset)",
);

/* The load-bearing one: after the base query, the ONLY await in the full-page
   block is the Promise.all. Any other `await supabaseServer` is a new serial
   round trip — exactly the regression this phase removed. */
const awaitsSupabase = (full.match(/await\s+supabaseServer/g) ?? []).length;
ok(awaitsSupabase === 0, `full page: no direct 'await supabaseServer' — every query goes through the base 'await q' or the Promise.all (found ${awaitsSupabase})`);
/* The full-page block must contain EXACTLY two awaits: the base message query,
   then the single Promise.all. A third await is, by construction, a serial
   round trip — which is the regression this phase exists to prevent. Counting
   them is the only assertion that catches a NEW sequential query; matching on
   Promise.all alone would happily pass a file that also awaited something after
   it. */
const awaits = full.match(/.*\bawait\b.*/g) ?? [];
ok(awaits.length === 2, `full page: exactly TWO awaits — base query + Promise.all — found ${awaits.length}:\n      ${awaits.map((a) => a.trim()).join("\n      ")}`);
ok(/const \{ data \} = await q;/.test(awaits[0] ?? ""), "full page: the first await is the base message query");
ok(/await Promise\.all\(\[/.test(awaits[1] ?? ""), "full page: the second (and last) await is the enrichment Promise.all");

/* ── 2. conditional skips preserved ─────────────────────────────────────── */
ok(
  /const reactionsQuery = messageIds\.length > 0\s*\?/.test(full),
  "full page: reactions query must stay guarded by messageIds.length > 0",
);
ok(
  /const replyPreviewQuery = replyTargetIds\.length > 0\s*\?/.test(full),
  "full page: reply-preview query must stay guarded by replyTargetIds.length > 0 (no reply targets → no query)",
);
ok(
  /const threadQuery = messageIds\.length > 0\s*\?/.test(full),
  "full page: thread query must stay guarded by messageIds.length > 0",
);
/* A guard that yields something other than null would still be awaited. */
ok((full.match(/:\s*null;/g) ?? []).length === 3, "full page: each unmet guard must yield null (an un-issued query), not an empty query");

/* ── 3. failure semantics UNCHANGED (silent partial enrichment) ──────────── */
ok(
  !/\bthrow\b/.test(full),
  "full page: must not introduce a throw — a failed enrichment renders without reactions today, it does not 500",
);
ok(
  !/rxRes\.error|parentRes\.error|childRes\.error|rx\.res\.error/.test(full),
  "full page: enrichment errors are still ignored (pre-existing behaviour); changing that is a separate decision",
);
ok(/\(rxRes\.data \?\? \[\]\)/.test(full), "full page: reactions must still fall back to [] on a failed query");
ok(/\(parentRes\?\.data \?\? \[\]\)/.test(full), "full page: reply previews must still fall back to [] on a failed query");
ok(/\(childRes\?\.data \?\? \[\]\)/.test(full), "full page: thread rows must still fall back to [] on a failed query");
/* Promise.all rejects if any member rejects. supabase-js resolves on a query
   error, so this holds — but a future `.then(r => { throw })` inside timedQuery
   would silently convert partial enrichment into a 500. */
const helper = stripComments(src.slice(src.indexOf("async function timedQuery"), src.indexOf("/** The caller's active channel ids")));
ok(!/throw|reject/.test(helper), "timedQuery must not introduce a rejection path (would turn partial enrichment into a 500)");
ok(/if \(!q\) return \{ res: null, ms: 0 \};/.test(helper), "timedQuery must not await a null (un-issued) query");

/* ── 4. contracts preserved ─────────────────────────────────────────────── */
ok(/\.reverse\(\)/.test(full), "full page: ascending output ordering (.reverse) preserved");
ok(/NextResponse\.json\(\{ ok: true, data: out \}/.test(full), "full page: response envelope { ok, data } unchanged");
ok(/Math\.min\(Number\(url\.searchParams\.get\("limit"\)\) \|\| 80, 200\)/.test(src), "full page: limit default 80 / cap 200 unchanged");
ok(/q\.lt\("created_at", before\)/.test(src), "full page: before= cursor semantics (lt created_at) unchanged");
ok(/serializeDiscussMessageForClient\(/.test(full), "full page: rows still leave through the client-safe serializer");

/* ── 5. instrumentation reports BOTH sum and wall-clock ─────────────────── */
ok(/enrich_sum_ms: enrichSumMs/.test(full), "instrumentation: must report the SUM of individual query durations");
ok(/enrich_ms: enrichMs/.test(full), "instrumentation: must report the enrichment WALL-CLOCK duration");
ok(
  /db_reactions_ms: rx\.ms, db_reply_preview_ms: parent\.ms, db_thread_ms: child\.ms/.test(full),
  "instrumentation: must report each query's individual duration",
);
ok(/queries_issued:/.test(full), "instrumentation: must report how many queries were issued (disambiguates 0ms from skipped)");
ok(/timing\.mark\("scope"\)/.test(src) && /timing\.mark\("base"\)/.test(full) &&
   /timing\.mark\("enrich"\)/.test(full) && /timing\.mark\("serialize"\)/.test(full),
   "instrumentation: scope / base / enrich / serialize stages must all be marked");

/* ── 6. the incremental path is NOT touched by this phase ───────────────── */
ok(!/Promise\.all/.test(incremental), "after= path: must remain a single query — out of scope for this phase");
ok(!/REACTIONS|replyPreview|threadByParent/.test(incremental), "after= path: must remain enrichment-free");
ok(/reactions: \[\], \s*reply_preview: null, \s*thread: null,/.test(incremental.replace(/\s+/g, " ").replace(/, /g, ", ")) ||
   /reactions: \[\]/.test(incremental), "after= path: still returns empty enrichment placeholders");

/* ── 7. the parallelization must not leak into other resources ──────────── */
const members = slice('case "members"', 'case "search"');
ok(!/timing\.mark/.test(members), "case members: untouched by this phase (no stage marks added)");

console.log(`validate:discuss-read-parallel — ${passed} passed, ${failures.length} failed`);
for (const f of failures) console.error(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
