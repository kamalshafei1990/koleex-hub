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
import { latencyStats } from "../src/lib/server/ai/observability/latency-stats";
import { parseOpenAiChatResponse } from "../src/lib/server/ai/provider/adapters/deepseek";
import {
  selectAdapter,
  providerConfigured,
  activeProviderLabel,
  pickAdapter,
  chatWithToolsVia,
  shouldTryNextProvider,
} from "../src/lib/server/ai/provider/registry";
import { openAiCompatibleAdapter, parseFallbackConfig, parseExtraBody, diagnoseFallbackConfig } from "../src/lib/server/ai/provider/adapters/openai-compatible";
import { providerRoster } from "../src/lib/server/ai/provider/registry";
import { createBreaker, admissible } from "../src/lib/server/ai/router/circuit-breaker";
import { parseClassMap, resolveModel, MODEL_CLASSES } from "../src/lib/server/ai/router/model-classes";
import type { ProviderAdapter, TurnOutcome } from "../src/lib/server/ai/provider/types";
import { toOpenAiBody } from "../src/lib/server/ai/provider/turn-ir";

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
  /* Phase 4A INVERTS this one, deliberately. In 3B the adapter was a thin
     delegate and the endpoint, model and key all lived in core/transport.ts —
     so "the adapter holds no endpoint or key" was the right rule then. It was
     also what made a second provider impossible: everything the adapter
     delegated to was DeepSeek's. 4A moved vendor identity here, which is what
     an adapter is FOR, and the transport kept only the HTTP.

     So the rule flips, and a new obligation arrives with it. The key is now
     READ in this file, which it was not before, so this is where it can leak.
     Assert both halves: identity is present, and the key never reaches a log,
     an error, or a template string. */
  check(
    "the adapter owns the vendor identity — endpoint, model and key",
    /api\.deepseek\.com/.test(code) && /DEEPSEEK_API_KEY/.test(code),
  );
  check(
    "and the key it now reads is never logged, thrown, or interpolated",
    !/console\.[a-z]+\([^)]*\bkey\b/.test(code) &&
      !/throw new Error\([^)]*\bkey\b/.test(code) &&
      !/\$\{key\}/.test(code),
  );
  check(
    "the Authorization header is still built by the transport, not here",
    !/Authorization/.test(code),
  );
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
   the loop. Phase 4A cleared the structural half of what a REAL one still
   needed: core/transport.ts now takes a URL and a key as arguments instead of
   hard-coding DeepSeek's, so a second adapter is an object, not a refactor.
   What is still outstanding is a key for one — an adapter with no credential
   is inert by construction, since configured() gates on it. Both are
   Phase 4B added the second adapter (adapters/openai-compatible.ts) and the
   failover loop; section 7 below proves both. What is STILL outstanding is a
   key for a real fallback service, so the vendor half remains untested against
   anything live — claiming otherwise would be the "complete because it
   compiles" the project rules forbid.
   What is proved here is that the interface admits a second adapter and that
   selection behaves — with fakes, rather than asserted. */
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


/* Sections 7 and 8 await. tsx compiles these scripts to CJS, where top-level
   await is unavailable, so they run inside one async function and the summary
   waits on it — otherwise the process would print "0 failed" before the async
   checks had run, which is the worst possible failure mode for a test. */
