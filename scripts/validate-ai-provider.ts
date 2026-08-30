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
import { selectAdapter, providerConfigured, activeProviderLabel } from "../src/lib/server/ai/provider/registry";

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
  check("selection is by configuration, not by a hard-coded name", /REGISTRY\.find\(\(a\) => a\.configured\(\)\)/.test(registry));
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

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("Section 1 compares against the loop's own parse expression, copied verbatim — not against a description of it.");
