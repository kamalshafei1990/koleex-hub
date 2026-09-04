/* ---------------------------------------------------------------------------
   validate:ai-conversations — search across the caller's own conversations
   (roadmap C2).

   Section 1 drives the pure module with real inputs: what counts as a query,
   how it is escaped, how a snippet is cut, how rows reduce to hits. Section
   2 reads the route and the client, and says so: the database round trip
   and the debounce are not run here.
   --------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import {
  SEARCH_MAX_CHARS,
  SEARCH_MAX_HITS,
  SEARCH_MIN_CHARS,
  SNIPPET_CHARS,
  collectHits,
  likePattern,
  normalizeQuery,
  snippetAround,
} from "../src/lib/server/ai/conversation-search";
import { BUDGETS } from "../src/lib/server/ai/security/rate-limit";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean | (() => boolean)) {
  let ok = false;
  try { ok = typeof cond === "function" ? cond() : cond; } catch (e) { label += ` (threw: ${e instanceof Error ? e.message : String(e)})`; }
  if (ok) { pass++; console.log(`  ✓ ${label}`); } else { failures.push(label); console.log(`  ✗ ${label}`); }
}

console.log("── 1. What a query is ──");
check("a plain word is a query; whitespace is collapsed and trimmed",
  normalizeQuery("  hello   world ") === "hello world" && normalizeQuery("ab") === "ab");
check("nothing, one character, a non-string and a too-long string are not queries",
  normalizeQuery("") === null && normalizeQuery(" a ") === null && normalizeQuery(undefined) === null && normalizeQuery(7) === null &&
  normalizeQuery("x".repeat(SEARCH_MAX_CHARS + 1)) === null && normalizeQuery("x".repeat(SEARCH_MAX_CHARS)) !== null &&
  SEARCH_MIN_CHARS === 2 && SEARCH_MAX_CHARS === 80);
check("the LIKE pattern matches the query literally: %, _ and \\ are escaped and the whole is wrapped",
  likePattern("100%") === "%100\\%%" && likePattern("a_b") === "%a\\_b%" && likePattern("c\\d") === "%c\\\\d%" && likePattern("سعر") === "%سعر%");

console.log("\n── 2. The snippet ──");
{
  const long = "The quoted price for model KX-200 was 1,250 USD per unit, valid until Thursday, and the shipping goes by sea from Ningbo to Alexandria with thirty days on the water.";
  const snip = snippetAround(long, "kx-200");
  check("a long message is cut to one line around the match, case-insensitively, with ellipses where it was cut",
    snip.length <= SNIPPET_CHARS + 2 && snip.toLowerCase().includes("kx-200") && snip.endsWith("…") && !snip.startsWith("…"));
  const tail = snippetAround(long, "Alexandria");
  check("a match near the end opens with an ellipsis and keeps the match",
    tail.startsWith("…") && tail.includes("Alexandria"));
  check("a short message is returned whole, whitespace collapsed",
    snippetAround("  two\n  lines ", "two") === "two lines");
  check("a message without the query falls back to its opening",
    snippetAround(long, "zzz").startsWith("The quoted price") && snippetAround(long, "zzz").endsWith("…"));
}

console.log("\n── 3. Rows to hits ──");
{
  const rows = [
    { conversation_id: "c1", content: "newest in c1 about KX-200" },
    { conversation_id: "c2", content: null },
    { conversation_id: "c1", content: "older in c1 about KX-200" },
    { conversation_id: "c3", content: "   " },
    { conversation_id: "c2", content: "the KX-200 quote" },
    { conversation_id: "", content: "KX-200 orphan" },
  ];
  const hits = collectHits(rows, "KX-200");
  check("one hit per conversation, in row order, snippet from the NEWEST matching row; blank rows and rows without a conversation are skipped",
    hits.length === 2 && hits[0].conversation_id === "c1" && hits[0].snippet === "newest in c1 about KX-200" &&
    hits[1].conversation_id === "c2" && hits[1].snippet === "the KX-200 quote");
  const many = Array.from({ length: 50 }, (_, i) => ({ conversation_id: `c${i}`, content: `row ${i} hit` }));
  check("the hit list is capped", collectHits(many, "hit").length === SEARCH_MAX_HITS && collectHits(many, "hit", 3).length === 3);
}

console.log("\n── 4. The route and the client, read ──");
{
  const route = readFileSync("src/app/api/ai/conversations/search/route.ts", "utf8");
  check("the route opens with the same doors as every conversation read: session, then internal user",
    /const auth = await requireAuth\(\);\s*if \(auth instanceof NextResponse\) return auth;[\s\S]{0,200}?requireInternalUser\(auth\)/.test(route));
  check("the id list is the caller's own tenant + account, and the message match runs INSIDE that list",
    /from\("ai_conversations"\)[\s\S]{0,200}?\.eq\("tenant_id", auth\.tenant_id\)\s*\.eq\("account_id", auth\.account_id\)/.test(route) &&
    /from\("ai_messages"\)[\s\S]{0,200}?\.in\("conversation_id", ids\)[\s\S]{0,120}?\.ilike\("content", likePattern\(query\)\)/.test(route) &&
    /if \(ids\.length === 0\) return NextResponse\.json\(\{ hits: \[\] \}\);/.test(route));
  check("a query that is not worth asking is an empty answer, not an error, and the budget is consumed per account",
    /if \(!query\) return NextResponse\.json\(\{ hits: \[\] \}\);/.test(route) &&
    /consumeBudget\(subjectFor\.account\(auth\.account_id\), BUDGETS\.conversationSearchPerAccount\(\)\)/.test(route) &&
    BUDGETS.conversationSearchPerAccount().bucket === "conv_search" && BUDGETS.conversationSearchPerAccount().max === 30);
  check("logs carry counts, never the query text",
    /console\.log\(`\[ai\.conversations\.search\] ok chars=\$\{query\.length\} rows=/.test(route) && !/console\.\w+\([^)]*\$\{query\}/.test(route));
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("the client asks after a pause, aborts the previous ask, needs two characters, and merges hits into the list it shows",
    /window\.setTimeout\(\(\) => \{\s*fetch\(`\/api\/ai\/conversations\/search\?q=\$\{encodeURIComponent\(q\)\}`, \{ credentials: "include", signal: ctl\.signal \}\)/.test(app) &&
    /if \(q\.length < 2\) \{\s*setContentHits\(\{\}\);\s*return;\s*\}/.test(app) &&
    /window\.clearTimeout\(timer\);\s*ctl\.abort\(\);/.test(app) &&
    /title\.includes\(q\) \|\| preview\.includes\(q\) \|\| c\.id in contentHits/.test(app) &&
    /hint=\{searching \? contentHits\[c\.id\] : undefined\}/.test(app));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: the database round trip and the debounce timing — a real search in the sidebar is the test.");