async function asyncChecks() {
  console.log("\n── 7. Failover: the rules, proved with fakes (Phase 4B) ──");
  /* router.ts has carried this comment for months: "If DeepSeek is down, Koleex
     AI is down." Failover is the answer, but a WRONG failover is worse than
     none — it can duplicate a half-written answer on screen, or double the wait
     before showing the same error. Those two rules are the ones proved here.

     Fakes, not the live registry, and deliberately: making a real provider
     return 503 on demand is not something a static suite can do, and a rule this
     consequential should not rest on reading the loop and believing it.

     EVERY case gets a FRESH breaker. Without one they share the module-scope
     breaker, and the failures each case deliberately injects accumulate into
     the next — which is exactly what happened when 4C was wired in: two cases
     started reporting "tried: b" because adapter "a" had been tripped by
     earlier cases. The suite caught it. Shared mutable state between test
     cases makes a suite report the wrong thing in whichever direction is
     least convenient. */
  {
    type Log = string[];
    const mk = (
      name: string,
      configured: boolean,
      outcome: TurnOutcome | ((onDelta?: (t: string) => void) => TurnOutcome),
      log: Log,
    ): ProviderAdapter => ({
      name,
      configured: () => configured,
      model: () => `${name}-1`,
      chat: async (_req, opts) => {
        log.push(name);
        return typeof outcome === "function" ? outcome(opts?.onDelta) : outcome;
      },
    });
    const REQ = { messages: [{ role: "user" as const, content: "hi" }], maxTokens: 10, temperature: 0.3 };
    const OK = (c: string): TurnOutcome => ({ ok: true, response: { content: c, toolCalls: [] } });
    const ERR = (status: number): TurnOutcome => ({ ok: false, status, bodyText: `status ${status}` });

    /* The status table, checked directly rather than inferred from the loop. */
    for (const s of [500, 502, 503, 504, 429, 401, 402, 403, 404]) {
      check(`status ${s} is worth a second provider`, shouldTryNextProvider(s) === true);
    }
    for (const s of [400, 413, 422]) {
      check(`status ${s} is NOT — the request is bad, not the provider`, shouldTryNextProvider(s) === false);
    }

    /* 402 END TO END, not just in the table. It says the account behind this
       provider is out of credit — the single condition a fallback most exists
       to survive — and it was absent from the table, so it stopped the turn
       with a healthy second provider configured and never contacted. Asserted
       through the real loop, because a table entry proves the value and this
       proves the behaviour. */
    {
      const log: Log = [];
      const out = await chatWithToolsVia(
        [mk("primary", true, ERR(402), log), mk("secondary", true, OK("from secondary"), log)],
        REQ,
        { breaker: createBreaker({ failureThreshold: 3, openMs: 30_000, now: () => 0 }) },
      );
      check(
        `an out-of-credit primary hands the turn to the fallback (tried: ${log.join(", ")})`,
        out.ok === true && out.response?.content === "from secondary" && log.length === 2,
      );
    }

    {
      const log: Log = [];
      const out = await chatWithToolsVia(
        [mk("a", true, ERR(503), log), mk("b", true, OK("from b"), log)],
        REQ,
        { failover: true, breaker: createBreaker() },
      );
      check(
        `a 503 on the primary falls through to the secondary (tried: ${log.join(" → ") || "none"})`,
        out.ok && out.response.content === "from b" && log.join(",") === "a,b",
      );
    }
    {
      const log: Log = [];
      const out = await chatWithToolsVia(
        [mk("a", true, ERR(400), log), mk("b", true, OK("from b"), log)],
        REQ,
        { failover: true, breaker: createBreaker() },
      );
      check(
        `a 400 stops at the primary — the secondary is never called (tried: ${log.join(" → ")})`,
        !out.ok && out.status === 400 && log.join(",") === "a",
      );
    }
    {
      /* THE ONE THAT MATTERS MOST. The primary streamed two tokens onto the
         user's screen and then died. Failing over here would append a complete
         second answer to a half-written one. */
      const log: Log = [];
      const seen: string[] = [];
      const out = await chatWithToolsVia(
        [
          mk("a", true, (onDelta) => {
            onDelta?.("Three ");
            onDelta?.("widths ");
            return ERR(502);
          }, log),
          mk("b", true, OK("A COMPLETELY DIFFERENT ANSWER"), log),
        ],
        REQ,
        { failover: true, breaker: createBreaker(), onDelta: (t) => seen.push(t) },
      );
      check(
        `a stream that already emitted tokens does NOT fail over (tried: ${log.join(" → ")}, user saw: ${JSON.stringify(seen.join(""))})`,
        !out.ok && log.join(",") === "a" && seen.join("") === "Three widths ",
      );
    }
    {
      /* …but a stream that died before its FIRST token is safe to retry, and
         must be, or streaming turns would lose failover entirely. */
      const log: Log = [];
      const seen: string[] = [];
      const out = await chatWithToolsVia(
        [mk("a", true, ERR(502), log), mk("b", true, OK("from b"), log)],
        REQ,
        { failover: true, breaker: createBreaker(), onDelta: (t) => seen.push(t) },
      );
      check(
        `a stream that emitted NOTHING still fails over (tried: ${log.join(" → ")})`,
        out.ok && log.join(",") === "a,b" && seen.length === 0,
      );
    }
    {
      const log: Log = [];
      const out = await chatWithToolsVia(
        [mk("a", true, ERR(503), log), mk("b", true, OK("from b"), log)],
        REQ,
        { failover: false, breaker: createBreaker() },
      );
      check(
        `the kill-switch really stops at one provider (tried: ${log.join(" → ")})`,
        !out.ok && out.status === 503 && log.join(",") === "a",
      );
    }
    {
      const log: Log = [];
      const out = await chatWithToolsVia(
        [mk("skipped", false, OK("never"), log), mk("b", true, OK("from b"), log)],
        REQ,
        { failover: true, breaker: createBreaker() },
      );
      check(
        `an unconfigured adapter is not even attempted (tried: ${log.join(" → ")})`,
        out.ok && log.join(",") === "b",
      );
    }
    {
      const log: Log = [];
      const out = await chatWithToolsVia([mk("x", false, OK("never"), log)], REQ, { failover: true, breaker: createBreaker() });
      check(
        "no configured provider reports 503 rather than throwing, and calls nobody",
        !out.ok && out.status === 503 && out.bodyText === "no AI provider configured" && log.length === 0,
      );
    }
    {
      /* Exhaustion must surface the LAST provider's failure, not a synthetic one
         — the rescue path branches on that status and body. */
      const log: Log = [];
      const out = await chatWithToolsVia(
        [mk("a", true, ERR(503), log), mk("b", true, ERR(429), log)],
        REQ,
        { failover: true, breaker: createBreaker() },
      );
      check(
        `when every provider fails, the LAST real failure is returned (tried: ${log.join(" → ")})`,
        !out.ok && out.status === 429 && out.bodyText === "status 429" && log.join(",") === "a,b",
      );
    }
  }

  console.log("\n── 8. The fallback adapter is configuration, not a hard-coded vendor ──");
  /* The plan named Qwen/DashScope. This environment's egress policy refuses
     CONNECT to dashscope.aliyuncs.com, so its URL and model ids could only have
     been written from memory. A wrong constant in a failover path is worse than
     no failover: it looks configured and it fails exactly when the primary is
     already down. So the vendor became four environment variables, and what is
     asserted here is the VALIDATION — which is the security-bearing part. */
  {
    const OKCFG = {
      AI_FALLBACK_BASE_URL: "https://example-gateway.invalid/compatible-mode/v1",
      AI_FALLBACK_API_KEY: "k",
      AI_FALLBACK_MODEL: "some-model",
    };
    const good = parseFallbackConfig(OKCFG);
    check("a complete config parses", good !== null);
    check(
      "and the chat path is appended to the base url",
      good?.chatUrl === "https://example-gateway.invalid/compatible-mode/v1/chat/completions",
    );
    check(
      "a trailing slash on the base url does not produce a double slash",
      parseFallbackConfig({ ...OKCFG, AI_FALLBACK_BASE_URL: "https://example-gateway.invalid/v1/" })?.chatUrl ===
        "https://example-gateway.invalid/v1/chat/completions",
    );
    check("the label defaults to the host, not to a vendor name", good?.label === "example-gateway.invalid");
    check(
      "an explicit label wins",
      parseFallbackConfig({ ...OKCFG, AI_FALLBACK_LABEL: "cn-gateway" })?.label === "cn-gateway",
    );
    /* The one that protects a credential: an http:// base would put the API key
       on the wire in plaintext. Refuse, do not downgrade. */
    check(
      "a PLAINTEXT base url disables the adapter — the key never travels unencrypted",
      parseFallbackConfig({ ...OKCFG, AI_FALLBACK_BASE_URL: "http://example-gateway.invalid/v1" }) === null,
    );
    check("a malformed url disables it rather than throwing", parseFallbackConfig({ ...OKCFG, AI_FALLBACK_BASE_URL: "not a url" }) === null);
    for (const missing of ["AI_FALLBACK_BASE_URL", "AI_FALLBACK_API_KEY", "AI_FALLBACK_MODEL"] as const) {
      const partial = { ...OKCFG, [missing]: "" };
      check(`without ${missing} the adapter stays unconfigured`, parseFallbackConfig(partial) === null);
    }
    check(
      "with nothing set at all it is inert — which is every environment today",
      parseFallbackConfig({}) === null && openAiCompatibleAdapter.configured() === false,
    );

    /* EXTRA BODY. "OpenAI-compatible" is a family resemblance, not a spec —
       services agree on the turn and differ on one or two switches of their
       own. This is the escape hatch for that, and the assertions are about
       what it must NOT be able to do. */
    check("no extra body is the normal case and yields an empty object", Object.keys(parseExtraBody(undefined)).length === 0 && Object.keys(parseExtraBody("  ")).length === 0);
    check("a vendor switch passes through", parseExtraBody('{"enable_thinking":false}').enable_thinking === false);
    check("several pass through together", Object.keys(parseExtraBody('{"a":1,"b":"x"}')).length === 2);

    /* The turn's own keys are the whole conversation, the tool list and the
       streaming mode. A typo in an env var must not be able to send an empty
       conversation, silently drop the tools — which would present as the model
       refusing to act — or flip streaming and desync the reader. */
    for (const key of ["model", "messages", "tools", "tool_choice", "stream"]) {
      const out = parseExtraBody(`{"${key}":"hijacked","safe":1}`);
      check(`extra body cannot set "${key}" — it is the turn, not a tuning knob`, !(key in out) && out.safe === 1);
    }

    /* Malformed input must never take the fallback provider out of service:
       a stray comma in an optional tuning field turning into NO FAILOVER is a
       far worse outcome than the field being ignored. */
    check("malformed JSON is ignored rather than throwing", Object.keys(parseExtraBody("{not json")).length === 0);
    check("a JSON array is rejected — the merge target is an object", Object.keys(parseExtraBody('[1,2]')).length === 0);
    check("a JSON scalar is rejected too", Object.keys(parseExtraBody('"hello"')).length === 0 && Object.keys(parseExtraBody("42")).length === 0);
    check("null is rejected without throwing", Object.keys(parseExtraBody("null")).length === 0);
    /* Non-vacuity: an adapter that is always unconfigured would pass every
       check above while being incapable of ever serving. Prove the object is
       real and satisfies the same contract the loop calls. */
    check(
      "and it is nonetheless a real adapter, not a stub",
      typeof openAiCompatibleAdapter.chat === "function" &&
        typeof openAiCompatibleAdapter.model === "function" &&
        typeof openAiCompatibleAdapter.name === "string",
    );
    {
      const out = await openAiCompatibleAdapter.chat({ messages: [{ role: "user", content: "x" }], maxTokens: 4, temperature: 0.3 });
      check(
        "an unconfigured call reports 503 through the contract rather than throwing or fetching",
        !out.ok && out.status === 503,
      );
    }
  }

  console.log("\n── 9. The circuit breaker: what makes failover fast (Phase 4C) ──");
  /* 4B's honest caveat was that a dead primary cost ~14s on EVERY turn,
     because its retry ladder ran to exhaustion before the second provider was
     tried. The breaker does not make the FIRST failure fast — nothing can,
     short of removing the ladder that absorbs ordinary rate limits. It makes
     every failure after the first fast, by not starting the ladder at all.

     Time is injected. A breaker tested with real sleeps is a slow test that
     someone eventually marks skip. */
  {
    let clock = 1_000_000;
    const b = createBreaker({ failureThreshold: 3, openMs: 30_000, now: () => clock });

    check("a provider starts closed and is allowed", b.stateOf("p") === "closed" && b.allow("p"));
    b.recordFailure("p");
    b.recordFailure("p");
    check("two failures below the threshold do not open it — a blip is not an outage", b.stateOf("p") === "closed" && b.allow("p"));
    b.recordFailure("p");
    check("the third consecutive failure opens it", b.stateOf("p") === "open" && b.allow("p") === false);

    clock += 29_000;
    check("it stays open for the full cooldown", b.stateOf("p") === "open" && b.allow("p") === false);

    clock += 2_000;
    check("after the cooldown it goes half-open and admits a trial", b.stateOf("p") === "half-open" && b.allow("p") === true);

    /* THE BUG THIS SPLIT EXISTS FOR. Asking must not consume. An earlier
       version took the trial slot inside allow(), so merely FILTERING the
       candidate list spent the one chance a recovering provider had to prove
       itself — on a provider that was then never contacted. */
    check("asking twice is still allowed, because asking does not consume the trial", b.allow("p") === true);
    b.beginAttempt("p");
    check("but TAKING the trial closes the door on a concurrent second request", b.allow("p") === false);

    b.recordFailure("p");
    check("a failed trial re-opens immediately, without re-counting to the threshold", b.stateOf("p") === "open");

    clock += 31_000;
    b.beginAttempt("p");
    b.recordSuccess("p");
    check("a successful trial closes it and clears the count", b.stateOf("p") === "closed" && b.snapshot().p.consecutiveFailures === 0);

    /* Non-consecutive failures must not accumulate into an outage. */
    b.recordFailure("p");
    b.recordFailure("p");
    b.recordSuccess("p");
    b.recordFailure("p");
    b.recordFailure("p");
    check("a success in between resets the count — only CONSECUTIVE failures open it", b.stateOf("p") === "closed");
  }

  {
    /* Decision 2: the breaker must never be able to take the product down by
       itself. If everything is open, everything is tried anyway. */
    const b = createBreaker({ failureThreshold: 1, openMs: 30_000, now: () => 1_000_000 });
    const cands = [{ name: "a" }, { name: "b" }];
    b.recordFailure("a");
    const partial = admissible(cands, b);
    check(
      `with one provider open, only the healthy one is tried (${partial.tryThese.map((c) => c.name).join(",")})`,
      partial.tryThese.length === 1 && partial.tryThese[0].name === "b" && partial.allBlocked === false,
    );
    b.recordFailure("b");
    const blocked = admissible(cands, b);
    check(
      `with EVERY provider open, all of them are tried anyway rather than reporting an outage (${blocked.tryThese.map((c) => c.name).join(",")})`,
      blocked.tryThese.length === 2 && blocked.allBlocked === true,
    );
    check("and preference order is preserved when the breaker is bypassed", blocked.tryThese[0].name === "a");
  }

  {
    /* The property that actually matters, end to end: once the primary has
       tripped, a later turn does not touch it at all. That is the ~14s the
       user stops paying on every subsequent request. */
    const log: string[] = [];
    const mk2 = (name: string, out: TurnOutcome): ProviderAdapter => ({
      name,
      configured: () => true,
      model: () => `${name}-1`,
      chat: async () => {
        log.push(name);
        return out;
      },
    });
    const REQ2 = { messages: [{ role: "user" as const, content: "hi" }], maxTokens: 10, temperature: 0.3 };
    const adapters = [
      mk2("dead", { ok: false, status: 503, bodyText: "down" }),
      mk2("live", { ok: true, response: { content: "served", toolCalls: [] } }),
    ];
    const b = createBreaker({ failureThreshold: 2, openMs: 30_000, now: () => 1 });
    await chatWithToolsVia(adapters, REQ2, { failover: true, breaker: b });
    await chatWithToolsVia(adapters, REQ2, { failover: true, breaker: b });
    const afterTrip = log.length;
    const out = await chatWithToolsVia(adapters, REQ2, { failover: true, breaker: b });
    const thirdTurn = log.slice(afterTrip);
    check(
      `once tripped, the dead provider is not contacted again (third turn tried: ${thirdTurn.join(" → ")})`,
      out.ok && thirdTurn.join(",") === "live",
    );
    check(
      "and the breaker only counts provider faults, so a 400 would not have tripped it",
      shouldTryNextProvider(503) === true && shouldTryNextProvider(400) === false,
    );
  }

  console.log("\n── 10. Model classes: selectable, and safe when unset (Phase 4E) ──");
  /* The plan asks for selectable classes and names nine. Six exist here, and
     the three that do not are the point: EMBEDDING, REALTIME_VOICE and IMAGE
     are not chat completions. They take no `messages` array and return no
     `choices[].message`, so they cannot travel through the Turn IR or the one
     door. An enum listing them that resolved to a chat model would look
     complete and be incapable of working. */
  {
    check(
      `six chat-completion classes are defined (${MODEL_CLASSES.join(", ")})`,
      MODEL_CLASSES.length === 6 && MODEL_CLASSES.includes("FAST") && MODEL_CLASSES.includes("REASONING"),
    );
    check(
      "and the non-chat capabilities are NOT pretended to be routable here",
      !(MODEL_CLASSES as ReadonlyArray<string>).includes("EMBEDDING") &&
        !(MODEL_CLASSES as ReadonlyArray<string>).includes("IMAGE") &&
        !(MODEL_CLASSES as ReadonlyArray<string>).includes("REALTIME_VOICE"),
    );

    const MAP = parseClassMap('{"deepseek":{"REASONING":"deepseek-reasoner","FAST":"deepseek-chat"}}');
    check("a well-formed map parses per adapter", MAP.deepseek?.REASONING === "deepseek-reasoner");
    check("a class with a mapping resolves to it", resolveModel(MAP, "deepseek", "default-model", "REASONING") === "deepseek-reasoner");
    check("a class WITHOUT a mapping falls back to the adapter default", resolveModel(MAP, "deepseek", "default-model", "VISION") === "default-model");
    check("an unknown adapter falls back to its default", resolveModel(MAP, "some-gateway", "default-model", "REASONING") === "default-model");
    check("no class at all is the adapter default", resolveModel(MAP, "deepseek", "default-model") === "default-model");

    /* Every rejection path must land on {} rather than a partial map. A
       half-understood map is worse than none: it routes some classes and
       silently drops others, which shows up as a provider 400 in production
       rather than as a config error at boot. */
    for (const [label, raw] of [
      ["malformed JSON", "{not json"],
      ["a JSON array", "[1,2,3]"],
      ["a bare string", '"deepseek"'],
      ["null", "null"],
      ["an empty string", ""],
    ] as const) {
      check(`${label} yields an empty map, not a partial one`, Object.keys(parseClassMap(raw)).length === 0);
    }
    check("undefined (the variable is unset) yields an empty map", Object.keys(parseClassMap(undefined)).length === 0);
    check(
      "an unset map means every class resolves to the adapter default — today's behaviour exactly",
      MODEL_CLASSES.every((c) => resolveModel({}, "deepseek", "default-model", c) === "default-model"),
    );
    /* Typos and wrong types are dropped, not coerced. `String(undefined)` as a
       model id would reach the provider as the literal "undefined". */
    const dirty = parseClassMap('{"deepseek":{"REASONNING":"typo","FAST":123,"GENERAL":"  ","REASONING":"  spaced  "}}');
    check("an unknown class name is dropped", dirty.deepseek?.["REASONING" as const] !== "typo");
    check("a non-string model id is dropped", resolveModel(dirty, "deepseek", "default-model", "FAST") === "default-model");
    check("a whitespace-only model id is dropped", resolveModel(dirty, "deepseek", "default-model", "GENERAL") === "default-model");
    check("a valid entry alongside bad ones still works, and is trimmed", resolveModel(dirty, "deepseek", "default-model", "REASONING") === "spaced");

    /* The class must not leak into the wire body: adding it cannot be allowed
       to change the bytes the golden differential pins. */
    const withClass = toOpenAiBody(
      { messages: [{ role: "user", content: "hi" }], maxTokens: 10, temperature: 0.3, modelClass: "REASONING" },
      "m",
    );
    const withoutClass = toOpenAiBody(
      { messages: [{ role: "user", content: "hi" }], maxTokens: 10, temperature: 0.3 },
      "m",
    );
    check(
      "modelClass never reaches the request body — the adapter resolves it to `model` instead",
      JSON.stringify(withClass) === JSON.stringify(withoutClass) && !("modelClass" in withClass),
    );

    /* REACHABILITY. Everything above proves the resolver works; none of it
       proves anything CALLS it. A class layer that no turn site sets is a
       feature that exists only in its own test — the "complete because it
       compiles" the project rules forbid. Assert the three real turn sites
       and both adapters. */
    const orchSrc = readFileSync("src/lib/server/ai-agent/orchestrator.ts", "utf8");
    const routeSrc = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
    const dsSrc = readFileSync("src/lib/server/ai/provider/adapters/deepseek.ts", "utf8");
    const fbSrc = readFileSync("src/lib/server/ai/provider/adapters/openai-compatible.ts", "utf8");
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    check(
      "the tool loop asks for REASONING",
      /modelClass: "REASONING"/.test(strip(orchSrc)),
    );
    check(
      "the tool-less fast path asks for FAST or GENERAL by lane",
      /modelClass: isBrand \? "GENERAL" : "FAST"/.test(strip(orchSrc)),
    );
    check(
      "the route's streaming fast lane asks for a class too",
      /modelClass:/.test(strip(routeSrc)),
    );
    check(
      "and BOTH adapters resolve the class rather than one silently ignoring it",
      /modelForClass\(/.test(strip(dsSrc)) && /modelForClass\(/.test(strip(fbSrc)),
    );
  }
}

void asyncChecks().then(() => {
  console.log("\n── Saying WHY the fallback is unconfigured, without saying what ──");
/* The four rejection paths in parseFallbackConfig are indistinguishable from
   outside: a missing key, a missing url, a missing model and a plaintext url
   all produce the same null. An operator who has just set four variables and
   sees `configured: false` would otherwise guess between them.

   The assertions below are mostly about the SECOND half of that sentence —
   this is rendered in a browser, so it may carry variable NAMES and never
   values. */
{
  const OK = { AI_FALLBACK_BASE_URL: "https://gw.example/v1", AI_FALLBACK_MODEL: "m", AI_FALLBACK_API_KEY: "sk-super-secret-value" };

  check("nothing set names all three required variables", diagnoseFallbackConfig({}).length === 3);
  check(
    "a single missing variable is named alone, not buried in a list",
    diagnoseFallbackConfig({ ...OK, AI_FALLBACK_API_KEY: "" }).join("|") === "AI_FALLBACK_API_KEY is not set",
  );
  check(
    "a plaintext url is diagnosed as the protocol, which is the actual rule",
    /not https/.test(diagnoseFallbackConfig({ ...OK, AI_FALLBACK_BASE_URL: "http://gw.example/v1" }).join("|")),
  );
  check(
    "a malformed url is diagnosed rather than throwing",
    /not a valid URL/.test(diagnoseFallbackConfig({ ...OK, AI_FALLBACK_BASE_URL: "not a url" }).join("|")),
  );
  /* The mistake most likely after following a vendor quickstart, which shows
     the full path including /chat/completions. */
  check(
    "a url that already ends in /chat/completions is called out — the adapter appends it",
    /duplicated/.test(diagnoseFallbackConfig({ ...OK, AI_FALLBACK_BASE_URL: "https://gw.example/v1/chat/completions" }).join("|")),
  );
  /* All four present and still unconfigured means the process predates them.
     Without this line an operator has a correct config and no next step. */
  check(
    "a well-formed config that still fails points at the redeploy",
    /redeploy/i.test(diagnoseFallbackConfig(OK).join("|")),
  );

  /* THE SECURITY PROPERTY. Asserted as the absence of a class: no input value
     may appear in the output, whatever it was. */
  const secretish = ["sk-super-secret-value", "gw.example"];
  const out = [
    ...diagnoseFallbackConfig(OK),
    ...diagnoseFallbackConfig({ ...OK, AI_FALLBACK_BASE_URL: "http://gw.example/v1" }),
    ...diagnoseFallbackConfig({ ...OK, AI_FALLBACK_BASE_URL: "https://gw.example/v1/chat/completions" }),
  ].join(" ");
  const leaked = secretish.filter((v) => out.includes(v));
  check(
    `no VALUE is echoed back — only variable names${leaked.length ? ` — leaked: ${leaked.join(", ")}` : ""}`,
    leaked.length === 0,
  );
}

console.log("\n── The roster: an operator can check the fallback WITHOUT breaking the primary ──");
/* A fallback is only ever contacted when the primary fails, so a mistake in
   configuring it is invisible until the moment there is no margin for it. The
   roster exists so "did my four env vars work?" has an answer that does not
   require taking DeepSeek down. Its security property is what it does NOT
   carry. */
{
  const ok = { name: "x", configured: () => true, model: () => "m", chat: async () => ({ ok: false, status: 0, bodyText: "" }) };
  const off = { name: "y", configured: () => false, model: () => "unconfigured", chat: async () => ({ ok: false, status: 0, bodyText: "" }) };
  const roster = providerRoster([ok, off] as never);

  check("it lists EVERY adapter, not only the configured ones", roster.length === 2);
  check(
    "an unconfigured adapter is present and marked false — absence would read as 'not registered'",
    roster[1]?.name === "y" && roster[1]?.configured === false,
  );
  check("a configured adapter reports its model", roster[0]?.configured === true && roster[0]?.model === "m");

  /* The whole security property, asserted as the absence of a class rather
     than by checking the fields I happened to think of. */
  const SECRETISH = ["key", "token", "secret", "authorization", "bearer", "password", "url"];
  const leaked = JSON.stringify(roster).toLowerCase();
  const found = SECRETISH.filter((k) => leaked.includes(k));
  check(
    `the roster carries no key-shaped field${found.length ? ` — found: ${found.join(", ")}` : ""}`,
    found.length === 0,
  );

  /* An adapter in a bad state must not take the status endpoint down with it —
     the one time an operator needs this route is when something is wrong. */
  const throws = {
    name: "z",
    configured: () => { throw new Error("boom"); },
    model: () => { throw new Error("boom"); },
    chat: async () => ({ ok: false, status: 0, bodyText: "" }),
  };
  let threw = false;
  let out: ReturnType<typeof providerRoster> = [];
  try {
    out = providerRoster([throws] as never);
  } catch {
    threw = true;
  }
  check("an adapter that throws is reported, not propagated", !threw && out[0]?.configured === false && out[0]?.model === "unknown");
}

/* ── Latency sampling on /api/ai/providers ────────────────────────────────
   Two things are held here, and they fail for different reasons.

   The STATS are real arithmetic and are tested as such — the even-length
   branch of a median is exactly the code that stays wrong because nobody
   measures an even number of things on the day they read it.

   The BREAKER ISOLATION is held by reading the route source, because the bug
   it prevents cannot be reproduced from outside: the probe used the shared
   `providerBreaker`, so probing a sick provider recorded failures against LIVE
   traffic (three opens it) and probing a recovering one recorded a success
   that reset a breaker live turns had legitimately opened. A diagnostic that
   changes what it diagnoses. The assertion is that the probe call passes its
   own breaker — stated as the presence of the isolated one AND the absence of
   any call that omits it. */
{
  console.log("\nSection 9 — probe latency sampling");

  check("no samples → null, not zero", latencyStats([]) === null);
  check("one sample is its own min/median/max",
    JSON.stringify(latencyStats([700])) === JSON.stringify({ min: 700, median: 700, max: 700 }));
  check("odd length takes the middle value",
    latencyStats([900, 100, 500])?.median === 500);
  check("even length averages the two middle values",
    latencyStats([100, 200, 300, 500])?.median === 250);
  check("even-length average is rounded, not truncated",
    latencyStats([100, 201])?.median === 151);
  check("input order does not matter",
    JSON.stringify(latencyStats([4000, 400, 2200])) === JSON.stringify(latencyStats([400, 2200, 4000])));
  check("the caller's array is not mutated by sorting", (() => {
    const given = [3, 1, 2];
    latencyStats(given);
    return given[0] === 3 && given[1] === 1 && given[2] === 2;
  })());
  /* Spread is why all three are reported. These two lists share a median and
     are not the same provider; if the route ever reported the median alone,
     this is the fact that would be lost. */
  check("min and max separate a steady provider from an erratic one", (() => {
    const erratic = latencyStats([400, 2200, 4000]);
    const steady = latencyStats([2100, 2200, 2300]);
    return erratic?.median === steady?.median && erratic!.max - erratic!.min > steady!.max - steady!.min;
  })());

  const routeSrc = readFileSync("src/app/api/ai/providers/route.ts", "utf8");

  check("the probe uses a breaker of its own",
    /const\s+probeBreaker\s*=\s*createBreaker\(\)/.test(routeSrc));
  /* The absence check is the one that matters. Adding an isolated breaker and
     leaving a second call site that omits it would pass the presence check
     while the live breaker is still being written to. */
  check("every chatWithToolsVia call in the route passes that breaker", (() => {
    const calls = routeSrc.split("chatWithToolsVia(").slice(1);
    return calls.length > 0 && calls.every((tail) => tail.slice(0, 1200).includes("breaker: probeBreaker"));
  })());
  check("samples are capped, so a browser cannot ask for an unbounded run",
    /Math\.min\(\s*MAX_SAMPLES/.test(routeSrc) && /const MAX_SAMPLES = \d+/.test(routeSrc));
  check("samples are floored, so \"3.9\" cannot become a fractional loop bound",
    /Math\.floor\(Number\(params\.get\("samples"\)\)\)/.test(routeSrc));
  check("a wall-clock budget stops sampling before maxDuration kills the route",
    /const SAMPLE_BUDGET_MS = /.test(routeSrc) && /Date\.now\(\) >= deadline/.test(routeSrc));
  check("`ms` still means the first call, so the field's old readers are unaffected",
    /ms:\s*ms\[0\]\s*\?\?\s*0/.test(routeSrc));
  check("sampling stops at the first failure rather than repeating it",
    /if \(!ok\) break;/.test(routeSrc));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("Section 1 compares against the loop's own parse expression, copied verbatim — not against a description of it.");
});
