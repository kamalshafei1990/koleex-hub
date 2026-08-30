/* ---------------------------------------------------------------------------
   validate:ai-turn-ir — Phase 3A gate.

   The IR exists so the core can stop speaking a vendor's wire format. That is
   only worth anything if two things hold, and neither is visible to the type
   checker:

     1. The IR loses NOTHING. A tool call that survives IR → wire → IR with a
        different id, a dropped argument string, or a lost `content: null` is
        a bug that would surface as the model forgetting what it just did.

     2. The IR produces the SAME REQUEST we send today. Not "an equivalent
        one" — the same JSON. Phase 3 replaces the inside of the transport;
        if the body changes shape at the same time, any behaviour change gets
        blamed on the provider and hunted in the wrong place.

   (2) is a genuine differential test, not a description: `buildChatBody` (what
   core/transport.ts actually sends) and `toOpenAiBody` (what the IR produces)
   both run over a matrix of turns and their JSON is compared. Extracting
   buildChatBody in 3A is what made that possible — before it, the body was
   built inline inside three fetch calls and could only be checked by reading.
   --------------------------------------------------------------------------- */

import {
  toOpenAiBody,
  toOpenAiMessages,
  fromOpenAiMessages,
  toOpenAiTools,
  fromOpenAiTools,
  toOpenAiToolChoice,
  fromOpenAiToolChoice,
  type IrMessage,
  type IrTool,
  type IrToolChoice,
  type TurnRequest,
} from "../src/lib/server/ai/provider/turn-ir";
import { buildChatBody, type WireMsg, type ToolChoice, type ToolSchema } from "../src/lib/server/ai/core/transport";

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
const j = (v: unknown) => JSON.stringify(v);

/* ── Fixtures: the shapes a real tool loop actually produces ───────────── */
const TOOLS: IrTool[] = [
  { name: "searchProducts", description: "Find products.", parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] } },
  { name: "askUser", description: "Ask a clarifying question.", parameters: { type: "object", properties: { question: { type: "string" } } } },
];

const SIMPLE: IrMessage[] = [
  { role: "system", content: "You are Koleex AI." },
  { role: "user", content: "hello" },
];

/* The load-bearing shape: an assistant turn that ONLY called tools (content
   null), followed by the tool results, followed by the next user turn. */
const TOOL_LOOP: IrMessage[] = [
  { role: "system", content: "You are Koleex AI." },
  { role: "user", content: "which spreading machine?" },
  {
    role: "assistant",
    content: null,
    toolCalls: [
      { id: "call_1", name: "searchProducts", argumentsJson: '{"q":"spreading"}' },
      { id: "call_2", name: "askUser", argumentsJson: '{"question":"width?"}' },
    ],
  },
  { role: "tool", content: '{"rows":3}', toolCallId: "call_1", name: "searchProducts" },
  { role: "tool", content: '{"asked":true}', toolCallId: "call_2", name: "askUser" },
  { role: "assistant", content: "Three widths are available." },
];

console.log("\n── 1. IR → wire → IR loses nothing ──");
for (const [label, msgs] of [["a simple turn", SIMPLE], ["a full tool loop", TOOL_LOOP]] as const) {
  check(`${label}: messages round-trip exactly`, j(fromOpenAiMessages(toOpenAiMessages(msgs))) === j(msgs));
}
check("tools round-trip exactly", j(fromOpenAiTools(toOpenAiTools(TOOLS))) === j(TOOLS));
for (const c of ["auto", "none", { forceTool: "askUser" }] as IrToolChoice[]) {
  check(`tool choice ${j(c)} round-trips exactly`, j(fromOpenAiToolChoice(toOpenAiToolChoice(c))) === j(c));
}

console.log("\n── 2. The details that would quietly break a tool loop ──");
{
  const wire = toOpenAiMessages(TOOL_LOOP);
  const assistant = wire[2];
  check("an assistant turn that only called tools keeps content: null", assistant.content === null);
  check("both tool calls survive, in order", assistant.tool_calls?.length === 2 && assistant.tool_calls[0].id === "call_1" && assistant.tool_calls[1].id === "call_2");
  check("call ids are preserved verbatim", assistant.tool_calls?.[1].id === "call_2");
  check("arguments stay a STRING, unparsed", typeof assistant.tool_calls?.[0].function.arguments === "string");
  check("a tool result carries its tool_call_id", wire[3].tool_call_id === "call_1");
  check("a tool result carries the tool name", wire[3].name === "searchProducts");
}
{
  /* A model CAN emit invalid JSON. The IR must hand it on untouched so the
     loop's own guard sees it — parsing here would either throw inside the
     transport or silently swallow a malformed call. */
  const broken: IrMessage[] = [{ role: "assistant", content: null, toolCalls: [{ id: "c", name: "searchProducts", argumentsJson: '{"q": "unterminated' }] }];
  /* Wrapped, because an IR that starts PARSING arguments does not merely
     return the wrong value here — it throws, and an unguarded call would kill
     the whole suite with a stack trace instead of naming the regression. A
     conversion that can throw on model output is itself the defect. */
  let survived = false;
  let threw: string | null = null;
  try {
    survived = fromOpenAiMessages(toOpenAiMessages(broken))[0].toolCalls?.[0].argumentsJson === '{"q": "unterminated';
  } catch (e) {
    threw = String(e).slice(0, 80);
  }
  check(
    `malformed tool arguments survive the round trip untouched${threw ? ` — the conversion THREW: ${threw}` : ""}`,
    survived,
  );
}

