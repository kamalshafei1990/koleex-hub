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

console.log("\n── 3. Differential: the IR produces the bytes we have always sent ──");
/* Until Phase 4A there were TWO body builders. `buildChatBody()` in the
   transport was what actually went over the wire; `toOpenAiBody()` in the IR
   produced the same thing and NOTHING CALLED IT. This section used to compare
   the two against each other.

   4A deleted the transport's builder and put the IR's one on the live path.
   Comparing it against a re-implementation would now only prove that the
   re-implementation agrees with itself, so the reference changed instead: the
   strings below are RECORDED OUTPUT, dumped from `buildChatBody()` at commit
   97e18e2 (the last commit before 4A) and pasted here verbatim.

   That keeps this a real differential — against what the product actually
   sent — while removing the duplicate builder. It also raises the stakes in
   the right direction: editing a golden is now an explicit statement that the
   wire format changed, which is precisely the decision that must never happen
   by accident. */
const MODEL = "deepseek-chat";

const GOLDEN: Record<string, string> = {
  "plain small-talk call (no tools, 160 tokens)":
    "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"system\",\"content\":\"You are Koleex AI.\"},{\"role\":\"user\",\"content\":\"hello\"}],\"temperature\":0.3,\"max_tokens\":160}",
  "brand call (no tools, 1200 tokens)":
    "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"system\",\"content\":\"You are Koleex AI.\"},{\"role\":\"user\",\"content\":\"hello\"}],\"temperature\":0.3,\"max_tokens\":1200}",
  "agent loop, tools, auto, non-streaming":
    "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"system\",\"content\":\"You are Koleex AI.\"},{\"role\":\"user\",\"content\":\"which spreading machine?\"},{\"role\":\"assistant\",\"content\":null,\"tool_calls\":[{\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"searchProducts\",\"arguments\":\"{\\\"q\\\":\\\"spreading\\\"}\"}},{\"id\":\"call_2\",\"type\":\"function\",\"function\":{\"name\":\"askUser\",\"arguments\":\"{\\\"question\\\":\\\"width?\\\"}\"}}]},{\"role\":\"tool\",\"content\":\"{\\\"rows\\\":3}\",\"tool_call_id\":\"call_1\",\"name\":\"searchProducts\"},{\"role\":\"tool\",\"content\":\"{\\\"asked\\\":true}\",\"tool_call_id\":\"call_2\",\"name\":\"askUser\"},{\"role\":\"assistant\",\"content\":\"Three widths are available.\"}],\"temperature\":0.3,\"max_tokens\":2048,\"tools\":[{\"type\":\"function\",\"function\":{\"name\":\"searchProducts\",\"description\":\"Find products.\",\"parameters\":{\"type\":\"object\",\"properties\":{\"q\":{\"type\":\"string\"}},\"required\":[\"q\"]}}},{\"type\":\"function\",\"function\":{\"name\":\"askUser\",\"description\":\"Ask a clarifying question.\",\"parameters\":{\"type\":\"object\",\"properties\":{\"question\":{\"type\":\"string\"}}}}}],\"tool_choice\":\"auto\"}",
  "agent loop, tools, auto, STREAMING":
    "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"system\",\"content\":\"You are Koleex AI.\"},{\"role\":\"user\",\"content\":\"which spreading machine?\"},{\"role\":\"assistant\",\"content\":null,\"tool_calls\":[{\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"searchProducts\",\"arguments\":\"{\\\"q\\\":\\\"spreading\\\"}\"}},{\"id\":\"call_2\",\"type\":\"function\",\"function\":{\"name\":\"askUser\",\"arguments\":\"{\\\"question\\\":\\\"width?\\\"}\"}}]},{\"role\":\"tool\",\"content\":\"{\\\"rows\\\":3}\",\"tool_call_id\":\"call_1\",\"name\":\"searchProducts\"},{\"role\":\"tool\",\"content\":\"{\\\"asked\\\":true}\",\"tool_call_id\":\"call_2\",\"name\":\"askUser\"},{\"role\":\"assistant\",\"content\":\"Three widths are available.\"}],\"temperature\":0.3,\"max_tokens\":2048,\"stream\":true,\"tools\":[{\"type\":\"function\",\"function\":{\"name\":\"searchProducts\",\"description\":\"Find products.\",\"parameters\":{\"type\":\"object\",\"properties\":{\"q\":{\"type\":\"string\"}},\"required\":[\"q\"]}}},{\"type\":\"function\",\"function\":{\"name\":\"askUser\",\"description\":\"Ask a clarifying question.\",\"parameters\":{\"type\":\"object\",\"properties\":{\"question\":{\"type\":\"string\"}}}}}],\"tool_choice\":\"auto\"}",
  "tool_choice none \u2014 tools omitted entirely, not sent empty":
    "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"system\",\"content\":\"You are Koleex AI.\"},{\"role\":\"user\",\"content\":\"which spreading machine?\"},{\"role\":\"assistant\",\"content\":null,\"tool_calls\":[{\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"searchProducts\",\"arguments\":\"{\\\"q\\\":\\\"spreading\\\"}\"}},{\"id\":\"call_2\",\"type\":\"function\",\"function\":{\"name\":\"askUser\",\"arguments\":\"{\\\"question\\\":\\\"width?\\\"}\"}}]},{\"role\":\"tool\",\"content\":\"{\\\"rows\\\":3}\",\"tool_call_id\":\"call_1\",\"name\":\"searchProducts\"},{\"role\":\"tool\",\"content\":\"{\\\"asked\\\":true}\",\"tool_call_id\":\"call_2\",\"name\":\"askUser\"},{\"role\":\"assistant\",\"content\":\"Three widths are available.\"}],\"temperature\":0.3,\"max_tokens\":2048}",
  "forced tool (the askUser card)":
    "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"system\",\"content\":\"You are Koleex AI.\"},{\"role\":\"user\",\"content\":\"which spreading machine?\"},{\"role\":\"assistant\",\"content\":null,\"tool_calls\":[{\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"searchProducts\",\"arguments\":\"{\\\"q\\\":\\\"spreading\\\"}\"}},{\"id\":\"call_2\",\"type\":\"function\",\"function\":{\"name\":\"askUser\",\"arguments\":\"{\\\"question\\\":\\\"width?\\\"}\"}}]},{\"role\":\"tool\",\"content\":\"{\\\"rows\\\":3}\",\"tool_call_id\":\"call_1\",\"name\":\"searchProducts\"},{\"role\":\"tool\",\"content\":\"{\\\"asked\\\":true}\",\"tool_call_id\":\"call_2\",\"name\":\"askUser\"},{\"role\":\"assistant\",\"content\":\"Three widths are available.\"}],\"temperature\":0.3,\"max_tokens\":2048,\"tools\":[{\"type\":\"function\",\"function\":{\"name\":\"searchProducts\",\"description\":\"Find products.\",\"parameters\":{\"type\":\"object\",\"properties\":{\"q\":{\"type\":\"string\"}},\"required\":[\"q\"]}}},{\"type\":\"function\",\"function\":{\"name\":\"askUser\",\"description\":\"Ask a clarifying question.\",\"parameters\":{\"type\":\"object\",\"properties\":{\"question\":{\"type\":\"string\"}}}}}],\"tool_choice\":{\"type\":\"function\",\"function\":{\"name\":\"askUser\"}}}",
};

