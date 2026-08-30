/* ---------------------------------------------------------------------------
   validate:ai-core-boundaries — Phase 2A gate.

   Phase 2 moves the AI core out of orchestrator.ts. Motion is only safe if
   two things stay true, and neither is visible to the type checker:

     1. PURITY — core/decide-turn.ts and core/canned-replies.ts decide things
        and nothing else. The moment one of them reaches for Supabase, env, or
        a UserContext it stops being testable in plain Node, and the lane
        decision goes back to being untestable.

     2. SINGLE HOME — the detectors and the canned answers must exist ONCE.
        They previously existed two and three times respectively, under a
        comment asking a human to keep the copies in sync. Deleting the copies
        is worth nothing if the next feature adds a fourth.

   Unlike the other suites in this repo, this one is not only static analysis:
   both modules are import-free, so it imports them and asserts on real return
   values. A grep proves a regex is present; calling it proves it still works.
   --------------------------------------------------------------------------- */

import { readFileSync, readdirSync } from "node:fs";
import {
  tryFastReply,
  isSmallTalk,
  classifyBrandSection,
  isBusinessDataQuery,
  isWorkDataQuery,
  isLiveInfoQuery,
  isMemoryIntentQuery,
  isTradeTermQuestion,
  isChoiceShapedQuestion,
} from "../src/lib/server/ai/core/decide-turn";
import { tryCannedReply } from "../src/lib/server/ai/core/canned-replies";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}

const DECIDE = "src/lib/server/ai/core/decide-turn.ts";
const CANNED = "src/lib/server/ai/core/canned-replies.ts";
const ORCH = "src/lib/server/ai-agent/orchestrator.ts";
const AGENT_ROUTE = "src/app/api/ai/agent/route.ts";
const CHAT_ROUTE = "src/app/api/ai/chat/route.ts";
const TRANSPORT = "src/lib/server/ai/core/transport.ts";
const read = (p: string) => readFileSync(p, "utf8");

const decide = read(DECIDE);
const canned = read(CANNED);
const orch = read(ORCH);
const agentRoute = read(AGENT_ROUTE);
const chatRoute = read(CHAT_ROUTE);
const transport = read(TRANSPORT);

/* Strip comments so a prose mention of "supabase" in a header can never be
   mistaken for an import. Every purity check below runs on stripped code —
   this is the lesson from the audit-Issue-2 false positive, where /redact/i
   matched the word "requiredAction" and reported an open issue as fixed. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const decideCode = stripComments(decide);
const cannedCode = stripComments(canned);

console.log("\n── 1. Purity of the decision layer ──");
check(
  "decide-turn.ts has ZERO import statements",
  !/^\s*import\s/m.test(decideCode),
);
check(
  "canned-replies.ts has ZERO import statements",
  !/^\s*import\s/m.test(cannedCode),
);
check(
  "decide-turn.ts does not declare server-only (so it runs in plain Node)",
  !/server-only/.test(decideCode),
);
check(
  "decide-turn.ts performs no I/O — no await, no supabase, no fetch",
  !/\bawait\b/.test(decideCode) &&
    !/supabase/i.test(decideCode) &&
    !/\bfetch\s*\(/.test(decideCode),
);
check(
  "decide-turn.ts reads no environment — a lane decision must not vary by deploy",
  !/process\.env/.test(decideCode),
);
check(
  "decide-turn.ts takes no UserContext — permissions are decided elsewhere",
  !/UserContext/.test(decideCode),
);

console.log("\n── 2. Single home: detectors ──");
/* The detector must be DEFINED in decide-turn and defined NOWHERE else.
   Anchored on the definition syntax, not a bare mention, so a call site or a
   comment cannot satisfy the assertion. */
