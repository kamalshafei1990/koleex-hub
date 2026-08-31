/* ---------------------------------------------------------------------------
   validate:voice-tools — the voice tool bridge, end to end except the socket.

   THREE THINGS THIS PROVES, in the order they matter:

     1. THE ALLOW-LIST IS THE BOUNDARY. A voice call may run read-only tools
        and nothing else. Writes are excluded because a call has no
        confirmation step and a spoken "yes" is audio the model transcribed,
        arriving on the same channel as the request.

     2. THE PARSER READS THE PROTOCOL — and says so when it cannot. A wrong
        event name here is SILENCE: the model asks to search, nothing happens,
        and it answers from memory sounding exactly as certain. That failure
        mode is why `unreadable` exists and why it is asserted.

     3. THE BROWSER RUNS NOTHING. It relays a name to a route that decides.

   NOT PROVED HERE: that the vendor emits these exact event names. Its
   realtime documentation is not reachable from this environment. Every event
   the product already depends on is the OpenAI realtime shape and the vendor
   implements that protocol — good evidence, not proof — so the parser accepts
   both documented routes to a call and reports anything else rather than
   dropping it.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import {
  parseToolCallEvent,
  buildToolResultMessages,
  ToolCallNames,
  EV_OUTPUT_ITEM_ADDED,
  EV_FN_ARGS_DONE,
  EV_RESPONSE_DONE,
} from "../src/lib/voice/tool-calls";
import {
  VOICE_TOOL_NAMES,
  VOICE_TOOL_CALLS_PER_SESSION,
  isVoiceTool,
  voiceToolSchemas,
} from "../src/lib/server/ai/voice/tools";
import { listTools, getTool } from "../src/lib/server/ai-agent/tool-registry";
import {
  buildVoiceSessionPayload,
  TAUGHT_INDEX_BUDGET_BYTES,
} from "../src/lib/server/ai/voice/session-config";
import { capQuestionsToBudget } from "../src/lib/server/ai-knowledge";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean | (() => boolean)) {
  let ok: boolean;
  try {
    ok = typeof cond === "function" ? cond() : cond;
  } catch (e) {
    ok = false;
    label = `${label} — threw: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.log(`  ✗ ${label}`); }
}

const ev = (o: unknown) => JSON.stringify(o);

console.log("\n── 1. The allow-list is the security boundary ──");
{
  check("voice offers at least one tool, or this feature does nothing",
    VOICE_TOOL_NAMES.length >= 1);
  check("search_web is on it — the reason the bridge exists",
    isVoiceTool("search_web"));

  /* EVERY NAME MUST BE READ-ONLY. Checked against the REGISTRY rather than a
     hand-written list of bad names: a new write tool added tomorrow with a
     name nobody predicted is exactly the one that would slip through. */
  const WRITE_PREFIX = /^(create|update|delete|complete|reassign|remember|forget|suggest|audit|calculate)/i;
  const writes = VOICE_TOOL_NAMES.filter((n) => WRITE_PREFIX.test(n));
  check(
    writes.length === 0
      ? "no tool on the voice list is a write — a call has no confirmation step"
      : `WRITE TOOLS ON THE VOICE LIST: ${writes.join(", ")}`,
    writes.length === 0,
  );

  /* And the ones deliberately excluded stay excluded, by name, because each
     was a decision rather than an oversight. */
  for (const denied of [
    "createQuotationDraft", "createTodo", "updateTodo", "deleteTodo",
    "createCalendarEvent", "remember_about_user", "forget_about_user",
    "getCustomerByName", "getInventoryStatus", "getPricingRules",
  ]) {
    check(`  …and ${denied} is not reachable from a call`, !isVoiceTool(denied));
  }

  /* Non-vacuity: those names must be REAL tools, or this asserts nothing. */
  check("the excluded names are real registered tools, not typos",
    ["createQuotationDraft", "createTodo", "getInventoryStatus"].every((n) => getTool(n) !== undefined));

  check("nothing outside the list is allowed, including a plausible invention",
    !isVoiceTool("search_everything") && !isVoiceTool("") && !isVoiceTool("SEARCH_WEB"));

  /* THE LOOP GUARD. "No uncontrolled agent loops" has to be true here too. */
  check("a session has a finite tool budget",
    VOICE_TOOL_CALLS_PER_SESSION > 0 && VOICE_TOOL_CALLS_PER_SESSION <= 50);
}