type Case = { label: string; ir: TurnRequest };

const CASES: Case[] = [
  {
    label: "plain small-talk call (no tools, 160 tokens)",
    ir: { messages: SIMPLE, maxTokens: 160, temperature: 0.3 },
  },
  {
    label: "brand call (no tools, 1200 tokens)",
    ir: { messages: SIMPLE, maxTokens: 1200, temperature: 0.3 },
  },
  {
    label: "agent loop, tools, auto, non-streaming",
    ir: { messages: TOOL_LOOP, tools: TOOLS, toolChoice: "auto", maxTokens: 2048, temperature: 0.3 },
  },
  {
    label: "agent loop, tools, auto, STREAMING",
    ir: { messages: TOOL_LOOP, tools: TOOLS, toolChoice: "auto", maxTokens: 2048, temperature: 0.3, stream: true },
  },
  {
    label: "tool_choice none \u2014 tools omitted entirely, not sent empty",
    ir: { messages: TOOL_LOOP, tools: TOOLS, toolChoice: "none", maxTokens: 2048, temperature: 0.3 },
  },
  {
    label: "forced tool (the askUser card)",
    ir: { messages: TOOL_LOOP, tools: TOOLS, toolChoice: { forceTool: "askUser" }, maxTokens: 2048, temperature: 0.3 },
  },
];

for (const c of CASES) {
  const got = JSON.stringify(toOpenAiBody(c.ir, MODEL));
  const want = GOLDEN[c.label];
  const same = got === want;
  check(
    `${c.label}${same ? "" : `\n      sent today: ${got}\n      recorded:   ${want ?? "(no golden for this label)"}`}`,
    same,
  );
}

/* Non-vacuity. A renamed case would look up an absent golden, and `got ===
   undefined` is false so the case above WOULD fail — but a DELETED case would
   simply stop being checked and the suite would still say all green. Pin the
   two sets against each other so neither side can shrink quietly. */
{
  const caseLabels = new Set(CASES.map((c) => c.label));
  const goldenLabels = new Set(Object.keys(GOLDEN));
  const missing = [...goldenLabels].filter((l) => !caseLabels.has(l));
  const extra = [...caseLabels].filter((l) => !goldenLabels.has(l));
  check(
    `every recorded golden is still exercised by a case${missing.length ? ` — orphaned: ${missing.join(", ")}` : ""}${extra.length ? ` — ungolden: ${extra.join(", ")}` : ""}`,
    missing.length === 0 && extra.length === 0,
  );
  check(
    "and there are still six of them, so the matrix cannot be emptied",
    CASES.length === 6 && goldenLabels.size === 6,
  );
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
console.log("Section 3 compares the live body builder against bytes recorded from the pre-4A transport.");
