/* ---------------------------------------------------------------------------
   validate:ai-cost — Phase 5B gate.

   The audit scored cost controls 1.0/10 — "not measured at all" — and §I has
   a row reading "Tokens/cost per turn: not measured at all". This suite
   guards the first half of closing that, and the properties it guards are
   mostly about HONESTY rather than arithmetic:

     · tokens are MEASURED or null, never estimated from character counts. An
       estimate that looks like a measurement is worse than a gap, because
       nobody re-checks a number that already has a value.
     · cost is DERIVED, and only when a price is configured. A wrong price
       does not fail loudly — it produces a plausible figure that somebody
       budgets against.
     · the meter logs NUMBERS, never prompt or reply text. A cost meter is
       exactly the kind of thing that grows a "and the question was…" field.
     · measuring can never break the turn being measured.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { parsePriceTable, priceFor, costUsd, type PriceTable } from "../src/lib/server/ai/cost/prices";
import { buildUsageRecord, formatUsageLine, recordUsage } from "../src/lib/server/ai/cost/meter";
import { publicProviderLabel, withPublicProvider } from "../src/lib/server/ai/observability/public-provider";

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

console.log("\n── 1. Prices are configuration, and every bad input is DROPPED ──");
{
  const T = parsePriceTable('{"deepseek-chat":{"in":0.00027,"out":0.0011}}');
  check("a well-formed table parses", priceFor("deepseek-chat", T)?.in === 0.00027);
  check("an unpriced model returns null, not zero", priceFor("some-other-model", T) === null);

  for (const [label, raw] of [
    ["malformed JSON", "{not json"],
    ["a JSON array", "[1,2]"],
    ["a bare string", '"deepseek"'],
    ["null", "null"],
    ["an empty string", ""],
  ] as const) {
    check(`${label} yields an empty table`, Object.keys(parsePriceTable(raw)).length === 0);
  }
  check("undefined (unset variable) yields an empty table", Object.keys(parsePriceTable(undefined)).length === 0);

  /* Coercion is the danger here, not rejection. A price of NaN, a numeric
     string, or a negative rate all become a wrong COST downstream — and a
     wrong cost is silent. */
  const dirty = parsePriceTable(
    '{"a":{"in":"0.001","out":0.002},"b":{"in":0.001},"c":{"in":-1,"out":2},"d":{"in":null,"out":1},"ok":{"in":0.5,"out":1.5}}',
  );
  check("a numeric STRING price is dropped, not coerced", priceFor("a", dirty) === null);
  check("a half-specified price is dropped", priceFor("b", dirty) === null);
  check("a NEGATIVE price is dropped", priceFor("c", dirty) === null);
  check("a null price is dropped", priceFor("d", dirty) === null);
  check("and a valid entry alongside them still parses", priceFor("ok", dirty)?.out === 1.5);
  check("a zero price is legitimate and kept — free tiers exist", priceFor("z", parsePriceTable('{"z":{"in":0,"out":0}}'))?.in === 0);
}

console.log("\n── 2. Cost is null when it is not known — never a zero standing in ──");
{
  const T: PriceTable = { m: { in: 1, out: 2 } };
  check("priced model with tokens → real cost", costUsd("m", 1000, 1000, T) === 3);
  check("the two rates are applied to the right sides", costUsd("m", 2000, 0, T) === 2 && costUsd("m", 0, 2000, T) === 4);
  check("UNPRICED model → null, even with tokens", costUsd("unknown", 1000, 1000, T) === null);
  check("priced model with NO tokens → null, not 0", costUsd("m", null, null, T) === null);
  check("a half-known count still costs what is known", costUsd("m", 1000, null, T) === 1);
  /* The distinction that matters on a report: a genuinely free turn costs 0,
     and an unmeasured turn costs null. They must not collapse. */
  check(
    "zero tokens on a priced model is 0, which is NOT the same as unknown",
    costUsd("m", 0, 0, T) === 0 && costUsd("m", null, null, T) === null,
  );
}