console.log("\n── 2. The schemas the server publishes ──");
{
  const schemas = voiceToolSchemas();
  check("one schema per allowed name", schemas.length === VOICE_TOOL_NAMES.length);
  check("each carries a name, a description and parameters",
    schemas.every((s) => s.type === "function" && s.name.length > 0 &&
      s.description.length > 20 && s.parameters !== undefined));

  /* BUILT FROM THE REGISTRY, NOT RETYPED. A description that drifts between
     the text lane and voice is a tool the model uses differently depending on
     how the user reached it. */
  const registry = new Map(listTools().map((t) => [t.name, t]));
  check("every schema matches the registry's own text, character for character",
    schemas.every((s) => s.description === registry.get(s.name)?.description));
  check("and its parameters are the registry's, not a copy",
    schemas.every((s) => JSON.stringify(s.parameters) === JSON.stringify(registry.get(s.name)?.parameters)));

  /* A name on the list that no longer exists must be dropped, never invented:
     advertising a tool that cannot run leaves the model calling into nothing. */
  check("a schema is only published for a tool that actually exists",
    schemas.every((s) => registry.has(s.name)));

  /* The session must actually carry them, or none of this reaches the model. */
  const payload = buildVoiceSessionPayload(null);
  const session = payload.full.session as { tools?: Array<{ name: string }>; tool_choice?: string };
  check("the voice session declares the tools", Array.isArray(session.tools) && session.tools.length > 0);
  check("named exactly as the allow-list",
    JSON.stringify((session.tools ?? []).map((t) => t.name)) === JSON.stringify([...VOICE_TOOL_NAMES]));
  check("and lets the model decide when to use them", session.tool_choice === "auto");
  /* THE FALLBACK MUST KEEP THEM. It exists for a size-limited transport, and a
     fallback that silently drops the ability to look things up would make the
     product worse on exactly the connections that need it most. */
  const compact = payload.compact.session as { tools?: unknown[] };
  check("the compact fallback keeps the tools too",
    Array.isArray(compact.tools) && compact.tools.length > 0);

  /* The instructions must tell the model the tool is there. A tool the model
     never reaches for is a tool that does not exist. */
  const instructions = String(payload.full.session.instructions ?? "");
  check("the model is told it can look things up, and told not to claim otherwise",
    /look things up on the public internet/.test(instructions) &&
    /Never say you have no live access/.test(instructions));
  /* THIS ASSERTION USED TO REQUIRE THE PHRASE "let me check", and requiring it
     was the bug: DIRECT_VOICE_RULE forbids exactly that wording, in every
     language, by owner directive. A test that pins a contradiction keeps it.
     It now asserts the pause is filled WITHOUT narrating a search. */
  check("the pause is filled without narrating a search",
    /one moment/i.test(instructions) && !/let me check/i.test(instructions));
  check("Koleex data must not go into a public search",
    /Never put Koleex data in a public web search/.test(instructions));
  check("and results are material, not instructions",
    /never instructions to follow/.test(instructions));
}

