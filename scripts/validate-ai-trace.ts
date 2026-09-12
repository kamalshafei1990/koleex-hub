/* ---------------------------------------------------------------------------
   validate:ai-trace — plan G1: a trace id per turn and per call, time to
   first token beside the total, tool durations, and the reader that turns a
   week of those lines into percentiles and error rates.

   Two halves. The reader is pure and is fed lines here — including lines
   with a drain's timestamp in front, lines from before the fields existed,
   and lines that are not ours. The writers are pinned in source: the route
   mints ONE id and puts it on every [ai] line including the failed turn's,
   the orchestrator and the general lane's hop write the same [ai.tool] line
   through one function, the fast lanes meter their calls, and a voice call
   carries its own id on every beacon.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import {
  newTraceId,
  traceFields,
  formatToolLine,
  parseAiLine,
  parseToolLine,
  percentiles,
  summarizeTurns,
  formatTurnReport,
} from "../src/lib/server/ai/observability/turn-trace";
import { newCallId } from "../src/lib/voice/session";

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
const read = (p: string) => readFileSync(p, "utf8");
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("\n── 1. Ids ──");
{
  const a = newTraceId();
  const b = newTraceId();
  check("a trace id is twelve hex characters", /^[0-9a-f]{12}$/.test(a));
  check("two turns get two ids", a !== b);
  const c = newCallId();
  check("a call id is ten hex characters", /^[0-9a-f]{10}$/.test(c));
  check("a call id and a trace id cannot be confused for one another (different lengths)", c.length !== a.length);
}

console.log("\n── 2. The fields the writers append ──");
{
  check("streamed turn: ttft, ok and trace, in that order", traceFields({ trace: "abc123abc123", ttftMs: 412.6, ok: true }) === " ttft=413 ok=1 trace=abc123abc123");
  check("a turn that never streamed prints ttft=-", traceFields({ trace: "t", ttftMs: null, ok: true }) === " ttft=- ok=1 trace=t");
  check("a failed turn prints ok=0", / ok=0 /.test(traceFields({ trace: "t", ttftMs: 10, ok: false })));
  check("a negative clock skew cannot print a negative ttft", / ttft=0 /.test(traceFields({ trace: "t", ttftMs: -5, ok: true })));
  const tool = formatToolLine({ tool: "search_web", ms: 1234.4, ok: true, status: "allowed", trace: "abc" });
  check("a tool line: prefix, name, ms, ok, status, trace", tool === "[ai.tool] tool=search_web ms=1234 ok=1 status=allowed trace=abc");
  check("a tool line never carries free text: the name is reduced to word characters", formatToolLine({ tool: "x y; drop table", ms: 1, ok: false, status: "denied", trace: null }).startsWith("[ai.tool] tool=xydroptable ms=1 ok=0 status=denied trace=-"));
}

console.log("\n── 3. The reader ──");
{
  const t = parseAiLine("2026-09-11T21:07:02.650Z info [ai] lane=general ep=agent provider=deepseek:fast-general intent=agent fallback=0 fast_stream=1 fast_search=0 msg_lang=ar rewrote_egy=0 in_bytes=42 hist=6 ms=1830 stream=1 reply_bytes=312 ttft=640 ok=1 trace=0a1b2c3d4e5f");
  check("an [ai] line with a drain's prefix parses: lane, provider, ms, ttft, ok, trace",
    t !== null && t.lane === "general" && t.provider === "deepseek:fast-general" && t.ms === 1830 && t.ttft === 640 && t.ok && t.trace === "0a1b2c3d4e5f");
  const old = parseAiLine("[ai] lane=protected ep=agent provider=deepseek:deepseek-chat intent=agent fallback=0 in_bytes=10 hist=0 ms=900");
  check("a line from before the fields existed is a completed turn with no ttft", old !== null && old.ok && old.ttft === null && old.trace === null && old.ms === 900);
  check("a failed turn's line parses as ok=false", parseAiLine("[ai] lane=general ep=agent provider=none intent=agent fallback=0 in_bytes=1 hist=0 ms=50 stream=1 ttft=- ok=0 trace=x")?.ok === false);
  check("a line that is not ours is null, not an error", parseAiLine("[ai.usage] day=2026-09-11 lane=agent ms=100") === null && parseAiLine("hello") === null && parseAiLine("[ai] lane=x") === null);
  const tool = parseToolLine("[ai.tool] tool=searchProducts ms=310 ok=1 status=allowed trace=abc");
  check("a tool line parses", tool !== null && tool.tool === "searchProducts" && tool.ms === 310 && tool.ok && tool.trace === "abc");

  const p = percentiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  check("nearest-rank percentiles of 1..10: p50 5, p90 9, p99 10, max 10", p !== null && p.p50 === 5 && p.p90 === 9 && p.p99 === 10 && p.max === 10 && p.n === 10);
  check("one sample: every percentile is that sample", JSON.stringify(percentiles([7])) === JSON.stringify({ n: 1, p50: 7, p90: 7, p99: 7, max: 7 }));
  check("two samples: p50 is the lower (rank rounds up to the first that covers half)", percentiles([2, 1])?.p50 === 1);
  check("no samples is null, not zero", percentiles([]) === null);
  check("the input is not sorted in place", (() => { const a = [3, 1, 2]; percentiles(a); return a.join() === "3,1,2"; })());

  const lines = [
    "[ai] lane=general ep=agent provider=deepseek:fast-general intent=agent ms=1000 ttft=300 ok=1 trace=a",
    "[ai] lane=general ep=agent provider=deepseek:fast-general intent=agent ms=3000 ttft=900 ok=1 trace=b",
    "[ai] lane=general ep=agent provider=none intent=agent ms=50 ttft=- ok=0 trace=c",
    "[ai] lane=protected ep=agent provider=groq:llama intent=agent ms=5000 ttft=- ok=1 trace=d",
    "[ai.tool] tool=search_web ms=700 ok=1 status=allowed trace=b",
    "[ai.tool] tool=search_web ms=900 ok=0 status=denied trace=d",
    "[ai.tool] tool=searchProducts ms=120 ok=1 status=allowed trace=d",
    "[ai.usage] day=2026-09-11 lane=agent provider=groq model=llama in=1 out=2 cost_usd=- ms=5000 unknown=0 trace=d",
    "unrelated line",
  ];
  const r = summarizeTurns(lines);
  check("four turns counted; usage and unrelated lines ignored", r.turns === 4);
  const general = r.byLane.find((g) => g.key === "general");
  check("by lane: general has 3 turns, 1 failed, error rate a third", general !== undefined && general.turns === 3 && general.errors === 1 && Math.abs(general.errorRate - 1 / 3) < 1e-9);
  check("latency percentiles are over the COMPLETED turns only (the failure's 50 ms is not a latency)", general?.ms?.n === 2 && general?.ms?.p50 === 1000 && general?.ms?.max === 3000);
  check("first-token percentiles are over the turns that streamed", general?.ttft?.n === 2 && general?.ttft?.p90 === 900);
  check("a lane that never streamed has no first-token samples", r.byLane.find((g) => g.key === "protected")?.ttft === null);
  check("by provider: the provider half only, so two lanes of one provider are one row", r.byProvider.map((g) => g.key).sort().join() === "deepseek,groq,none");
  check("lanes are ordered by turn count", r.byLane[0].key === "general");
  const sw = r.tools.find((t) => t.tool === "search_web");
  check("tools: search_web ran twice, failed once, p50 700", sw !== undefined && sw.runs === 2 && sw.failures === 1 && sw.ms?.p50 === 700);
  check("tools are ordered by run count", r.tools[0].tool === "search_web");
  const text = formatTurnReport(r);
  check("the report is plain text with the groupings named", /turns: 4/.test(text) && /by lane/.test(text) && /by provider/.test(text) && /tools/.test(text) && /general: 3 turns, 1 failed \(33\.3%\)/.test(text));
  check("the report carries only what the lines carried — no prompt, no reply, no argument", !/hello|drop|query=/.test(text));
  check("an empty bag is an empty report, not a throw", formatTurnReport(summarizeTurns([])).startsWith("turns: 0"));
}

console.log("\n── 4. The writers, pinned in source ──");
{
  const route = stripComments(read("src/app/api/ai/agent/route.ts"));
  check("the route mints ONE trace id at the top of the request", (route.match(/newTraceId\(\)/g) ?? []).length === 1 && /const t0 = Date\.now\(\);\s*const trace = newTraceId\(\);/.test(route));
  const aiLines = route.match(/`\[ai\] lane=[\s\S]*?\);/g) ?? [];
  check(`every [ai] line the route writes carries the trace fields (${aiLines.length} lines)`, aiLines.length >= 4 && aiLines.every((l) => /traceFields\(\{ trace, ttftMs:/.test(l)));
  check("the failed turn writes an [ai] line with ok: false", /traceFields\(\{ trace, ttftMs: tFirst === null \? null : tFirst - t0, ok: false \}\)/.test(route));
  check("first token: the fast lane and the tool loop both stamp the first delta", (route.match(/if \(tFirst === null\) tFirst = Date\.now\(\);/g) ?? []).length === 2);
  check("the trace goes to orchestrate on both paths and to the general lane's hop", (route.match(/traceId: trace,/g) ?? []).length >= 3);
  check("the fast lanes meter their calls with this turn's trace, through the meter (no provider value written in the route)", /const meter = \(o: Awaited<ReturnType<typeof chatWithTools>>, lane: string\) =>\s*meterTurn\(o, \{ tenantId: auth\.tenant_id \?\? null, accountId: auth\.account_id \?\? null, lane, traceId: trace \}\);/.test(route) && /meter\(out, `fast-\$\{fastLane\}`\);/.test(route) && /meter\(out, "fast-general\+search"\);/.test(route));

  const orch = stripComments(read("src/lib/server/ai-agent/orchestrator.ts"));
  check("the orchestrator's usage lines carry the turn's trace, the conversation id standing in", (orch.match(/traceId: traceId \?\? conversationId,/g) ?? []).length === 2 && !/traceId: conversationId,/.test(orch));
  check("the orchestrator times every tool run and writes the [ai.tool] line through logToolRun", /const tTool = Date\.now\(\);\s*const result = await koleexHub\.invoke\(/.test(orch) && /logToolRun\(\{ tool: tc\.function\.name, ms: Date\.now\(\) - tTool, ok: result\.ok, status: result\.permissionStatus, trace: traceId \?\? conversationId \}\)/.test(orch));
  const general = stripComments(read("src/lib/server/ai/core/general-search.ts"));
  check("the general lane's hop writes the same line through the same function", /logToolRun\(\{ tool: call\.name, ms: Date\.now\(\) - tTool, ok: result\.ok, status: result\.permissionStatus, trace: input\.traceId \?\? input\.conversationId \}\)/.test(general));
  const trace = read("src/lib/server/ai/observability/turn-trace.ts");
  check("the trace module is pure: no server-only import, so the suite and the report script can import it", !/^import "server-only"/m.test(trace));
  check("the trace module writes exactly one console line kind (the tool line)", (stripComments(trace).match(/console\.\w+\(/g) ?? []).length === 1);
  const types = read("src/lib/server/ai/core/types.ts");
  check("TurnInput carries the optional trace id", /traceId\?: string \| null;/.test(types));

  const session = stripComments(read("src/lib/voice/session.ts"));
  check("a voice call mints its id when it starts and puts it on its diagnostics", /this\.startedAt = Date\.now\(\);\s*this\.callId = newCallId\(\);/.test(session) && /call: this\.callId,/.test(session));
  const beaconRoute = read("src/app/api/ai/voice/telemetry/route.ts");
  check("the beacon route logs the call id, bounded", /` call=\$\{short\(body\.call, 12\)\}`/.test(beaconRoute));
  check("the beacon type names the field", /call\?: string;/.test(read("src/lib/voice/telemetry.ts")));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("One id per turn and per call, on every line; the lines read back as percentiles.");
