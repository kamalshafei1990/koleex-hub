/* ---------------------------------------------------------------------------
   validate:ai-provider — Phase 3B gate.

   3A proved the IR sends the same REQUEST as the transport. This proves the
   adapter reads the same RESPONSE the agent loop used to read inline.

   The parse is the part that moved. Before 3B the loop did this itself, at two
   of three call sites:

       choice   = json.choices?.[0]?.message;
       toolCalls = choice.tool_calls ?? [];
       content   = choice.content ?? "";

   Those two `??` are not incidental. A tool-only turn arrives with
   `content: null`, and a turn with no tool calls has no `tool_calls` key at
   all; the loop treats both as empty. An adapter that returned null content,
   or undefined tool calls, would push that decision back into the loop — which
   is the whole thing Phase 3 is undoing.

   So every case below feeds the adapter the JSON a provider actually returns
   and compares against the loop's own expression, written out here verbatim.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { parseOpenAiChatResponse } from "../src/lib/server/ai/provider/adapters/deepseek";
import { selectAdapter, providerConfigured, activeProviderLabel, pickAdapter } from "../src/lib/server/ai/provider/registry";
import type { ProviderAdapter, TurnOutcome } from "../src/lib/server/ai/provider/types";

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

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The agent loop's own parse, copied verbatim from orchestrator.ts. */
function loopParse(json: any) {
  const choice = json.choices?.[0]?.message;
  return { toolCalls: choice?.tool_calls ?? [], content: choice?.content ?? "" };
}

const CASES: Array<[string, any]> = [
  [
    "a plain answer",
    { choices: [{ message: { role: "assistant", content: "Three widths are available." }, finish_reason: "stop" }] },
  ],
  [
    "a tool-only turn (content: null)",
    {
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "call_1", type: "function", function: { name: "searchProducts", arguments: '{"q":"spreading"}' } }],
        },
        finish_reason: "tool_calls",
      }],
    },
  ],
  [
    "content AND tool calls together",
    {
      choices: [{
        message: {
          role: "assistant",
          content: "Looking that up.",
          tool_calls: [
            { id: "a", type: "function", function: { name: "searchProducts", arguments: "{}" } },
            { id: "b", type: "function", function: { name: "askUser", arguments: '{"question":"width?"}' } },
          ],
        },
      }],
    },
  ],
  ["an empty choices array", { choices: [] }],
  ["no choices key at all", {}],
  [
    "malformed tool arguments — the provider emitted broken JSON",
    { choices: [{ message: { content: null, tool_calls: [{ id: "x", type: "function", function: { name: "searchProducts", arguments: '{"q": "unterm' } }] } }] },
  ],
  [
    "usage reported",
    { choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 1200, completion_tokens: 40 } },
  ],
];

console.log("\n── 1. The adapter reads what the loop read ──");
for (const [label, json] of CASES) {
  const mine = parseOpenAiChatResponse(json);
  const theirs = loopParse(json);
  check(`${label}: content matches the loop's expression`, mine.content === theirs.content);
  check(
    `${label}: tool calls match one for one`,
    mine.toolCalls.length === theirs.toolCalls.length &&
      mine.toolCalls.every((c, i) => c.id === theirs.toolCalls[i].id && c.name === theirs.toolCalls[i].function.name && c.argumentsJson === theirs.toolCalls[i].function.arguments),
  );
}

console.log("\n── 2. The two normalisations the loop depends on ──");
{
  const toolOnly = parseOpenAiChatResponse(CASES[1][1]);
  check("a null content becomes an empty string, never null", toolOnly.content === "");
  const plain = parseOpenAiChatResponse(CASES[0][1]);
  check("a missing tool_calls becomes an empty array, never undefined", Array.isArray(plain.toolCalls) && plain.toolCalls.length === 0);
  const broken = parseOpenAiChatResponse(CASES[5][1]);
  check("malformed arguments are handed on as a string, not parsed", broken.toolCalls[0].argumentsJson === '{"q": "unterm');
  const empty = parseOpenAiChatResponse(CASES[4][1]);
  check("a response with no choices does not throw and yields empty content", empty.content === "" && empty.toolCalls.length === 0);
}

console.log("\n── 3. Usage and finish reason survive ──");
{
  const u = parseOpenAiChatResponse(CASES[6][1]);
  check("token usage is carried through", u.usage?.inputTokens === 1200 && u.usage?.outputTokens === 40);
  check("a response without usage reports null, not zero", parseOpenAiChatResponse(CASES[0][1]).usage?.inputTokens === null);
  check("the finish reason is carried through", parseOpenAiChatResponse(CASES[1][1]).finishReason === "tool_calls");
}

