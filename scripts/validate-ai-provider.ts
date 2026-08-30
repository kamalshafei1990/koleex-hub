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
import {
  selectAdapter,
  providerConfigured,
  activeProviderLabel,
  pickAdapter,
  chatWithToolsVia,
  shouldTryNextProvider,
} from "../src/lib/server/ai/provider/registry";
import { openAiCompatibleAdapter, parseFallbackConfig } from "../src/lib/server/ai/provider/adapters/openai-compatible";
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
     consequential should not rest on reading the loop and believing it. */
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
    for (const s of [500, 502, 503, 504, 429, 401, 403, 404]) {
      check(`status ${s} is worth a second provider`, shouldTryNextProvider(s) === true);
    }
    for (const s of [400, 413, 422]) {
      check(`status ${s} is NOT — the request is bad, not the provider`, shouldTryNextProvider(s) === false);
    }

    {
      const log: Log = [];
      const out = await chatWithToolsVia(
        [mk("a", true, ERR(503), log), mk("b", true, OK("from b"), log)],
        REQ,
        { failover: true },
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
        { failover: true },
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
        { failover: true, onDelta: (t) => seen.push(t) },
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
        { failover: true, onDelta: (t) => seen.push(t) },
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
        { failover: false },
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
        { failover: true },
      );
      check(
        `an unconfigured adapter is not even attempted (tried: ${log.join(" → ")})`,
        out.ok && log.join(",") === "b",
      );
    }
    {
      const log: Log = [];
      const out = await chatWithToolsVia([mk("x", false, OK("never"), log)], REQ, { failover: true });
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
        { failover: true },
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
}

void asyncChecks().then(() => {
  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("Section 1 compares against the loop's own parse expression, copied verbatim — not against a description of it.");
});