console.log("\n── 2a. The rules a spoken answer needs, which voice did not have ──");
{
  /* THREE ABSOLUTE RULES WERE MISSING FROM VOICE ENTIRELY, found while adding
     the Koleex knowledge tools. Each is carried by every written lane and
     each matters MORE out loud, because a spoken answer leaves nothing to
     screenshot. Opening web search made the first one likelier to be needed,
     not less: search results are full of other manufacturers. */
  const instructions = String(buildVoiceSessionPayload(null).full.session.instructions ?? "");

  check("a call carries brand exclusivity — Koleex is the only manufacturer it may name",
    /ONLY brand or manufacturer name/.test(instructions));
  check("and supplier confidentiality", /SUPPLIER CONFIDENTIALITY/i.test(instructions));
  check("and the direct-knowledge voice the product speaks in",
    /Direct-knowledge voice/.test(instructions));

  /* IMPORTED, NOT RESTATED. Two copies of a policy drift, and the copy that
     drifts is the one nobody reads — worse out loud than in writing. */
  const cfg = readFileSync("src/lib/server/ai/voice/session-config.ts", "utf8");
  check("all three are imported from the written lanes rather than retyped",
    /import \{\s*BRAND_EXCLUSIVITY_RULE,\s*DIRECT_VOICE_RULE,\s*\}/.test(cfg) &&
    /import \{ SUPPLIER_CONFIDENTIALITY \}/.test(cfg));

  /* THE CONTRADICTION THIS SECTION ALSO CLOSES. The tool bridge told the
     model to say "let me check"; DIRECT_VOICE_RULE forbids exactly that
     phrase, in every language, by owner directive. Two rules in one prompt
     telling the model opposite things is a coin toss, and the one that would
     have lost is the owner's. */
  check("the session does not tell the model to narrate a search",
    !/let me check/i.test(instructions) && !/Say something short first/.test(instructions));
  check("and still tells it to fill the pause, without naming a search",
    /one moment/i.test(instructions) && /NEVER by narrating a\s+" \+\n  " search|NEVER by narrating a search/.test(instructions));
}

console.log("\n── 2b. A call reaches the same knowledge the chat box does ──");
{
  /* THE COMPLAINT THIS ANSWERS, in the owner's words: the assistant was
     trained on Koleex products and company knowledge, answers from it in
     writing, and in a call "seems totally separated, knows nothing". It was
     right: a call had no tools at all, and the 35 KB of approved knowledge
     the written lanes load cannot be inlined into a session configured once
     before anyone speaks. */
  for (const name of ["search_knowledge", "searchMachineKnowledge", "searchCatalog",
                      "searchProducts", "getProductByCode", "getProductDetails"]) {
    check(`a call can reach ${name}`, isVoiceTool(name));
  }
  const instructions = String(buildVoiceSessionPayload(null).full.session.instructions ?? "");
  /* Both halves: that it HAS the knowledge, and that it must reach for it
     first. Asserting only the second passed when the first was deleted. */
  check("and is told it has that knowledge",
    /WHAT YOU KNOW ABOUT KOLEEX/.test(instructions) &&
    /approved knowledge, its product catalogue and its machine/.test(instructions));
  check("and to consult it BEFORE answering from memory",
    /BEFORE answering from memory/.test(instructions) &&
    /the wrong answer, however confident it sounds/.test(instructions));
  /* "Taizhou" WAS THE WHOLE CHECK, and the one-line floor contains it too —
     so swapping the full company answer back for the floor passed. The facts
     asserted now are ones only the full answer carries. */
  check("with the full company answer inline, because a session cannot load 35 KB",
    /Taizhou/.test(instructions) && /Hangzhou/.test(instructions) &&
    /1955/.test(instructions) && /BOTH A MANUFACTURER AND A TRADER/.test(instructions));

  /* AND THE COMMERCIAL READS STAY OUT. Spoken numbers cannot be checked
     against a source by the person hearing them. */
  for (const denied of ["getPricingRules", "calculateQuotationPricing", "getInventoryStatus",
                        "getCustomerByName", "getCustomerByCode"]) {
    check(`  …but not ${denied}`, !isVoiceTool(denied));
  }

  /* THE COMPACT FALLBACK KEEPS THE TWO THAT MATTER MOST. Nine schemas are
     5.4 KB; a fallback that carried them all would not be a fallback. */
  const payload = buildVoiceSessionPayload(null);
  const compactTools = ((payload.compact.session as { tools?: Array<{ name: string }> }).tools ?? [])
    .map((t) => t.name);
  check("the compact session keeps Koleex knowledge and the web",
    compactTools.includes("search_knowledge") && compactTools.includes("search_web"));
  /* SMALLER IS NOT ENOUGH ON ITS OWN. The compact instructions are far
     shorter than the full ones, so the payload passed a size ratio even when
     the compact session carried all nine schemas — which is the one thing
     that made it stop being a fallback. The count is what actually says it. */
  const fullTools = ((payload.full.session as { tools?: unknown[] }).tools ?? []).length;
  check("it carries FEWER tools than the full session, not the same nine",
    compactTools.length < fullTools);
  check("and is genuinely smaller for it",
    JSON.stringify(payload.compact).length < JSON.stringify(payload.full).length * 0.4);
  /* Non-vacuity: a compact that dropped every tool would pass both above. */
  check("without dropping tools altogether", compactTools.length >= 2);
}