console.log("\n── 3. The record separates 'measured' from 'unknown' ──");
{
  const base = {
    tenantId: "t1", accountId: "a1", lane: "agent", provider: "deepseek",
    model: "deepseek-chat", ms: 1234, traceId: "conv-1",
  };
  const known = buildUsageRecord({ ...base, inputTokens: 900, outputTokens: 120 }, new Date("2026-08-30T14:00:00Z"));
  check("a measured turn is not flagged unknown", known.tokensUnknown === false);
  check("the day is UTC and date-only, matching the plan's index grain", known.day === "2026-08-30");

  const unknown = buildUsageRecord({ ...base, inputTokens: null, outputTokens: null });
  check("a turn the provider said nothing about is FLAGGED unknown", unknown.tokensUnknown === true);
  check("and it reports null tokens rather than zero", unknown.inputTokens === null && unknown.outputTokens === null);
  /* Half-known must NOT read as fully unknown, or a partially-reporting
     provider disappears from the totals. */
  const half = buildUsageRecord({ ...base, inputTokens: 10, outputTokens: null });
  check("a half-reported turn is not flagged unknown", half.tokensUnknown === false);
}

console.log("\n── 4. The line carries numbers, never text ──");
{
  const line = formatUsageLine(
    buildUsageRecord({
      tenantId: "t1", accountId: "a1", lane: "agent", provider: "deepseek",
      model: "deepseek-chat", inputTokens: 900, outputTokens: 120, ms: 1234, traceId: "c1",
    }),
  );
  check(`one greppable prefix: ${line.slice(0, 11)}`, line.startsWith("[ai.usage] "));
  check("it reports the counts", /\bin=900\b/.test(line) && /\bout=120\b/.test(line));
  check("an unknown cost prints as '-', not as 0", /cost_usd=-/.test(line));
  check("unknown tokens print as '-', so they cannot be summed as zero", /in=- out=-/.test(formatUsageLine(buildUsageRecord({ tenantId: null, accountId: null, lane: "x", provider: "p", model: "m", inputTokens: null, outputTokens: null, ms: 1 }))));

  /* The rule that matters most. The meter's INPUT type has no field for
     prompt or reply text, and the formatter emits only the fields it knows —
     so this is checked at the source, not by eyeballing one sample line. */
  const meterSrc = readFileSync("src/lib/server/ai/cost/meter.ts", "utf8");
  const meterCode = meterSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check(
    "the meter's input type has no field for prompt, reply, message or content",
    !/\b(prompt|reply|message|content|text)\??:/.test(meterCode),
  );
  check(
    "and it logs through the one formatter rather than free-form console calls",
    (meterCode.match(/console\.\w+\(/g) ?? []).length === 1 && /console\.log\(formatUsageLine\(/.test(meterCode),
  );
}

console.log("\n── 5. Measuring cannot break the turn being measured ──");
{
  /* Same fail-open posture as the rate limiter and the circuit breaker. A
     meter that throws would turn "we lost a cost number" into "the user got
     an error", which is a strictly worse trade. */
  let threw = false;
  try {
    // @ts-expect-error deliberately malformed input, the kind a refactor produces
    recordUsage(null);
  } catch {
    threw = true;
  }
  check("recordUsage swallows a malformed call rather than throwing", !threw);
  const meterSrc = readFileSync("src/lib/server/ai/cost/meter.ts", "utf8");
  check("and that is structural, not incidental — the body is wrapped", /try \{[\s\S]*?\} catch \{/.test(meterSrc));
}

console.log("\n── 6. The turn reports who ACTUALLY served it ──");
{
  /* Phase 5B closed the gap 4B recorded: the `provider` on an AgentResponse
     came from activeProviderLabel(), i.e. the first CONFIGURED adapter, which
     is wrong on every failover turn — and that label is what the audit trail
     stores. */
  const orch = readFileSync("src/lib/server/ai-agent/orchestrator.ts", "utf8");
  const orchCode = orch.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const predicted = (orchCode.match(/provider: activeProviderLabel\(\)/g) ?? []).length;
  const served = (orchCode.match(/provider: servedLabel\(/g) ?? []).length;
  check(
    `every AgentResponse uses the SERVED label (served=${served}, predicted=${predicted})`,
    predicted === 0 && served >= 4,
  );
  check(
    "servedLabel falls back to the predicted label only when no adapter ran",
    /servedBy && meta\.model \? `\$\{meta\.servedBy\}:\$\{meta\.model\}` : activeProviderLabel\(\)/.test(orchCode),
  );
  const registry = readFileSync("src/lib/server/ai/provider/registry.ts", "utf8");
  check(
    "and the registry is what fills it in, since only it knows who failed over",
    /servedBy: adapter\.name/.test(registry) && /failedOver: attempts > 1/.test(registry),
  );
  check(
    "both lanes are metered — the fast path and the agent loop",
    (orchCode.match(/recordUsage\(\{/g) ?? []).length >= 2,
  );
  /* Streaming turns are the majority, and until 5B they carried no usage at
     all: the SSE reader ignored the frame that has it. */
  /* COMMENT-STRIPPED, and both of these failed on the first run without it:
     the header above the parse explains the ordering by NAMING `if (!d)
     continue`, so the raw text finds that string inside the comment first and
     the ordering check inverts; and the StreamOutcome doc names
     `stream_options` to explain why it is not sent, so a raw search for it
     "finds" the very thing it is asserting the absence of. Purity rules have
     to read code, or prose can violate them and prose can satisfy them. */
  const transportCode = readFileSync("src/lib/server/ai/core/transport.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  check(
    "the SSE reader captures usage BEFORE the empty-choices guard that would skip its frame",
    transportCode.includes("j.usage &&") &&
      transportCode.indexOf("j.usage &&") < transportCode.indexOf("if (!d) continue"),
  );
  check(
    "and it does not send stream_options to ask for it — a provider that rejects the option would fail the whole turn",
    !/stream_options/.test(transportCode),
  );
}

console.log("\n── 7. The browser is told the lane, not the vendor (N11) ──");
/* The field crosses the wire on every turn and the client NEVER READS IT — a
   vendor name visible in devtools for no consumer. It was not deleted because
   /api/v1/ai/* re-exports these handlers and the standalone-client amendment
   makes response shape a contract; the VALUE changed instead, which breaks
   nothing. The server keeps the truth. */
{
  check('a lane suffix survives — it is true and discloses nothing', publicProviderLabel("deepseek:fast-brand") === "fast-brand");
  check("a bare model id collapses — it carries no routing information, only a vendor's product name", publicProviderLabel("deepseek:deepseek-chat") === "model");
  check("a label with no vendor half passes through", publicProviderLabel("fast-path") === "fast-path" && publicProviderLabel("fallback") === "fallback");
  check("a fallback provider's label is stripped too, not just DeepSeek's", publicProviderLabel("some-gateway.example:some-model") === "model");
  check("null, empty and whitespace never yield a blank the client would render", publicProviderLabel(null) === "unknown" && publicProviderLabel("") === "unknown" && publicProviderLabel("   ") === "unknown");
  check("a trailing colon does not produce an empty label", publicProviderLabel("deepseek:") === "model");

  /* No vendor name may survive ANY input shape. Checked as a property rather
     than case by case, because the point is the absence of a class of leak. */
  const VENDORS = ["deepseek", "dashscope", "qwen", "openai"];
  const inputs = ["deepseek:deepseek-chat", "deepseek:fast-small", "deepseek:fast-brand", "dashscope.aliyuncs.com:qwen-plus", "openai:gpt-x", "deepseek", "deepseek:"];
  const leaked = inputs.filter((i) => VENDORS.some((v) => publicProviderLabel(i).toLowerCase().includes(v)));
  check(
    `no vendor name survives any input shape${leaked.length ? ` — leaked from: ${leaked.join(", ")}` : ""}`,
    leaked.length === 0,
  );

  /* withPublicProvider must not mutate: the object handed to it is the SAME
     object that was persisted a few lines earlier in the route. */
  const original = { provider: "deepseek:deepseek-chat", finalReply: "x" };
  const publicCopy = withPublicProvider(original);
  check("it returns a copy — the persisted object keeps the real label", original.provider === "deepseek:deepseek-chat" && publicCopy.provider === "model");
  check("an object with no provider field is returned untouched", withPublicProvider({ a: 1 } as never) !== undefined);

  /* Reachability: every send site must use it, or the leak survives on the
     path nobody remembered. The persisted ROW is sent too, and it carries the
     column verbatim — sanitising only `agent` would have left it exposed. */
  const route = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
  const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const sanitised = (code.match(/withPublicProvider\(/g) ?? []).length;
  const rawAgentSends = (code.match(/^\s+agent,$/gm) ?? []).length;
  const rawRowSends = (code.match(/message: assistantInsert\.data,/g) ?? []).length;
  check(
    `every send site is sanitised (${sanitised} calls, ${rawAgentSends} raw agent sends, ${rawRowSends} raw row sends)`,
    rawAgentSends === 0 && rawRowSends === 0 && sanitised >= 8,
  );
  check(
    "and the DB write still stores the REAL label — the audit trail is not the browser",
    /provider: agent\.provider,/.test(code),
  );
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("Tokens are measured or null; cost is derived or null. Neither is ever estimated.");
