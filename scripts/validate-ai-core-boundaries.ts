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
const DEEPSEEK_ADAPTER = "src/lib/server/ai/provider/adapters/deepseek.ts";
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
  "live info: asking to SEE something is a lookup, in three languages",
  isLiveInfoQuery("show me a picture of Port Said port") &&
    isLiveInfoQuery("what does a Jacquard loom look like") &&
    isLiveInfoQuery("photo of the Suez canal") &&
    isLiveInfoQuery("وريني صورة ميناء بورسعيد") &&
    isLiveInfoQuery("عايز أشوف صورة القماش ده") &&
    isLiveInfoQuery("شكل ميناء شنغهاي إيه") &&
    isLiveInfoQuery("给我看看苏伊士运河的图片") &&
    isLiveInfoQuery("龙门吊长什么样"),
);
check(
  "live info: 'picture' inside an ordinary sentence does not fire",
  !isLiveInfoQuery("the picture is clear, let's proceed") && !isLiveInfoQuery("explain agile project management"),
);
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

console.log("\n── 7. The core carries no vendor identity at all (Phase 2D → tightened 4A) ──");
/* Phase 3 replaces the inside of core/transport.ts with provider adapters.
   That is a contained change only while the endpoint, the model id, the API
   key and the Authorization header exist in that ONE file. The moment a
   second file in the core starts talking to a provider, "swap the provider"
   goes back to being a change to the orchestrator. */
/* Phase 4A TIGHTENED this. Until 4A the sweep exempted core/transport.ts,
   because that file legitimately held the endpoint, the model and the key —
   "one home for the vendor" rather than "no vendor". 4A moved all three into
   provider/adapters/deepseek.ts, so the bar moves up with them: vendor
   IDENTITY must now appear nowhere in the core at all, transport included.

   `Authorization` is deliberately NOT in this set. It is a mechanism, not an
   identity — every OpenAI-compatible provider uses the same header — and it
   still belongs in the transport. It gets its own narrower check below, which
   is the one that used to cover it, so nothing is dropped by splitting them. */
{
  const VENDOR_IDENTITY = /api\.deepseek\.com|DEEPSEEK_API_KEY|DEEPSEEK_MODEL|dashscope|DASHSCOPE_API_KEY/;
  const CORE_DIRS = [
    "src/lib/server/ai-agent",
    "src/lib/server/ai/core",
    "src/lib/server/ai/seals",
    "src/lib/server/ai/prompts",
  ];
  const coreFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts")) coreFiles.push(full);
    }
  };
  for (const d of CORE_DIRS) walk(d);
  const offenders = coreFiles.filter((f) => VENDOR_IDENTITY.test(stripComments(read(f))));
  check(
    `no vendor endpoint, key or model id anywhere in the core — transport included${offenders.length ? ` — found in ${offenders.join(", ")}` : ""}`,
    offenders.length === 0,
  );
  /* Non-vacuity for the sweep itself: it must actually be reading files, and
     it must be reading the transport. A walk over an empty or wrong directory
     also reports zero offenders. */
  check(
    `the sweep really read the core (${coreFiles.length} files, transport among them)`,
    coreFiles.length > 10 && coreFiles.includes(TRANSPORT),
  );
  /* Non-vacuity for the RULE: the regex must be capable of matching. If the
     vendor identity has genuinely vanished from the repo, the check above
     passes for the wrong reason. It has to be somewhere — the adapter. */
  check(
    "and the vendor identity is where it moved to, the adapter (so the sweep is not passing vacuously)",
    VENDOR_IDENTITY.test(read(DEEPSEEK_ADAPTER)),
  );
}
{
  /* The auth header is still a one-home rule, unchanged in intent from the
     pre-4A check — only separated from vendor identity now that the two live
     in different files. */
  const CORE_DIRS = ["src/lib/server/ai-agent", "src/lib/server/ai/core", "src/lib/server/ai/seals", "src/lib/server/ai/prompts"];
  const withAuth: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts") && /Authorization/.test(stripComments(read(full)))) withAuth.push(full);
    }
  };
  for (const d of CORE_DIRS) walk(d);
  check(
    `the Authorization header is built in exactly one core file${withAuth.length ? ` — ${withAuth.join(", ")}` : " — NONE, which means the check found nothing to guard"}`,
    withAuth.length === 1 && withAuth[0] === TRANSPORT,
  );
}
/* Phase 3C moved the bar. The orchestrator used to read the key through
   readProviderKey(); now it does not read the key AT ALL — it asks the
   provider registry whether one is available. That is strictly further from
   the environment, so the assertion tightens rather than relaxes: the loop
   must touch neither process.env nor the key itself. */
