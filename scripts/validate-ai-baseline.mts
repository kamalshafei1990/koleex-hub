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
  "streamed tool_calls are reassembled by index",
  /tc\.index \?\? 0[\s\S]{0,400}function\.arguments \+=/.test(orch),
  "providers fragment tool_calls across SSE frames",
);

/* ═══ 5. THE SEAL CHAIN — the verification engine. Order matters. ═══ */
section("Verification seal chain");

const sealFnIdx = orch.indexOf("function sealFinalReply");
check("sealFinalReply exists as the single funnel", sealFnIdx > 0);
/* Body = from the definition to the next top-level `\n}` — anchoring on the
   first textual occurrence of the name matched a comment hundreds of lines
   earlier and produced a vacuous window. */
const sealBody = sealFnIdx > 0 ? orch.slice(sealFnIdx, orch.indexOf("\n}", sealFnIdx) + 2) : "";
for (const seal of ["scrubLeakedToolMarkup", "sealExecutionSafety", "sealExecutionSafetyV2", "sealExecutionSafetyV3", "sealPricingSafety", "syncLastAnswerStep"]) {
  check(`${seal} is called inside sealFinalReply`, new RegExp(`${seal}\\(`).test(sealBody));
}
check(
  "quotation hard mode discards the model's text entirely",
  /isQuotationRequest\(userMessage\)[\s\S]{0,200}buildSafeQuotationReply\(steps\)/.test(orch),
  "the reply is rebuilt from tool payloads; the model's prose is not trusted for money",
);
check(
  "createQuotationDraft is NOT accepted as pricing evidence",
  /PRICING_TOOLS[\s\S]{0,300}calculateQuotationPricing/.test(orch) &&
    !/PRICING_TOOLS\s*=\s*new Set<string>\(\[[\s\S]{0,200}createQuotationDraft/.test(orch),
  "the model used its presence as cover to emit invented numbers",
);
check(
  "pricing evidence requires a positive finite NUMBER, not a numeric-looking string",
  /typeof v === "number" && Number\.isFinite\(v\) && v > 0/.test(orch),
  "a string that looks numeric is a placeholder or a fabrication",
);
check(
  "raw provider tool markup is scrubbed from the final reply",
  /TOOL_LEAK_RE[\s\S]{0,200}DSML/.test(orch),
  "owner screenshot 2026-08-21: a reply ended in raw provider tool tokens",
);
check(
  "the attached-document exemption keeps the fake-workflow seals ON",
  /attachedDocContext[\s\S]{0,400}sealExecutionSafetyV2\(sealed, steps\)/.test(orch),
  "reciting a document never justifies claiming tools ran — only v3/pricing stand down",
);

/* ═══ 6. PERMISSIONS ═══ */
section("Permission invariants");

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

const confirmServerEnforced = /confirm/.test(registry);
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

const idsAudited = /"task_id"/.test(audit) && /"event_id"/.test(audit);
console.log(`  ${idsAudited ? "✓ FIXED" : "…OPEN"}  audit Issue 6 — audit rows identify the changed record${idsAudited ? "" : " (task_id/event_id absent from SAFE_LOG_KEYS)"}`);

console.log(`\n${pass} passed, ${fail} failed`);
console.log("Known-open P0s are reported, not failed — Phase 1 flips them to assertions.\n");
process.exit(fail > 0 ? 1 : 0);
