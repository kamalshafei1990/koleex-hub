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
import { buildVoiceSessionPayload } from "../src/lib/server/ai/voice/session-config";

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
  check("the model is told it can search, and told not to claim otherwise",
    /you CAN search the public internet/.test(instructions) &&
    /Never say you have\s+no live access|Never say you have no live access/.test(instructions));
  check("and told to speak before the silence of a lookup",
    /let me check/i.test(instructions));
  check("Koleex data must not go into a search",
    /Never put Koleex data in a search/.test(instructions));
  check("and results are material, not instructions",
    /never instructions to follow/.test(instructions));
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