check(
  "the orchestrator reads no key and no environment — it asks the registry",
  /providerConfigured\(\)/.test(orch) &&
    !/process\.env/.test(stripComments(orch)) &&
    !/readProviderKey/.test(stripComments(orch)),
);
/* Both the pre-4A names and the post-4A ones are listed. The old ones cannot
   come back by accident, and the new ones cannot be introduced — a rename is
   not a way around this rule. */
check(
  "and it reaches a model through the one door, not the transport",
  /chatWithTools\(/.test(orch) &&
    !/callGroqPlain\(|callGroqWithRetry\(|callGroqStreamingOnce\(|postChat\(|postChatStreaming\(/.test(stripComments(orch)),
);
/* This assertion USED to read /providerLabel\(\)/, which after 4A would have
   matched `activeProviderLabel()` as a substring and passed without anyone
   choosing that. Anchored now, and pointed at the function that actually
   reports the serving adapter: a constant label would misreport every
   failover turn, and the label is what the audit trail records. */
check(
  "the provider label comes from the adapter that served the turn, in one place",
  /\bactiveProviderLabel\(\)/.test(stripComments(orch)) &&
    !/\bproviderLabel\(\)/.test(stripComments(orch).replace(/activeProviderLabel\(\)/g, "")) &&
    !/deepseek:\$\{/.test(orch),
);
check(
  "the API key is never logged, thrown or interpolated into a message",
  !/console\.[a-z]+\([^)]*\bkey\b/.test(stripComments(transport)) &&
    !/throw new Error\([^)]*\bkey\b/.test(stripComments(transport)),
);
/* FINDING N8 — CLOSED in Phase 4D, so the assertion changes from a holding
   count to the real rule. The agent route used to invoke deepseekChatStream
   directly for its streaming fast lane: a second path to a provider that
   bypassed the core entirely, with no failover, no circuit breaker, and its
   own copy of the endpoint. It was asserted as `<= 1` so it could not grow
   while it waited. It is zero now, and the count is replaced by the rule it
   was standing in for — a tolerance nobody needs any more is a tolerance that
   quietly permits a regression. */
{
  /* Comment-stripped, like every other purity check here: the header above
     this lane NAMES deepseekChatStream to explain what it replaced, and a
     rule about calls that a comment can violate is not a rule. */
  const routeProviderCalls = (stripComments(agentRoute).match(/deepseekChatStream\(/g) ?? []).length;
  check(
    `the route has NO parallel provider path (N8 closed: found ${routeProviderCalls})`,
    routeProviderCalls === 0,
  );
  check(
    "the fast lane reaches a model through the same door as the loop",
    /chatWithTools\(/.test(stripComments(agentRoute)),
  );
  /* The switch must still be honoured, or closing N8 would have silently
     removed an operator's control. It is checked in the route now instead of
     two call frames down inside the provider. */
  check(
    "and the streaming fast lane still honours the operator's kill-switch",
    /streamingFastLaneEnabled\(\)/.test(stripComments(agentRoute)) &&
      /const canFastPath[\s\S]{0,400}?streamingFastLaneEnabled\(\)/.test(agentRoute),
  );
  /* Non-vacuity: the policy must be a real read of the flag, not a stub that
     returns true. Phase 7 changed the TEST (absence now means enabled), so
     this is anchored on the variable rather than on one comparison. */
  {
    const policy = read("src/lib/server/ai/router/provider-policy.ts");
    check(
      "the kill-switch policy actually reads the environment variable",
      /process\.env\.USE_DEEPSEEK/.test(stripComments(policy)),
    );
    /* And it is now the ONE place that reads it — 4D left the flag checked in
       two files with different semantics, which is what made it mean nothing.
       A second reader would re-open exactly that. */
    const readers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && /process\.env\.USE_DEEPSEEK/.test(stripComments(read(full)))) {
          readers.push(full);
        }
      }
    };
    walk("src");
    check(
      `USE_DEEPSEEK is read in exactly one file${readers.length !== 1 ? ` — found in ${readers.join(", ")}` : ` (${readers[0]})`}`,
      readers.length === 1 && readers[0] === "src/lib/server/ai/router/provider-policy.ts",
    );
  }
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