console.log("\n── 2d. What the owner teaches, a call learns too ──");
{
  /* THE OWNER'S REQUEST, and the gap behind it: he teaches Koleex AI an
     answer, the chat box uses it, and a call does not. The chat box inlines
     every taught pair into its system prompt and lets the model match on
     MEANING. A call cannot — its configuration is one event sent before
     anyone has spoken, and the taught corpus grows every time he teaches
     something. So a call reaches taught answers through the search tool, and
     the index below is what makes the model reach for it across languages. */

  /* ── The budget, run rather than read ──────────────────────────────────
     This is the half where a mistake would actually live. */
  const budget = capQuestionsToBudget(["aaaa", "bbbb", "cccc"], 7 + 7);
  check("the index takes questions until the budget is spent",
    budget.length === 2 && budget[0] === "aaaa" && budget[1] === "bbbb");
  check("and drops the tail, not the head — newest taught is kept",
    !budget.includes("cccc"));
  /* PREFIX, NOT BEST-FIT, and the case above could not tell the two apart —
     every question there was the same size, so `break` and `continue` gave
     the identical answer. This one separates them: the newest question does
     not fit and an older, shorter one would. Stopping is the right answer.
     The index is "the questions most recently taught", which stays stable as
     the owner teaches more; a greedy fit would reshuffle which questions
     appear every time he adds one, for the sake of a line that is findable
     by search anyway. */
  check("and it stops at the first question that will not fit, rather than picking over the rest",
    capQuestionsToBudget(["aaaaaaaaaa", "bb"], 6).length === 0);

  /* BYTES, NOT CHARACTERS, and this is the assertion that says so. Six Arabic
     characters are twelve bytes; a `.length` implementation would fit both of
     these in a 14-byte budget and the block would ship at double its size.
     The owner teaches in Arabic — this is his case, not an edge one. */
  const ARABIC_BUDGET = 16;
  const arabic = capQuestionsToBudget(["سياسة", "الشحن"], ARABIC_BUDGET);
  check("and it measures BYTES, so an Arabic index is not silently double-size",
    arabic.length === 1);
  /* THE COUNTERFACTUAL, or the check above is just "one fits in sixteen".
     Each question costs its size plus a three-byte separator. Counted in
     CHARACTERS both fit exactly; counted in BYTES the first alone spends
     thirteen and the second cannot follow. The budget is chosen to sit
     between those two answers, so only a byte-counting implementation
     passes. */
  const charCost = ("سياسة".length + 3) + ("الشحن".length + 3);
  const byteCost = (Buffer.byteLength("سياسة") + 3) + (Buffer.byteLength("الشحن") + 3);
  check("  …where the same budget counted in characters would have fitted both",
    charCost <= ARABIC_BUDGET && byteCost > ARABIC_BUDGET);

  check("a budget too small for even one question yields an empty index, not a broken one",
    capQuestionsToBudget(["a question"], 3).length === 0);
  check("blank questions are skipped rather than costing budget",
    capQuestionsToBudget(["", "   ", "real"], 20).join("") === "real");

  /* ── What the session actually carries ─────────────────────────────────*/
  const taught = ["What is our return policy?", "How long is the warranty?"];
  const withIndex = buildVoiceSessionPayload(null, taught);
  const instr = String(withIndex.full.session.instructions ?? "");
  check("a taught question reaches the call's instructions",
    instr.includes("What is our return policy?") && instr.includes("How long is the warranty?"));
  /* THE POINT OF SHIPPING THE QUESTIONS AT ALL. Without this line the model
     has a list and no reason to act on it, and the whole thing is decoration:
     it must know the answer exists and that looking it up beats remembering. */
  check("and is told to look the answer up rather than answer from memory",
    /WHAT THE OWNER HAS TAUGHT YOU/.test(instr) &&
    /in ANY language, however they word it/.test(instr) &&
    /Never answer one of\s+these from general memory/.test(instr));
  /* The list is a hint, not a manifest — a question dropped by the budget is
     still findable, and the model must not conclude the list is everything. */
  check("and that the list is not everything it has been taught",
    /This list is not everything you have been taught/.test(instr));

  /* THE ANSWERS STAY OUT. They are the large, unbounded half and the tool
     already returns them; putting them here is how this becomes the payload
     that does not fit. */
  check("the ANSWERS never travel in the session — only the questions",
    !instr.includes("A1:") && !/TAUGHT KNOWLEDGE \(owner-approved reference answers/.test(instr));

  /* THE COMPACT SESSION IS THE SIZE FALLBACK. Adding to it would be answering
     a size problem by making the fallback bigger. */
  const compactInstr = String(withIndex.compact.session.instructions ?? "");
  check("and the compact fallback carries none of it",
    !compactInstr.includes("What is our return policy?") &&
    !/WHAT THE OWNER HAS TAUGHT YOU/.test(compactInstr));

  /* NON-VACUITY. Every check above would also pass if the block were never
     built at all, so: nothing taught must cost nothing. */
  const none = String(buildVoiceSessionPayload(null, []).full.session.instructions ?? "");
  check("a deployment with nothing taught pays nothing for the feature",
    !/WHAT THE OWNER HAS TAUGHT YOU/.test(none) &&
    none.length < instr.length);

  /* AND THE BUDGET IS REAL AT THE CALL SITE. A generous constant here is a
     session that quietly grows past the channel limit and falls back to the
     compact one — losing the catalogue tools to gain an index. */
  check("the shipped budget is bounded, not unbounded",
    TAUGHT_INDEX_BUDGET_BYTES > 0 && TAUGHT_INDEX_BUDGET_BYTES <= 1200);

  /* ── The tool the call reaches them through ────────────────────────────*/
  const ks = readFileSync("src/lib/server/ai-agent/tools/knowledge-search.ts", "utf8");
  check("search_knowledge searches taught answers as well as the corpus",
    /searchTaughtAnswers\(tenantId, q, 3\)/.test(ks) &&
    /searchApprovedUnits\(tenantId, q, 6\)/.test(ks));
  check("and both reads are scoped to the caller's tenant",
    /const tenantId = ctx\.auth\.tenant_id \?\? null;/.test(ks) &&
    !/searchTaughtAnswers\(null/.test(ks));
  /* A TAUGHT ANSWER IS NOT AN EXCERPT. Told to cite it, the model says
     "according to unknown source" — the taught unit's source is the owner. */
  check("a taught answer is handed over as a reference reply, not as evidence to cite",
    /Do NOT cite a source for these/.test(ks) &&
    /LEARN from them, don't recite them/.test(ks) &&
    /stays EXACTLY as taught/.test(ks));
  check("and it outranks the document corpus when both match",
    /these outrank everything else here/.test(ks) &&
    ks.indexOf("TAUGHT ANSWER(S)") < ks.indexOf("approved knowledge unit(s). Ground your answer"));
  check("the two planes stay separable in the result, not flattened into one list",
    /data: \{ taught, hits \}/.test(ks));

  /* ── Teaching something must not wait out a cache ──────────────────────
     The owner teaches, hears the chat box use it, and hears a call not — for
     a minute, which is long enough to be reported as broken. Both planes,
     on every path that changes what the AI treats as true. */
  for (const [label, file] of [
    ["taught Q&A", "src/app/api/ai/knowledge/qa/route.ts"],
    ["a single unit", "src/app/api/ai/knowledge/units/[id]/route.ts"],
    ["a whole source", "src/app/api/ai/knowledge/sources/[id]/route.ts"],
  ] as const) {
    const r = readFileSync(file, "utf8");
    /* COUNTED, NOT MERELY PRESENT. The Q&A route has two write paths — teach
       and retire — and asserting the call appears "somewhere in the file"
       passed with it deleted from one of them. The invariant is that the two
       invalidations travel TOGETHER: wherever one fires, so does the other,
       or a lane goes stale while the owner watches another lane update. */
    const taughtCalls = (r.match(/invalidateTaughtAnswersCache\(/g) ?? []).length;
    const searchCalls = (r.match(/invalidateApprovedSearchCache\(/g) ?? []).length;
    check(`approving ${label} drops BOTH caches, not just the prompt block`,
      taughtCalls > 0 && searchCalls === taughtCalls);
  }
}

console.log("\n── 2c. A failed handshake says how long it took ──");
{
  /* "The voice service is not responding" is the route's 504, and it fires
     for two faults that need opposite investigations: a handshake that dies
     in 40ms is DNS, egress or a refused connection; one that runs the full
     budget is a service that is up and slow. The log named the branch and
     never the elapsed time, so neither could be told apart from a report
     that it stopped working. */
  const route = readFileSync("src/app/api/ai/voice/session/route.ts", "utf8");
  check("the failure log records how long the handshake ran",
    /afterMs=\$\{Date\.now\(\) - startedAt\}/.test(route));
  check("and the budget it ran against, so the two can be compared",
    /budgetMs=\$\{HANDSHAKE_TIMEOUT_MS\}/.test(route));
  check("and still distinguishes a timeout from a connection that failed",
    /timedOut \? "timed out" : "failed"/.test(route));

  /* TWO ATTEMPTS, AND THE ARITHMETIC THAT MAKES THEM SAFE. The production
     logs showed "handshake timed out" repeatedly while our own auth work in
     the same request finished in 121ms — nothing came back at all. A path
     that drops and recovers is answered by a second fresh connection, not by
     waiting longer on a dead one. */
  const budget = Number((/const HANDSHAKE_TIMEOUT_MS = ([\d_]+)/.exec(route)?.[1] ?? "0").replace(/_/g, ""));
  const attempts = Number((/const HANDSHAKE_ATTEMPTS = (\d+)/.exec(route)?.[1] ?? "0"));
  const ceiling = Number((/export const maxDuration = (\d+)/.exec(route)?.[1] ?? "0"));

  check(`the handshake retries a dropped connection (${attempts} attempts)`,
    attempts >= 2 && attempts <= 3);
  check(`each attempt is long enough for a Tokyo-to-Beijing round trip (${budget}ms)`,
    budget >= 10_000);
  /* THE WHOLE BUDGET MUST FIT, not just one attempt. Two 13s attempts inside
     a 30s ceiling would leave three seconds for auth, permissions and the
     platform — and the function would be killed mid-retry, which reads to the
     caller as the same failure it is trying to survive. */
  check(`and all ${attempts} fit inside the function ceiling with room for the rest (${ceiling}s)`,
    ceiling * 1000 - budget * attempts >= 10_000);

  /* A FRESH SIGNAL PER ATTEMPT, or the retry proves nothing: one
     AbortSignal.timeout made outside the loop fires on wall-clock time from
     when it was created, so the second attempt would abort the instant it
     began and look like an instant failure. */
  check("each attempt gets its own timeout signal",
    /for \(let attempt = 1[\s\S]{0,900}?signal: AbortSignal\.timeout\(HANDSHAKE_TIMEOUT_MS\)/.test(route));
  check("and the attempt number is logged, so a drop can be told from slowness",
    /attempt=\$\{attempt\}\/\$\{HANDSHAKE_ATTEMPTS\}/.test(route));
  /* A successful attempt must stop the loop, or every call pays for two. */
  check("a successful attempt stops retrying",
    /res = await fetch\(cfg\.sdpUrl[\s\S]{0,700}?\n      break;/.test(route));
}

console.log("\n── 3. Reading the protocol ──");
{
  /* THE TWO HALVES ARRIVE APART: the name on one event, the arguments on
     another. A parser that only read the second produces a NAMELESS call —
     and a nameless call cannot be checked against an allow-list, which is the
     one check that must never be skippable. */
  const names = new ToolCallNames();
  const added = parseToolCallEvent(ev({
    type: EV_OUTPUT_ITEM_ADDED,
    item: { type: "function_call", call_id: "c1", name: "search_web" },
  }), names);
  check("the name half yields no call on its own", added.call === null && added.unreadable === null);
  check("  …but is remembered", names.nameFor("c1") === "search_web");

  const done = parseToolCallEvent(ev({
    type: EV_FN_ARGS_DONE, call_id: "c1", arguments: '{"query":"cairo weather today"}',
  }), names);
  check("the arguments half completes the call",
    done.call?.callId === "c1" && done.call?.name === "search_web" &&
    done.call?.argumentsJson === '{"query":"cairo weather today"}');

  /* The fallback route: a server that never streams arguments. */
  const viaDone = parseToolCallEvent(ev({
    type: EV_RESPONSE_DONE,
    response: { output: [{ type: "function_call", call_id: "c2", name: "search_web", arguments: '{"query":"x"}' }] },
  }), new ToolCallNames());
  check("a call carried on response.done is read too",
    viaDone.call?.callId === "c2" && viaDone.call?.name === "search_web");

  /* Arguments on the added event, for a server that does not stream at all. */
  const inline = parseToolCallEvent(ev({
    type: EV_OUTPUT_ITEM_ADDED,
    item: { type: "function_call", call_id: "c3", name: "search_web", arguments: '{"query":"y"}' },
  }), new ToolCallNames());
  check("a call complete on the first event is read immediately", inline.call?.callId === "c3");

  /* THE FIELD THIS SECTION EXISTS FOR. If the vendor's names differ, the
     failure without this is silence — the model asks, nothing happens, and it
     answers from memory sounding just as sure. */
  const odd = parseToolCallEvent(ev({ type: "response.tool_call.completed", call_id: "c9" }), new ToolCallNames());
  check("an unrecognised function-call event is REPORTED, not dropped",
    odd.call === null && odd.unreadable === "response.tool_call.completed");
  const nameless = parseToolCallEvent(ev({ type: EV_FN_ARGS_DONE, call_id: "zz", arguments: "{}" }), new ToolCallNames());
  check("a call whose name was never seen is reported rather than run",
    nameless.call === null && nameless.unreadable !== null);

  /* The delta stream is expected and must NOT be reported: it fires many
     times per call and would drown the signal it is meant to raise. */
  const delta = parseToolCallEvent(ev({
    type: "response.function_call_arguments.delta", call_id: "c1", delta: '{"que',
  }), names);
  check("the argument delta stream is quiet", delta.call === null && delta.unreadable === null);

  /* Ordinary events must stay silent, or every transcript delta becomes a
     false alarm. */
  for (const t of ["response.audio_transcript.delta", "session.created",
                   "input_audio_buffer.speech_started", "response.done"]) {
    const r = parseToolCallEvent(ev({ type: t }), new ToolCallNames());
    check(`  …and so is ${t}`, r.call === null && r.unreadable === null);
  }

  /* Garbage off a socket must not throw: this runs on every message. */
  for (const junk of ["", "not json", "[]", "null", '{"no":"type"}', '{"type":123}']) {
    const r = parseToolCallEvent(junk, new ToolCallNames());
    check(`malformed input is survived: ${JSON.stringify(junk).slice(0, 18)}`,
      r.call === null && r.unreadable === null);
  }

  /* Housekeeping: a call finished with is forgotten, or the map grows for the
     life of the call. */
  const keep = new ToolCallNames();
  keep.remember("a", "search_web");
  keep.forget("a");
  check("a finished call is forgotten", keep.size === 0 && keep.nameFor("a") === "");
}

console.log("\n── 4. Handing the answer back ──");
{
  const msgs = buildToolResultMessages("c1", { ok: true, data: { answer: 42 } });
  check("two messages, in order", msgs.length === 2);
  const first = JSON.parse(msgs[0]) as { type: string; item: { type: string; call_id: string; output: string } };
  const second = JSON.parse(msgs[1]) as { type: string };
  check("the first carries the output against its call_id",
    first.type === "conversation.item.create" &&
    first.item.type === "function_call_output" && first.item.call_id === "c1");
  check("the second asks the model to carry on speaking — without it the call goes quiet",
    second.type === "response.create");

  /* `output` is a STRING in this protocol. An object passed straight through
     would reach the far side as "[object Object]" and the model would answer
     from nothing while sounding informed. */
  check("an object output is serialised, not stringified by accident",
    typeof first.item.output === "string" && first.item.output.includes('"answer":42'));
  const asString = JSON.parse(buildToolResultMessages("c2", "plain")[0]) as { item: { output: string } };
  check("a string output is passed through unchanged", asString.item.output === "plain");
}

console.log("\n── 5. The browser is a courier, not an authority (source read) ──");
{
  /* SAID PLAINLY: these are source assertions. The relay needs a DataChannel
     and a browser; what can be checked here is that the code does not do the
     thing it must never do. */
  const client = readFileSync("src/lib/voice/session.ts", "utf8");

  check("the client relays to OUR route and nowhere else",
    /TOOL_PATH = "\/api\/ai\/voice\/tool"/.test(client) &&
    /this\.deps\.fetchFn\(TOOL_PATH/.test(client));
  check("it sends the session cookie, so the server can identify the caller",
    /credentials: "include"/.test(client));

  /* THE ONE THING THIS FILE MUST NEVER CONTAIN. If the page could reach a
     search provider itself, every permission check and every audit row would
     be optional. */
  check("the client calls no external service of its own",
    !/https?:\/\//.test(client.replace(/\/\*[\s\S]*?\*\//g, "")));

  const route = readFileSync("src/app/api/ai/voice/tool/route.ts", "utf8");
  check("the route checks the allow-list before dispatching anything",
    route.indexOf("isVoiceTool(name)") < route.indexOf("dispatchTool("));
  check("and refuses an off-list name outright",
    /if \(!isVoiceTool\(name\)\) \{[\s\S]{0,400}?status: 403/.test(route));
  check("the route runs the same door as the call itself",
    /requireAuth\(/.test(route) && /requireInternalUser\(/.test(route) &&
    /checkModule\(ctx, "AI Voice", "view"\)/.test(route));
  check("permissions and audit come from dispatchTool, not from this route",
    /dispatchTool\(ctx, name, args\)/.test(route));
  check("and it has its own budget, which survives a tampered page",
    /consumeBudget\(/.test(route) && /bucket: "voice_tool"/.test(route));
  /* A refusal must still reach the model as an answer, or the call hangs on a
     question nobody will ever respond to. */
  check("a tool refusal returns 200 with the refusal as the output",
    /Status 200 even when the tool refused/.test(route));
  check("the route forwards no vendor or provider internals",
    !/deepseek|groq|openai|qwen|dashscope|gemini|anthropic/i.test(route));

  /* The loop guard, both halves. */
  check("the client caps calls per session", /MAX_TOOL_CALLS_PER_SESSION = \d+/.test(client));
  check("and answers the model when the cap is hit rather than going silent",
    /as many lookups as one call can make/.test(client));
  check("a repeated call_id does not run the tool twice",
    /answeredCalls\.has\(call\.callId\)/.test(client));
  check("an unreadable event is surfaced rather than swallowed",
    /onToolProtocolMismatch\?\.\(parsed\.unreadable\)/.test(client));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: that the vendor emits these event names, or a real DataChannel round trip.");
