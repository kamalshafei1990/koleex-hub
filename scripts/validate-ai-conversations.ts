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
import * as cs from "../src/lib/server/ai/conversation-search";
import * as fold from "../src/lib/text-fold";

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
    /from\("ai_messages"\)[\s\S]{0,200}?\.in\("conversation_id", ids\)[\s\S]{0,120}?\.ilike\("content", foldedLikePattern\(query\)\)/.test(route) &&
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
    /foldForSearch\(c\.title \|\| ""\)\.includes\(q\) \|\| foldForSearch\(c\.last_preview \|\| ""\)\.includes\(q\) \|\| c\.id in contentHits/.test(app) &&
    /hint=\{searching \? contentHits\[c\.id\] : undefined\}/.test(app));
}

/* ── SIDEBAR REVIEW (owner, 2026-09-26: "ابدأ، صلّح من ١ لـ ٩") ─────────── */
{
  console.log("\n── Sidebar review: menu, Arabic search, rename, search box, catch-up, IME, focus, drawer, folder search ──");
  const side = readFileSync("src/components/ai/Sidebar.tsx", "utf8");
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  const inp = readFileSync("src/components/kds/useInput.tsx", "utf8");
  const pd = readFileSync("src/components/ai/ProjectDialog.tsx", "utf8");
  const nd = readFileSync("src/components/notes/NotesDialog.tsx", "utf8");
  const copySrc = readFileSync("src/components/ai/copy.ts", "utf8");

  /* 1 */
  check("the row menu stays open while it scrolls itself; any other scroll or a resize still closes it; Escape closes only the menu",
    /const close = \(e: Event\) => \{\s*if \(e\.target instanceof Node && menuRef\.current\?\.contains\(e\.target\)\) return;\s*setOpen\(false\);\s*\};/.test(side) &&
    /window\.addEventListener\("scroll", close, true\);/.test(side) && /window\.addEventListener\("resize", onResize\);/.test(side) &&
    /e\.preventDefault\(\);\s*e\.stopImmediatePropagation\(\);\s*closeMenu\(\);/.test(side) && /window\.addEventListener\("keydown", onKey, true\);/.test(side));

  /* 2 */
  check("Arabic is searched as it is typed: hamza forms, ta marbuta, alef maqsura and harakat fold on both sides",
    fold.foldedIncludes("الأسعار الجديدة", "اسعار") && fold.foldedIncludes("مدرسة", "مدرسه") && fold.foldedIncludes("مستشفى", "مستشفي") &&
    fold.foldedIncludes("مُحَمَّد", "محمد") && fold.foldedIncludes("مسـؤول", "مسوول") && fold.foldedIncludes("Price LIST", "price list") &&
    !fold.foldedIncludes("سعر", "اسعار") && fold.foldLettersOnly("أسعار").length === "أسعار".length);
  check("  …the server reads with a pattern loose only on those letters, and keeps a row only when it matches folded",
    cs.foldedLikePattern("اسعار") === "%_سع_ر%" && cs.foldedLikePattern("100%") === "%100\\%%" && cs.foldedLikePattern("a_b") === "%a\\_b%" &&
    cs.collectHits([{ conversation_id: "c1", content: "عرض الأسعار الجديد" }, { conversation_id: "c2", content: "إسعاف" }], "اسعار").map((h) => h.conversation_id).join() === "c1" &&
    cs.snippetAround("x ".repeat(80) + "الأسعار هنا " + "y ".repeat(80), "اسعار").includes("الأسعار"));
  check("  …and the sidebar's own filter folds too", /const q = foldForSearch\(sidebarQuery\);/.test(app) && /import \{ foldForSearch \} from "@\/lib\/text-fold";/.test(app));

  /* 3 */
  check("the rename dialog speaks the screen's language, lays a name out by its own script, and refuses a blank name before the server does",
    /cancelLabel\?: string;/.test(inp) && /\{ask\.cancelLabel \?\? "Cancel"\}/.test(inp) && /dir="auto"\s*value=\{value\}/.test(inp) &&
    /cancelLabel: copy\.cancel,\s*validate: \(v\) => \(v\.trim\(\) \? null : copy\.nameRequired\),/.test(app) &&
    (copySrc.match(/\n\s*nameRequired: "/g) ?? []).length === 3);

  /* 4 */
  check("the search box stays while a search is on, whatever the count", /\{\(conversations\.length > 3 \|\| sidebarQuery !== ""\) && \(/.test(app));

  /* 5 */
  check("the list and folders are read again when the app comes back to the front or back online, at most once a minute, and the date groups follow the day",
    /const LIST_REFRESH_MIN_MS = 60_000;/.test(app) &&
    /document\.addEventListener\("visibilitychange", catchUp\);\s*window\.addEventListener\("online", catchUp\);/.test(app) &&
    /if \(now - lastListReadRef\.current < LIST_REFRESH_MIN_MS\) return;[\s\S]{0,80}void loadConversations\(\);\s*void loadProjects\(\);/.test(app) &&
    /return groupByDate\(loose, copy, new Date\(dayKey\)\);\s*\}, \[filteredConversations, searching, copy, dayKey\]\);/.test(app) &&
    /now: Date = new Date\(\),/.test(side));

  /* 6 */
  check("picking a pinyin candidate in the folder name does not save it", /if \(e\.nativeEvent\.isComposing \|\| e\.keyCode === 229\) return;\s*if \(e\.key === "Enter" && canSave\) onSave\(\);/.test(pd));

  /* 7 */
  check("focus is kept around delete and rename: the confirm dialog traps it on Cancel and names the chat; rename gives it back; a deleted row hands it to the sidebar",
    /useFocusTrap\(dialogRef, open, \{ initialFocus: "\[data-confirm-cancel\]" \}\);/.test(nd) && /ref=\{dialogRef\}\s*role="alertdialog"/.test(nd) &&
    (nd.match(/data-confirm-cancel/g) ?? []).length === 2 &&
    /description=\{conversations\.find\(\(c\) => c\.id === pendingDeleteId\)\?\.title \|\| undefined\}/.test(app) &&
    /openerRef\.current = typeof document !== "undefined" && document\.activeElement instanceof HTMLElement \? document\.activeElement : null;/.test(inp) &&
    /if \(el && el\.isConnected\) el\.focus\(\{ preventScroll: true \}\);/.test(inp) &&
    /playSound\("deleted"\);\s*\/\*[\s\S]*?\*\/\s*window\.requestAnimationFrame\(\(\) => \{\s*const a = document\.activeElement;\s*if \(a && a !== document\.body && a\.isConnected\) return;\s*asideRef\.current\?\.querySelector/.test(app));

  /* 8 */
  check("the phone drawer holds focus: the chat and composer behind it are inert, its first control takes focus, closing returns it to the burger, one Escape closes one layer",
    /const drawerModal = isNarrow && sidebarOpen;/.test(app) &&
    (app.match(/inert=\{drawerModal \|\| undefined\}/g) ?? []).length === 2 &&
    /if \(!a \|\| a === document\.body \|\| aside\?\.contains\(a\)\) burger\?\.focus\(\{ preventScroll: true \}\);/.test(app) &&
    /ref=\{burgerRef\}/.test(app) && /aria-expanded=\{sidebarOpen\}/.test(app) &&
    /if \(e\.key === "Escape" && !e\.defaultPrevented\) setSidebarOpen\(false\);/.test(app));

  /* 9 */
  check("a search inside a folder with no match says so, and its rows show the matched words",
    /\{searching \? copy\.noSearchResults : copy\.emptyProject\}/.test(app) &&
    (app.match(/hint=\{searching \? contentHits\[c\.id\] : undefined\}/g) ?? []).length === 2);
}

/* ── A new chat survives a lost answer (owner, 2026-09-26, phone: "couldn't
   start a new chat" six times while six rows were made) ── */
{
  const route = readFileSync("src/app/api/ai/conversations/route.ts", "utf8");
  const helper = readFileSync("src/lib/server/ai/new-conversation.ts", "utf8");
  const agent = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  console.log("\n── A new chat survives a lost answer ──");
  check("a client's id is taken only when it is a UUID, and the row is inserted with it",
    /export const CONVERSATION_ID_RE = \/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i;/.test(helper) &&
    /return typeof value === "string" && CONVERSATION_ID_RE\.test\(value\) \? value\.toLowerCase\(\) : null;/.test(helper) &&
    /\.\.\.\(opts\.id \? \{ id: opts\.id \} : \{\}\),\s*tenant_id: auth\.tenant_id,\s*account_id: auth\.account_id,/.test(helper) &&
    /id: clientConversationId\(body\.id\),/.test(route));
  check("the same id again hands back the caller's own row, and only theirs — anyone else's id is a 409",
    /if \(opts\.id && error\?\.code === "23505"\) \{[\s\S]{0,200}\.eq\("id", opts\.id\)\s*\.eq\("tenant_id", auth\.tenant_id\)\s*\.eq\("account_id", auth\.account_id\)\s*\.maybeSingle\(\);\s*if \(mine\) return \{ ok: true, row: mine \};\s*return \{ ok: false, conflict: true \};/.test(helper) &&
    /if \(made\.conflict\) return NextResponse\.json\(\{ error: "conflict" \}, \{ status: 409 \}\);/.test(route));
  check("the app names the row before the first ask and asks up to three times with the same body; without an id, once",
    /const CREATE_CHAT_TRIES = 3;/.test(app) &&
    /return typeof crypto !== "undefined" && typeof crypto\.randomUUID === "function" \? crypto\.randomUUID\(\) : null;/.test(app) &&
    /const id = opts\.id \?\? newConversationId\(\);/.test(app) &&
    /const tries = id \? CREATE_CHAT_TRIES : 1;/.test(app) &&
    /for \(let attempt = 1; attempt <= tries && !conversation; attempt\+\+\)/.test(app) &&
    /body: payload,/.test(app));
  check("a new chat's first message makes its chat: the app names it, lists it at once and sends no separate create",
    /const named = conversationId \? null : newConversationId\(\);\s*if \(named\) \{\s*pendingNewChatsRef\.current\.add\(named\);/.test(app) &&
    /setConversations\(\(prev\) => \[row, \.\.\.prev\.filter\(\(c\) => c\.id !== named\)\]\);\s*setActiveId\(named\);\s*conversationId = named;\s*turnConversationId = named;/.test(app) &&
    /\.\.\.\(pendingNewChatsRef\.current\.has\(conversationId!\)\s*\? \{ newConversation: true,/.test(app) &&
    /pendingNewChatsRef\.current\.delete\(turnConversationId \?\? ""\);/.test(app));
  check("…a call in a chat not yet confirmed asks for it by the same id first",
    /if \(open && pendingNewChatsRef\.current\.has\(open\)\) return createConversation\(\{ id: open \}\);/.test(app));
  check("…and the server makes it only when asked, with a UUID, by the shared rules — anything else not found is still a 404",
    /if \(!conv && body\.newConversation === true\) \{\s*const newId = clientConversationId\(conversationId\);\s*if \(newId\) \{\s*const made = await insertConversation\(auth, \{ id: newId, projectId: body\.project_id \}\);/.test(agent) &&
    /if \(!conv\) \{\s*return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);/.test(agent));
  check("a refusal (4xx) is final; a lost answer, an unreadable one or a 5xx is asked again",
    /if \(!res\.ok\) \{\s*why = `status:\$\{res\.status\}`;\s*if \(res\.status < 500\) break;\s*continue;\s*\}/.test(app));
  check("every way it fails is counted by how, and the row is listed once",
    /perfEvent\("ai\.chat_create_fail", \{ why: why \|\| "unknown", tries \}\);/.test(app) &&
    /perfEvent\("ai\.chat_create_retry", \{ attempt, why \}\);/.test(app) &&
    /setConversations\(\(prev\) => \[made, \.\.\.prev\.filter\(\(c\) => c\.id !== made\.id\)\]\);/.test(app));
}

{
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("each turn is timed on the phone — headers, first words, end, or failure — tagged with whether it made its chat",
    /turnMark\.t0 = performance\.now\(\);\s*turnMark\.first = pendingNewChatsRef\.current\.has\(conversationId!\);\s*const res = await fetch\(`\/api\/ai\/agent`/.test(app) &&
    /perfRecord\("ai\.turn_headers_ms", performance\.now\(\) - turnMark\.t0, \{ first: turnMark\.first, status: res\.status \}\);\s*const reader = res\.body\.getReader\(\);/.test(app) &&
    /if \(!turnMark\.firstToken\) \{\s*turnMark\.firstToken = true;\s*perfRecord\("ai\.turn_first_token_ms"/.test(app) &&
    /if \(finalMessage\) \{\s*perfRecord\("ai\.turn_total_ms"/.test(app) &&
    /if \(turnMark\.t0\) perfRecord\("ai\.turn_fail_ms", performance\.now\(\) - turnMark\.t0, \{ first: turnMark\.first, why: isNetwork \? "network" : "other" \}\);/.test(app));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: the database round trip and the debounce timing — a real search in the sidebar is the test.");
