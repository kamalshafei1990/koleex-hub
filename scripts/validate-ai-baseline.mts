#!/usr/bin/env tsx

/* ===========================================================================
   PHASE 0 — AI incident-replay guard (structural; no runtime, no DB, no key).

   WHY THIS EXISTS
   ---------------
   The architecture audit found ~20 production incidents encoded as guards,
   detectors and orderings across the AI runtime — each recorded in a code
   comment with the date it was learned. Phases 1–6 move nearly all of that
   code (the orchestrator goes 3 211 → ~800 lines). A refactor that silently
   drops one of these guards would re-open a bug that already reached a user.

   This suite pins each incident to an assertion. It is the regression gate
   for every later phase: it must pass BEFORE and AFTER each refactor.

   WHAT IT IS NOT
   --------------
   Not a behavioural test — there is no provider key or DB here. It asserts
   the guards EXIST and are WIRED IN THE RIGHT ORDER. Behavioural coverage
   arrives with the Phase 20 evaluation suite.

   Each case cites the incident it protects. If you are deleting a case,
   you are deleting the memory of a live failure — read the comment first.
   ========================================================================== */

import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}${detail ? `\n      ↳ ${detail}` : ""}`); }
}
function section(t: string) { console.log(`\n── ${t}`); }

const orch = readFileSync("src/lib/server/ai-agent/orchestrator.ts", "utf8");
const agentRoute = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
const registry = readFileSync("src/lib/server/ai-agent/tool-registry.ts", "utf8");
const perms = readFileSync("src/lib/server/ai-agent/permissions.ts", "utf8");
const todos = readFileSync("src/lib/server/ai-agent/tools/todos.ts", "utf8");
const audit = readFileSync("src/lib/server/ai-agent/audit.ts", "utf8");
const webSearch = readFileSync("src/lib/server/ai-agent/tools/web-search.ts", "utf8");

/* Phase 2B moved the seal chain out of orchestrator.ts into its own layer.
   These pins follow the CODE, not the filename: each assertion below reads the
   specific seals module that owns the behaviour it pins. Deliberately NOT one
   concatenated blob of the whole tree — a pin that can be satisfied by a match
   in some unrelated file is a pin that no longer pins anything. */
const sealsIndex = readFileSync("src/lib/server/ai/seals/index.ts", "utf8");
const sealsPricing = readFileSync("src/lib/server/ai/seals/pricing.ts", "utf8");
const sealsText = readFileSync("src/lib/server/ai/seals/text.ts", "utf8");
const sealsQuotation = readFileSync("src/lib/server/ai/seals/quotation.ts", "utf8");
/* Phase 2D moved every provider call — including the streaming tool_calls
   reassembly — into core/transport.ts. Same reasoning as the seals above:
   follow the code, name the file that owns the behaviour. */
const transport = readFileSync("src/lib/server/ai/core/transport.ts", "utf8");

/* ═══ 1. LANE ROUTING — the tool-less fast lane must never swallow a turn
       that needs tools. Each of these was a measured production failure:
       the model apologised for having no access while the tool sat one
       layer down, unreached. ═══ */
section("Lane routing — fast lane must not swallow tool-worthy turns");

/* The route assigns the detector results to locals first, so assert on the
   LOCAL names actually used in the canFastPath expression — asserting on the
   function names silently passed nothing. */
const canFastPathExpr = /const canFastPath\s*=([\s\S]{0,400}?);/.exec(agentRoute)?.[1] ?? "";
for (const guard of ["isBusinessData", "isWorkData", "isLiveInfo", "isMemoryIntent", "isMidFlowReply"]) {
  check(
    `agent route excludes ${guard} from the fast lane`,
    new RegExp(`!${guard}\\b`).test(canFastPathExpr),
    "the fast lane carries NO tools; letting this intent through makes the model deflect instead of reading real data",
  );
}
check(
  "canFastPath was actually located (guard the guard)",
  canFastPathExpr.length > 0,
  "if canFastPath is renamed, every exclusion assertion above becomes vacuous — fail loudly instead",
);

check(
  "orchestrator repeats the same exclusion (isDataQuery)",
  /const isDataQuery\s*=[\s\S]{0,600}isMemoryIntentQuery/.test(orch),
  "orchestrate() has its own fast paths and needs the identical guard",
);

check(
  "data queries outrank brand/small-talk classification",
  /isDataQuery \? "none" : classifyBrandSection/.test(orch),
  'a message can read as brand AND data ("which overlock models does Koleex have?") — data must win',
);

/* ═══ 2. FORCED TOOL CHOICE — a rule the model follows only sometimes is
       not a rule. Both of these were measured being ignored. ═══ */
section("Forced tool choice");

check(
  "trade-term questions force searchTradeTerms on the first request",
  /forceTradeNow[\s\S]{0,400}name: "searchTradeTerms"/.test(orch),
  'measured: the model answered "transferable letter of credit" from memory — memory still carries the ship\'s-rail rule deleted in 2010',
);
check(
  "choice-shaped questions force askUser",
  /forceAskNow[\s\S]{0,300}name: "askUser"/.test(orch),
  "measured: four numbered questions in prose instead of a tappable card",
);
check(
  "a prose answer on a choice-shaped turn is rejected and re-asked",
  /proseRefused\s*=\s*true[\s\S]{0,120}continue/.test(orch),
  "nothing has streamed at that point, so the reply can be discarded rather than retracted",
);

/* ═══ 3. PROVIDER WIRE-PROTOCOL ORDERING — violating this returned
       HTTP 400 and the turn fell back to raw tool text as the answer. ═══ */
section("Provider wire-protocol ordering");

const budgetNudgeIdx = orch.indexOf("Tool-call budget reached");
const toolFeedIdx = orch.indexOf('role: "tool"');
check(
  "tool-budget system nudge is pushed AFTER the tool-role messages",
  toolFeedIdx > 0 && budgetNudgeIdx > toolFeedIdx,
  'providers require assistant tool_calls to be IMMEDIATELY followed by its tool replies — injecting between them returned 400 "insufficient tool messages following tool_calls"',
);

/* ═══ 4. STREAMING LIFECYCLE ═══ */
section("Streaming lifecycle");

check(
  "keepalive interval is cleared in a finally block",
  /\}\s*finally\s*\{[\s\S]{0,900}clearInterval\(keepalive\)/.test(agentRoute),
  "if orchestrate() throws, the original code skipped clearInterval and the server emitted ': ping' until TCP died",
);
check(
  "canned replies are emitted as SSE when the client asked for a stream",
  /if \(wantsStream\)[\s\S]{0,900}type: "start"[\s\S]{0,600}type: "end"/.test(agentRoute),
  'the canned path used to return JSON, which crashed the uniform client parser into "No reply was received"',
);
check(
  "the transport layer is where these provider pins expect it",
  transport.includes("api.deepseek.com") && transport.includes("callGroqStreamingOnce"),
  "if this fails, the pin beneath it is reading the wrong file — fix the path, do not delete the pin",
);
check(
  "streamed tool_calls are reassembled by index",
  /tc\.index \?\? 0[\s\S]{0,400}function\.arguments \+=/.test(transport),
  "providers fragment tool_calls across SSE frames",
);

/* ═══ 5. THE SEAL CHAIN — the verification engine. Order matters. ═══ */
section("Verification seal chain");

/* Guard the guard. Every pin below reads the seals layer by path. If that layer
   moves again and the reads return an empty or unrelated file, the pins would
   pass or fail for the wrong reason — so assert the layer is really there and
   really the seal chain BEFORE asserting anything about its contents. */
check(
  "the seals layer is where these pins expect it",
  sealsIndex.includes("sealFinalReply") &&
    sealsPricing.includes("PRICING_TOOLS") &&
    sealsText.includes("TOOL_LEAK_RE") &&
    sealsQuotation.includes("buildSafeQuotationReply"),
  "if this fails, the pins beneath it are reading the wrong files — fix the paths, do not delete the pins",
);

const sealFnIdx = sealsIndex.indexOf("function sealFinalReply");
check("sealFinalReply exists as the single funnel", sealFnIdx > 0);
/* Body = from the definition to the next top-level `\n}` — anchoring on the
   first textual occurrence of the name matched a comment hundreds of lines
   earlier and produced a vacuous window. */
const sealBody = sealFnIdx > 0 ? sealsIndex.slice(sealFnIdx, sealsIndex.indexOf("\n}", sealFnIdx) + 2) : "";
for (const seal of ["scrubLeakedToolMarkup", "sealExecutionSafety", "sealExecutionSafetyV2", "sealExecutionSafetyV3", "sealPricingSafety", "syncLastAnswerStep"]) {
  check(`${seal} is called inside sealFinalReply`, new RegExp(`${seal}\\(`).test(sealBody));
}
check(
  "quotation hard mode discards the model's text entirely",
  /isQuotationRequest\(userMessage\)[\s\S]{0,200}buildSafeQuotationReply\(steps\)/.test(sealsIndex),
  "the reply is rebuilt from tool payloads; the model's prose is not trusted for money",
);
check(
  "createQuotationDraft is NOT accepted as pricing evidence",
  /PRICING_TOOLS[\s\S]{0,300}calculateQuotationPricing/.test(sealsPricing) &&
    !/PRICING_TOOLS\s*=\s*new Set<string>\(\[[\s\S]{0,200}createQuotationDraft/.test(sealsPricing),
  "the model used its presence as cover to emit invented numbers",
);
check(
  "pricing evidence requires a positive finite NUMBER, not a numeric-looking string",
  /typeof v === "number" && Number\.isFinite\(v\) && v > 0/.test(sealsPricing),
  "a string that looks numeric is a placeholder or a fabrication",
);
check(
  "raw provider tool markup is scrubbed from the final reply",
  /TOOL_LEAK_RE[\s\S]{0,200}DSML/.test(sealsText),
  "owner screenshot 2026-08-21: a reply ended in raw provider tool tokens",
);
check(
  "the attached-document exemption is scoped to THIS TURN, not retained history (audit Issue 5)",
  !/attachedDocCtx[\s\S]{0,200}history\.some/.test(orch),
  "scanning history meant ONE attachment switched the field-grounding and pricing seals off for every later turn in the conversation — the widest blast radius in the seal chain",
);
check(
  "both attachedDocCtx sites use the single shared detector",
  (orch.match(/attachedDocCtx = hasUntrustedContent\(userMessage\)/g) ?? []).length === 2,
  "orchestrate() and orchestrateNoGroq() each have one; two copies of a string test drift apart",
);
check(
  "the attached-document exemption keeps the fake-workflow seals ON",
  /attachedDocContext[\s\S]{0,400}sealExecutionSafetyV2\(sealed, steps\)/.test(sealsIndex),
  "reciting a document never justifies claiming tools ran — only v3/pricing stand down",
);

/* ═══ 6. PERMISSIONS ═══ */
section("Permission invariants");

check(
  "the knowledge nudge is gated on the AI Knowledge module (audit Issue 7)",
  /checkModule\(ctx, "AI Knowledge", "view"\)[\s\S]{0,300}getKnowledgeNudgeBlock/.test(agentRoute) ||
    /canReadKnowledge[\s\S]{0,200}getKnowledgeNudgeBlock/.test(agentRoute),
  "search_knowledge is gated on that module so a user who cannot open Knowledge cannot read ingested documents by asking the agent; the nudge surfaced the same corpus with the same citations, ungated",
);
check(
  "every getKnowledgeNudgeBlock call site is gated",
  (agentRoute.match(/getKnowledgeNudgeBlock\(/g) ?? []).length ===
    (agentRoute.match(/(canReadKnowledge\s*\n?\s*\?|"AI Knowledge", "view"\)\.allowed\s*\n?\s*\?)\s*\n?\s*await getKnowledgeNudgeBlock/g) ?? []).length,
  "one ungated call site is the whole leak",
);
check(
  "taught answers stay UNgated (deliberate — they are answers written to be given)",
  /getTaughtAnswersBlock\(auth\.tenant_id \?\? null\)/.test(agentRoute),
  "taught Q&A are canonical replies the owner wrote for the assistant to give users; gating them defeats their purpose. Only document content with citations is gated.",
);

check(
  "dispatchTool checks the module guard BEFORE running the handler",
  orch.length > 0 && registry.indexOf("checkModule(") < registry.indexOf("await tool.handler("),
  "the cheapest rejection path must come first, and no DB hit may precede it",
);
check(
  "dispatchTool audits denials, not just successes",
  /decision\.allowed[\s\S]{0,600}await logToolCall/.test(registry),
);
check(
  'SENSITIVE_FIELDS registers the real column name "customers.notes"',
  /"customers\.notes"/.test(perms),
  'the key was customers.internal_notes while the COLUMN is notes — filterFields matched nothing and internal notes leaked for everyone',
);
check(
  "account overrides replace role flags in BOTH directions",
  /typeof ov\.can_view === "boolean" \? ov\.can_view : existing\.can_view/.test(perms),
  "a hide override must beat a role grant AND a grant override must beat a role denial (2026-08-03)",
);
check(
  "tool errors never reach the model as a stack trace",
  /catch \(e\)[\s\S]{0,400}Something went wrong while running that tool/.test(registry),
);
check(
  "an unknown tool name is not echoed back",
  /I can't do that action here/.test(registry) && !/Unknown tool: \$\{name\}/.test(registry),
  "don't confirm a hallucinated tool name",
);

/* ═══ 7. WRITE-PATH INVARIANTS ═══ */
section("Write-path invariants");

check(
  'createTodo writes source "manual", not a value the CHECK constraint rejects',
  /source: "manual"/.test(todos) && !/source: "koleex-ai"/.test(todos),
  "the source column has CHECK (manual|crm|calendar); 'koleex-ai' violated it and silently failed EVERY confirmed create until 2026-08-08",
);
check(
  "createTodo writes tenant_id from the server context",
  /tenant_id: ctx\.auth\.tenant_id/.test(todos),
);
check(
  "memory + knowledge writes are blocked while viewing-as",
  /viewing_as[\s\S]{0,200}Not while viewing as another user/.test(
    readFileSync("src/lib/server/ai-agent/tools/user-memory.ts", "utf8"),
  ),
  "view-as is read-only by design",
);
check(
  "every write tool still offers a two-phase preview",
  ["createTodo", "completeTodo", "updateTodo", "reassignTodo", "deleteTodo"].every((t) =>
    new RegExp(`name: "${t}"[\\s\\S]{0,6000}args\\.confirm !== true`).test(todos),
  ),
  "Phase 1 will make this server-enforced; until then the shape must not regress",
);

/* ═══ 8. KNOWN-OPEN P0s — asserted as STILL OPEN so Phase 1 can flip them.
       These deliberately fail-forward: when Phase 1 lands, each flips to the
       fixed assertion and the incident is closed. ═══ */
section("Known-open P0s (audit Issues 1-3, 6) — tracked, flip in Phase 1");

/* Was a presence test for the word "confirm"; now asserts the real mechanism:
   dispatchTool must CONSUME a pending action before a confirmed write runs,
   and must RECORD one when a tool returns a preview. */
const confirmServerEnforced =
  /consumePendingAction\(/.test(registry) && /recordPendingAction\(/.test(registry);
console.log(`  ${confirmServerEnforced ? "✓ FIXED" : "…OPEN"}  audit Issue 1 — server-enforced write confirmation${confirmServerEnforced ? "" : " (dispatchTool still never inspects `confirm`)"}`);

/* WAS A FALSE POSITIVE: /redact/i matched "requi[redAct]ion" and reported an
   OPEN security issue as FIXED. A security assertion that can false-positive is
   worse than no assertion. Anchored on identifiers that cannot occur by accident,
   and cross-checked against the handler actually transforming the query. */
const handlerBody = /handler: async \(_ctx, args\)[\s\S]*/.exec(webSearch)?.[0] ?? "";
const forwardsVerbatim = /const query = String\(args\?\.query \?\? ""\)\.trim\(\);[\s\S]{0,400}searchWeb\(query\)/.test(handlerBody);
const egressScanned =
  !forwardsVerbatim &&
  /(scanEgress|egressScan|redactQuery|assertNoTenantData|containsConfidential)/.test(webSearch);
console.log(`  ${egressScanned ? "✓ FIXED" : "…OPEN"}  audit Issue 2 — web-search egress scanning${egressScanned ? "" : " (args.query still forwarded verbatim)"}`);

const replyLogged = (orch.match(/ai\.agent\.final\.before/g) ?? []).length;
console.log(`  ${replyLogged === 0 ? "✓ FIXED" : "…OPEN"}  audit Issue 3 — full reply in logs (${replyLogged} site(s))`);

const rateLimited =
  /consumeBudget\(/.test(agentRoute) &&
  /consumeBudget\(/.test(readFileSync("src/app/api/ai/attachments/route.ts", "utf8"));
console.log(`  ${rateLimited ? "✓ FIXED" : "…OPEN"}  audit Issue 4 — rate limiting${rateLimited ? "" : " (no budget check on the AI routes)"}`);

const idsAudited = /"task_id"/.test(audit) && /"event_id"/.test(audit);
console.log(`  ${idsAudited ? "✓ FIXED" : "…OPEN"}  audit Issue 6 — audit rows identify the changed record${idsAudited ? "" : " (task_id/event_id absent from SAFE_LOG_KEYS)"}`);

console.log(`\n${pass} passed, ${fail} failed`);
console.log("Known-open P0s are reported, not failed — Phase 1 flips them to assertions.\n");
process.exit(fail > 0 ? 1 : 0);