const DETECTORS = [
  "tryFastReply",
  "isSmallTalk",
  "classifyBrandSection",
  "isBusinessDataQuery",
  "isWorkDataQuery",
  "isLiveInfoQuery",
  "isMemoryIntentQuery",
  "isTradeTermQuestion",
  "isChoiceShapedQuestion",
];
for (const d of DETECTORS) {
  const defRe = new RegExp(`^(export )?function ${d}\\s*\\(`, "m");
  check(`${d}() is defined in decide-turn.ts`, defRe.test(decide));
  const elsewhere = [
    [ORCH, orch],
    [AGENT_ROUTE, agentRoute],
    [CHAT_ROUTE, chatRoute],
  ].filter(([, src]) => defRe.test(src as string));
  check(
    `${d}() is NOT re-defined in the orchestrator or either route`,
    elsewhere.length === 0,
  );
}

console.log("\n── 3. Single home: the approved canned answers ──");
/* Q1_GREETING is the load-bearing string: it is the approved Section 3
   greeting. If a second copy appears anywhere, the "keep in sync" problem
   this phase removed has come back. */
const Q1_ANCHOR = "Koleex AI is here and ready to help.";
check(
  "the approved greeting exists in canned-replies.ts",
  canned.includes(Q1_ANCHOR),
);
check(
  "the approved greeting does NOT exist in either route",
  !agentRoute.includes(Q1_ANCHOR) && !chatRoute.includes(Q1_ANCHOR),
);
check(
  "neither route declares its own reply table",
  !/const\s+(FAST_REPLIES|CANNED_REPLIES)\s*:/.test(agentRoute) &&
    !/const\s+(FAST_REPLIES|CANNED_REPLIES)\s*:/.test(chatRoute),
);
check(
  "no file still asks a human to keep canned copies in sync",
  !/[Kk]eep in sync with .*(FAST_REPLIES|\/api\/ai\/chat)/.test(agentRoute) &&
    !/[Kk]eep in sync with the orchestrator/.test(chatRoute),
);

console.log("\n── 4. The two tables are DIFFERENT on purpose ──");
/* decide-turn's table is the orchestrator's narrow one: greetings and thanks,
   short replies. canned-replies is the long approved Section 3 text. Merging
   them would change what users read, so the difference is asserted, not
   assumed — a future "de-duplication" that collapses them fails here. */
check(
  "decide-turn's table does NOT contain the long approved greeting",
  !decide.includes(Q1_ANCHOR),
);
check(
  "the orchestrator's fast reply to 'hi' is the short one",
  tryFastReply("hi") === "Hi! How can I help?",
);
check(
  "the route's canned reply to 'hi' is the long approved Section 3 text",
  (tryCannedReply("hi") ?? "").startsWith("Hello.") &&
    (tryCannedReply("hi") ?? "").includes(Q1_ANCHOR),
);
check(
  "the two lookups genuinely return different text for the same input",
  tryFastReply("hi") !== tryCannedReply("hi"),
);

console.log("\n── 5. The orchestrator no longer re-exports the decision ──");
check(
  "orchestrator.ts has no detector re-export block",
  !/export\s*\{[^}]*isBusinessDataQuery[^}]*\}/.test(orch),
);
check(
  "both routes import the decision from core/decide-turn",
  /from "@\/lib\/server\/ai\/core\/decide-turn"/.test(agentRoute) &&
    /from "@\/lib\/server\/ai\/core\/decide-turn"/.test(chatRoute),
);
check(
  "the orchestrator still USES the detectors it imports (the move was not a delete)",
  /isBusinessDataQuery\(userMessage\)/.test(orch) &&
    /classifyBrandSection\(userMessage\)/.test(orch),
);

console.log("\n── 6. Behaviour: the lane decision still decides ──");
/* Values, not greps. Each case below is one the routes depend on; a detector
   that silently stopped matching would pass every check above and fail here. */