console.log("\n── 4. The registry has one door, and its order is a decision ──");
{
  const registry = readFileSync("src/lib/server/ai/provider/registry.ts", "utf8");
  check("chatWithTools is exported as the single entry point", /export async function chatWithTools\(/.test(registry));
  check(
    "DeepSeek is first in the registry — it is the China-accessible provider, and that ordering is load-bearing",
    /REGISTRY: ProviderAdapter\[\] = \[deepseekAdapter/.test(registry),
  );
  /* This was pinned to `REGISTRY.find((a) => a.configured())` and broke when
     that line moved into pickAdapter() — a check tied to a code SHAPE rather
     than to the rule it protects. The rule is now proved behaviourally in
     section 6 with fakes; what remains here is only that the live selector
     goes through that same pure function rather than growing its own logic. */
  check("selection is by configuration, through one pure selector", /adapters\.find\(\(a\) => a\.configured\(\)\)/.test(registry) && /return pickAdapter\(REGISTRY\)/.test(registry));
  check(
    "an unconfigured system reports it rather than throwing",
    providerConfigured() === (selectAdapter() !== null) && typeof activeProviderLabel() === "string",
  );
}

console.log("\n── 5. The adapter delegates; it does not re-implement the transport ──");
{
  const adapter = readFileSync("src/lib/server/ai/provider/adapters/deepseek.ts", "utf8");
  const code = adapter.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check("the adapter makes no fetch of its own", !/\bfetch\s*\(/.test(code));
  check("the adapter holds no endpoint or key", !/api\.deepseek\.com|DEEPSEEK_API_KEY|Authorization/.test(code));
  check("it goes through the transport that Phase 2D isolated", /from "@\/lib\/server\/ai\/core\/transport"/.test(code));
  /* The first version of this check matched the KEY `bodyText` and passed
     happily when every branch set it to "". The rescue path logs that body and
     branches on it, so an empty literal is the same as deleting it. Anchored
     on the SOURCES instead: the HTTP body, and the streaming call's own
     reported body. */
  check(
    "a failed HTTP call carries the provider's actual body text, not an empty literal",
    /bodyText: await res\.text\(\)/.test(code),
  );
  check(
    "a failed STREAMING call carries the body the transport reported",
    /bodyText: s\.bodyText/.test(code),
  );
  check(
    "a failure always reports a status too",
    (code.match(/ok: false, status:/g) ?? []).length >= 3,
  );
}

console.log("\n── 6. The interface is sufficient for a SECOND provider ──");
/* Phase 3's acceptance criterion is that a second adapter needs no change to
   the loop. A real one — Qwen/DashScope is the China-accessible candidate —
   additionally needs core/transport.ts to take an endpoint and key rather than
   hard-coding DeepSeek's, and needs a key to be reachable at runtime. Both are
   Phase 4 work, and claiming a second provider "done" without either would be
   the "complete because it compiles" the project rules forbid.
   What CAN be proved now is that the interface admits one and that selection
   behaves — so that is proved, with fakes, rather than asserted. */
{
  const make = (name: string, configured: boolean, content: string): ProviderAdapter => ({
    name,
    configured: () => configured,
    model: () => `${name}-1`,
    chat: async (): Promise<TurnOutcome> => ({ ok: true, response: { content, toolCalls: [] } }),
  });
  const primary = make("primary", true, "from primary");
  const secondary = make("secondary", true, "from secondary");
  const unconfigured = make("unconfigured", false, "never");

  check("the first CONFIGURED adapter wins, and order is preference", pickAdapter([primary, secondary])?.name === "primary");
  check("an unconfigured adapter is skipped, not selected and failed", pickAdapter([unconfigured, secondary])?.name === "secondary");
  check("no configured adapter yields null rather than throwing", pickAdapter([unconfigured]) === null);
  check("an empty registry yields null", pickAdapter([]) === null);
  check(
    "a second adapter satisfies the interface with no loop change — it is just an object",
    typeof secondary.chat === "function" && typeof secondary.configured === "function" && typeof secondary.model === "function",
  );
  /* The failure branch is part of the contract, not an afterthought: an
     adapter that could only succeed would push error handling back into the
     loop, which is what Phase 3 removed. */
  const failing: ProviderAdapter = { ...make("failing", true, ""), chat: async () => ({ ok: false, status: 503, bodyText: "down" }) };
  check("an adapter may report failure through the same contract", pickAdapter([failing])?.name === "failing");
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("Section 1 compares against the loop's own parse expression, copied verbatim — not against a description of it.");