console.log("\n── 3. Differential: the IR sends what the transport sends today ──");
/* Same logical turn, built both ways, JSON compared. Not "equivalent" — the
   same bytes, because Phase 3 must not change the wire while it changes the
   layering. */
const MODEL = "deepseek-chat";
type Case = { label: string; ir: TurnRequest; wire: { messages: WireMsg[]; maxTokens: number; toolChoice?: ToolChoice; tools?: ToolSchema[]; stream?: boolean } };
const wireSimple = toOpenAiMessages(SIMPLE) as unknown as WireMsg[];
const wireLoop = toOpenAiMessages(TOOL_LOOP) as unknown as WireMsg[];
const wireTools = toOpenAiTools(TOOLS) as unknown as ToolSchema[];

const CASES: Case[] = [
  {
    label: "plain small-talk call (no tools, 160 tokens)",
    ir: { messages: SIMPLE, maxTokens: 160, temperature: 0.3 },
    wire: { messages: wireSimple, maxTokens: 160 },
  },
  {
    label: "brand call (no tools, 1200 tokens)",
    ir: { messages: SIMPLE, maxTokens: 1200, temperature: 0.3 },
    wire: { messages: wireSimple, maxTokens: 1200 },
  },
  {
    label: "agent loop, tools, auto, non-streaming",
    ir: { messages: TOOL_LOOP, tools: TOOLS, toolChoice: "auto", maxTokens: 2048, temperature: 0.3 },
    wire: { messages: wireLoop, maxTokens: 2048, toolChoice: "auto", tools: wireTools },
  },
  {
    label: "agent loop, tools, auto, STREAMING",
    ir: { messages: TOOL_LOOP, tools: TOOLS, toolChoice: "auto", maxTokens: 2048, temperature: 0.3, stream: true },
    wire: { messages: wireLoop, maxTokens: 2048, toolChoice: "auto", tools: wireTools, stream: true },
  },
  {
    label: "tool_choice none — tools omitted entirely, not sent empty",
    ir: { messages: TOOL_LOOP, tools: TOOLS, toolChoice: "none", maxTokens: 2048, temperature: 0.3 },
    wire: { messages: wireLoop, maxTokens: 2048, toolChoice: "none", tools: wireTools },
  },
  {
    label: "forced tool (the askUser card)",
    ir: { messages: TOOL_LOOP, tools: TOOLS, toolChoice: { forceTool: "askUser" }, maxTokens: 2048, temperature: 0.3 },
    wire: { messages: wireLoop, maxTokens: 2048, toolChoice: { type: "function", function: { name: "askUser" } }, tools: wireTools },
  },
];

for (const c of CASES) {
  const fromIr = toOpenAiBody(c.ir, MODEL);
  const fromTransport = buildChatBody(c.wire);
  /* buildChatBody reads AGENT_MODEL from env; normalise that one field so the
     comparison is about SHAPE, which is what could drift. */
  const a = { ...fromIr, model: MODEL };
  const b = { ...fromTransport, model: MODEL };
  const same = j(a) === j(b);
  check(`${c.label}${same ? "" : `\n      ir:        ${j(a)}\n      transport: ${j(b)}`}`, same);
}

console.log("\n── 4. Shape details the differential test is pinning ──");
{
  const none = toOpenAiBody({ messages: SIMPLE, tools: TOOLS, toolChoice: "none", maxTokens: 100, temperature: 0.3 }, MODEL);
  check("tool_choice none omits `tools` entirely", !("tools" in none) && !("tool_choice" in none));
  const plain = toOpenAiBody({ messages: SIMPLE, maxTokens: 100, temperature: 0.3 }, MODEL);
  check("a non-streaming call has no `stream` key at all, not stream:false", !("stream" in plain));
  /* This assertion originally claimed the OPPOSITE — that a tool-less call
     defaults to auto with an empty list. It was asserting the bug the
     differential test then caught on the fast path. */
  check("a call with NO tools sends neither key — the fast path stays as it is", !("tools" in plain) && !("tool_choice" in plain));
  const emptyTools = toOpenAiBody({ messages: SIMPLE, tools: [], maxTokens: 100, temperature: 0.3 }, MODEL);
  check("an explicitly EMPTY tool list is different from no tools, and does send both keys", j(emptyTools.tools) === "[]" && emptyTools.tool_choice === "auto");
  const streamed = toOpenAiBody({ messages: SIMPLE, maxTokens: 100, temperature: 0.3, stream: true }, MODEL);
  check("a streaming call sets stream: true", streamed.stream === true);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("Section 3 is a differential against the live transport, not a description of it.");