check("small talk: 'hello' is small talk", isSmallTalk("hello"));
check(
  "small talk: a real request is NOT small talk",
  !isSmallTalk("list my open quotations for the Cairo customer"),
);
check(
  "work data: 'what are my tasks today' reaches the tool lane",
  isWorkDataQuery("what are my tasks today"),
);
check(
  "work data: a general question about project management does NOT",
  !isWorkDataQuery("explain agile project management"),
);
check("trade terms: 'What does DDP mean?' is a trade-term question", isTradeTermQuestion("What does DDP mean?"));
check(
  "trade terms: substrings do not fire — 'fobbing' is not FOB",
  !isTradeTermQuestion("stop fobbing me off"),
);
check("business data: a trade-term question routes to tools", isBusinessDataQuery("What does DDP mean?"));
check("live info: 'weather in Cairo' bypasses the tool-less lane", isLiveInfoQuery("what is the weather in Cairo"));
check(
  "memory intent: 'remember that our MOQ is 500' never takes a tool-less lane",
  isMemoryIntentQuery("remember that our MOQ is 500"),
);
check(
  "choice-shaped: needs BOTH a which-opener and a domain noun",
  isChoiceShapedQuestion("which spreading machine should I choose?") &&
    !isChoiceShapedQuestion("which is better, tea or coffee?"),
);
check(
  "brand: 'what is Koleex AI' classifies as the AI section, not company",
  classifyBrandSection("what is Koleex AI") === "ai",
);
check("brand: an ordinary question needs no brand section", classifyBrandSection("how do I reset my password") === "none");
check("canned: a real question is NOT canned-answered", tryCannedReply("what is our MOQ for spreading machines") === null);

console.log("\n── 7. The vendor surface has exactly one home (Phase 2D) ──");
/* Phase 3 replaces the inside of core/transport.ts with provider adapters.
   That is a contained change only while the endpoint, the model id, the API
   key and the Authorization header exist in that ONE file. The moment a
   second file in the core starts talking to a provider, "swap the provider"
   goes back to being a change to the orchestrator. */
{
  const VENDOR_SURFACE = /api\.deepseek\.com|DEEPSEEK_API_KEY|Authorization/;
  const CORE_DIRS = [
    "src/lib/server/ai-agent",
    "src/lib/server/ai/core",
    "src/lib/server/ai/seals",
    "src/lib/server/ai/prompts",
  ];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts") && full !== TRANSPORT) {
        if (VENDOR_SURFACE.test(stripComments(read(full)))) offenders.push(full);
      }
    }
  };
  for (const d of CORE_DIRS) walk(d);
  check(
    `the endpoint, key and auth header appear ONLY in core/transport.ts${offenders.length ? ` — found in ${offenders.join(", ")}` : ""}`,
    offenders.length === 0,
  );
}
check(
  "transport.ts really does hold the vendor surface (so the check above is not vacuous)",
  /api\.deepseek\.com/.test(transport) && /DEEPSEEK_API_KEY/.test(transport),
);
check(
  "the orchestrator reads the key through the transport, not from the environment",
  /readProviderKey\(\)/.test(orch) && !/process\.env/.test(stripComments(orch)),
);
check(
  "the provider label is built in one place, not repeated at every return site",
  /providerLabel\(\)/.test(orch) && !/deepseek:\$\{/.test(orch),
);
check(
  "the API key is never logged, thrown or interpolated into a message",
  !/console\.[a-z]+\([^)]*\bkey\b/.test(stripComments(transport)) &&
    !/throw new Error\([^)]*\bkey\b/.test(stripComments(transport)),
);
/* KNOWN, recorded as finding N8: the agent route keeps its OWN provider call
   for the streaming fast lanes — it reads DEEPSEEK_API_KEY and invokes
   deepseekChatStream directly, bypassing the core entirely. Phase 3's
   acceptance criterion ("chatWithTools is the only way the core reaches a
   model") is not met until that lane goes through the same door. Asserted as
   a COUNT so the situation cannot quietly get worse while it waits. */
{
  const routeProviderCalls = (agentRoute.match(/deepseekChatStream\(/g) ?? []).length;
  check(
    `the route's parallel provider path has not grown (N8: expected 1 call site, found ${routeProviderCalls})`,
    routeProviderCalls <= 1,
  );
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(
  "Purity is asserted on comment-stripped source, so prose in a header cannot satisfy it.",
);
