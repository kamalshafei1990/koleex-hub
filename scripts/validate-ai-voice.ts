/* ---------------------------------------------------------------------------
   validate:ai-voice — Phase 15 step 1, the handshake.

   WHAT THIS ROUTE DOES THAT NOTHING ELSE IN THE PRODUCT DOES: it spends the
   vendor API key on a caller's behalf, on a request whose body the caller
   supplies. Everything asserted here follows from that one sentence.

   THE PART THAT CANNOT BE TESTED HERE, said plainly: this environment's egress
   policy refuses to reach the vendor, so the SDP exchange itself can only be
   proved in production. That is exactly why the config lives in a pure module
   this suite runs for real — the untestable surface is one fetch, and the
   route around it is checked by reading it.

   Section 1 is behavioural (real functions, real inputs). Section 2 reads the
   route, and says so rather than pretending otherwise.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import {
  parseVoiceConfig,
  diagnoseVoiceConfig,
  voiceConfigured,
} from "../src/lib/server/ai/voice/config";
import { verdictForStatus, probeVoice } from "../src/lib/server/ai/voice/probe";
import { parseVoiceOptions, resolveVoice } from "../src/lib/server/ai/voice/config";
import { buildSessionUpdate, publicVoiceList } from "../src/lib/server/ai/voice/session-config";
import { AI_PROVENANCE_RULE } from "../src/lib/server/ai/prompt-builder";
import { VOICE_TOOL_NAMES } from "../src/lib/server/ai/voice/tools";
import {
  capTurnsToBudget,
  historyBlock,
  parseConversationParam,
  HISTORY_BUDGET_BYTES,
  HISTORY_MAX_CHARS_PER_TURN,
  type RecentTurn,
} from "../src/lib/server/ai/voice/history";
import { buildVoiceSessionPayload, parseSttLanguage } from "../src/lib/server/ai/voice/session-config";
import { BUDGETS } from "../src/lib/server/ai/security/rate-limit";

let pass = 0;
const failures: string[] = [];
/* A CONDITION MAY THROW, AND A THROW MUST BE A NAMED FAILURE. Applied here for
   the same reason as the other voice suites: a mutation that breaks the
   product should say which guarantee broke, not produce a Node stack trace. */
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

/* A SUITE THAT STOPS EARLY MUST NOT PASS. The first run of section 11 ended
   with exit code 0 and no summary: an awaited promise waited on nothing but
   an AbortSignal.timeout, whose timer Node unrefs, so the loop drained and
   the process simply left — every assertion after it unrun, CI green. */
let summarised = false;
process.on("exit", (code) => {
  if (!summarised && code === 0) {
    console.log("\n  ✗ the suite exited before reaching its summary — assertions were never run");
    process.exitCode = 1;
  }
});

const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const GOOD = {
  AI_VOICE_BASE_URL: "https://example.invalid/api/rtc/v1/realtime",
  AI_VOICE_API_KEY: "sk-secret-value-do-not-leak",
  AI_VOICE_MODEL: "some-model-id",
};

console.log("\n── 1. The config either serves or refuses — never half ──");
{
  const ok = parseVoiceConfig(GOOD);
  check("a complete config parses", ok !== null);
  check("the model is applied by US, not by the caller",
    ok!.sdpUrl.includes("model=some-model-id"));
  check("the base path is preserved", ok!.sdpUrl.includes("/api/rtc/v1/realtime"));
  check("voiceConfigured agrees with parse", voiceConfigured(GOOD) === true);

  /* Each of the three is load-bearing. A handshake that reaches a real
     endpoint with no model is a request that costs money and cannot work. */
  for (const missing of ["AI_VOICE_BASE_URL", "AI_VOICE_API_KEY", "AI_VOICE_MODEL"] as const) {
    const env = { ...GOOD, [missing]: undefined };
    check(`without ${missing} it refuses rather than half-configuring`, parseVoiceConfig(env) === null);
  }
  check("whitespace-only is the same as absent",
    parseVoiceConfig({ ...GOOD, AI_VOICE_API_KEY: "   " }) === null);

  /* There is no configuration in which sending this key over http is right. */
  check("plaintext http is refused, not warned about",
    parseVoiceConfig({ ...GOOD, AI_VOICE_BASE_URL: "http://example.invalid/rtc" }) === null);
  check("a malformed url is refused",
    parseVoiceConfig({ ...GOOD, AI_VOICE_BASE_URL: "not a url" }) === null);
  /* The trap the AI fallback actually hit: a base copied from a quickstart
     that already carries what the code appends. */
  check("a base that already carries a model is refused rather than doubled",
    parseVoiceConfig({ ...GOOD, AI_VOICE_BASE_URL: "https://example.invalid/rtc?model=other" }) === null);

  const label = parseVoiceConfig({ ...GOOD, AI_VOICE_REGION_LABEL: "cn" });
  check("a region label is carried", label!.regionLabel === "cn");
  check("and defaults rather than being empty", parseVoiceConfig(GOOD)!.regionLabel === "default");
}

console.log("\n── 2. The diagnosis names variables, never values ──");
{
  const all = diagnoseVoiceConfig({});
  check("an empty environment names all three", all.length >= 3);
  check("a well-formed one points at the redeploy",
    diagnoseVoiceConfig(GOOD).join(" ").includes("redeploy"));
  check("http is diagnosed as a protocol judgement, not as a url",
    diagnoseVoiceConfig({ ...GOOD, AI_VOICE_BASE_URL: "http://example.invalid/rtc" })
      .some((p) => /not https/.test(p)));

  /* THE ONE THAT MATTERS. Proved as the ABSENCE OF A CLASS: no diagnosis, for
     any input, may contain any VALUE it was given. A version that echoed the
     offending string to be helpful would pass a case-by-case check and fail
     this. */
  const secretish = {
    AI_VOICE_BASE_URL: "http://leak.invalid/workspace-abc123?model=leaked-model",
    AI_VOICE_API_KEY: "sk-secret-value-do-not-leak",
    AI_VOICE_MODEL: "leaked-model",
    AI_VOICE_REGION_LABEL: "leaked-region",
  };
  const text = diagnoseVoiceConfig(secretish).join(" ");
  check("no diagnosis echoes the key", !text.includes("sk-secret-value-do-not-leak"));
  check("no diagnosis echoes the host or workspace", !text.includes("leak.invalid") && !text.includes("workspace-abc123"));
  check("no diagnosis echoes the model id", !text.includes("leaked-model"));
  check("no diagnosis echoes the region label", !text.includes("leaked-region"));
}

console.log("\n── 3. The route, read — the surface a fetch cannot be tested through ──");
{
  const src = readFileSync("src/app/api/ai/voice/session/route.ts", "utf8");
  const code = strip(src);

  /* THE GATE MOVED TO ai/voice/gate.ts, shared with the transcript route, and
     these assertions followed it: the property is that the CHAIN exists and
     this route goes through it, not that the chain's text lives in this file. */
  const gateSrc = strip(readFileSync("src/lib/server/ai/voice/gate.ts", "utf8"));
  check("the route goes through the shared voice gate",
    /import \{ authorizeVoice \} from "@\/lib\/server\/ai\/voice\/gate"/.test(code) &&
    /const authorize = authorizeVoice;/.test(code));
  check("it authenticates before anything else", /requireAuth\(req\)/.test(gateSrc) &&
    gateSrc.indexOf("requireAuth(req)") < gateSrc.indexOf("requireInternalUser(auth)"));
  /* THE DOOR THIS ROUTE'S FIRST DRAFT MISSED. Owner directive 2026-08-03 —
     Koleex AI must not be REACHABLE by a non-internal account type, because
     customer-portal logins share the accounts table and "the tools would deny
     anyway" is not acceptable exposure. validate:ai-api-v1 caught it; it is
     asserted here too, so the route that has it is the one that proves it. */
  check("the internal-account door is closed before any permission reasoning",
    /requireInternalUser\(auth\)/.test(gateSrc) &&
    gateSrc.indexOf("requireInternalUser(auth)") < gateSrc.indexOf("checkModule(ctx"));
  /* Deny-by-default. checkModule has no open-access fallback, so a user with
     no row is refused — the correct default for a capability that spends
     money per minute. */
  check("access is a permission decision, not a hard-coded role",
    /checkModule\(ctx, "AI Voice", "view"\)/.test(gateSrc) && /!decision\.allowed/.test(gateSrc));
  /* THE CALLS, not the imports: an import line sits above every handler and
     satisfies an index comparison for the wrong reason. */
  check("a budget is consumed after auth and before the vendor",
    code.indexOf("consumeBudget(") > code.indexOf("await authorize(req)") &&
    code.indexOf("consumeBudget(") < code.indexOf("fetch(cfg.sdpUrl"));
  check("the body is size-capped, because we spend our key on it",
    /MAX_SDP_BYTES/.test(code) && /offer\.length > MAX_SDP_BYTES/.test(code));
  /* PER ATTEMPT, from the staged table — see validate-voice-tools §2c for why
     the budgets differ by attempt. */
  check("the handshake has a deadline",
    /AbortSignal\.timeout\(budgetMs\)/.test(code) &&
    /const budgetMs = budgets\[attempt - 1\]/.test(code) &&
    /const budgets: readonly number\[\] = candidates\.length > 1 \? TWO_REGION_ATTEMPT_BUDGETS_MS : HANDSHAKE_ATTEMPT_BUDGETS_MS;/.test(code));

  /* THE CLIENT MUST NOT NAME THE ENDPOINT. A client that could would be a
     client that could send our key somewhere we did not choose. The url comes
     only from the config module. */
  check("the url comes from the config, never from the request",
    /fetch\(cfg\.sdpUrl,/.test(code));
  /* A voice choice IS now read from the request — but it can only select from
     a server-side catalogue, and it never reaches the vendor url or a header.
     The blanket "no searchParams" ban was the old proxy for that; the
     guarantee is that the fetch is built from the config alone. */
  const vendorCall = code.slice(code.indexOf("fetch(cfg.sdpUrl,"), code.indexOf("} catch (e)", code.indexOf("fetch(cfg.sdpUrl,")));
  check("nothing from the request reaches the vendor url or headers",
    !/searchParams|req\.url|body\./.test(vendorCall));
  /* TWO request fields now, each resolved against something the SERVER owns:
     the voice key against the catalogue, the conversation id against the
     caller's own conversations (inside loadRecentTurns). Neither reaches the
     vendor — the assertion above this one still holds that. */
  /* FOUR now: the fourth is a REGION HINT of two allow-listed words, which
     selects between endpoints the server owns and can name neither. */
  check("the only request fields read are a voice KEY, a conversation ID, a transcription LANGUAGE and a two-word REGION HINT — each allow-listed",
    (code.match(/searchParams\.get/g) ?? []).length === 4 &&
    /parseRegionHint\(new URL\(req\.url\)\.searchParams\.get\("region"\)\)/.test(code) &&
    /searchParams\.get\("voice"\)/.test(code) &&
    /resolveVoice\(cfg\.voices, requested\)/.test(code) &&
    /parseConversationParam\(new URL\(req\.url\)\.searchParams\.get\("conversation"\)\)/.test(code) &&
    /parseSttLanguage\(new URL\(req\.url\)\.searchParams\.get\("stt"\)\)/.test(code));

  /* NOTHING VENDOR-SHAPED MAY TRAVEL BACK. The success path now returns the
     answer BESIDE a session the server authored — deliberately, because the
     browser must not compose that event. What must still be absent is every
     value that identifies the endpoint, the model or the account. */
  const successReturn = code.slice(code.lastIndexOf("return NextResponse.json("));
  check("the success path returns the answer and the authored session, nothing more",
    /sdp: answer, session: payload\.full, session_compact: payload\.compact/.test(successReturn));
  /* BOTH LENGTHS, because only the client can see the channel's size limit but
     shortening a policy is authoring one. Without the compact version there is
     nothing to fall back to and a long policy simply breaks every call. */
  check("and it offers the compact version the client may fall back to",
    /buildVoiceSessionPayload\(voice[,)]/.test(code) && /session_compact/.test(successReturn));
  /* THE TAUGHT INDEX, AND THE THREE THINGS THAT MAKE IT SAFE TO ADD HERE.
     It is what lets a call reach knowledge the owner taught after the session
     was designed — but it is a database read bolted onto the one path in this
     product with a history of timing out, so: it runs AFTER the vendor has
     already answered, it is scoped to the caller's tenant, and it cannot fail
     the call. Losing any one of those turns a nicety into an outage. */
  const afterHandshake = code.slice(code.indexOf("const answer"));
  check("the taught-question index is read after the handshake, never before it",
    afterHandshake.includes("taughtQuestionIndex(") &&
    code.indexOf("taughtQuestionIndex(") > code.indexOf("fetch(cfg.sdpUrl,"));
  check("and it is scoped to the caller's tenant, not the platform",
    /taughtQuestionIndex\(gate\.tenantId, TAUGHT_INDEX_BUDGET_BYTES\)/.test(code) &&
    /tenantId: auth\.tenant_id \?\? null/.test(gateSrc));
  check("and a slow or broken knowledge plane loses the index, not the call",
    /Promise\.race\(/.test(code) &&
    /setTimeout\(\(\) => resolve\(\[\]\), TAUGHT_INDEX_TIMEOUT_MS\)/.test(code) &&
    /catch \{[\s\S]{0,400}?taught index unavailable/.test(code) &&
    /let taughtQuestions: string\[\] = \[\];/.test(code));
  check("and the index reaches the full session, never the compact fallback",
    /buildVoiceSessionPayload\(voice, taughtQuestions, recentTurns, gate\.viewer, sttLanguage\)/.test(code));
  /* ── WHERE THIS FUNCTION RUNS, and why it is no longer pinned ─────────
     For a day this asserted the OPPOSITE: that the handshake was pinned away
     from the project's region, to Hong Kong, because the endpoint looked
     unroutable from Tokyo. The log then confirmed the move had really taken
     effect (from=hkg1) and the handshake still failed — and I read that as
     the region being eliminated as a cause.

     THAT WAS ONE SAMPLE, and more of them reversed it:

       hnd1 (Tokyo)      38 successful handshakes, 23 failures
       hkg1 (Hong Kong)   0 successful handshakes,  9 failures

     Tokyo worked about six times in ten. Hong Kong never completed a single
     handshake. "It still fails there" was never evidence that where we run
     does not matter, and the pin made a bad path worse.

     THE ASSERTIONS ARE INVERTED RATHER THAN DELETED. Deleting them would
     leave nothing standing between the next person and the same idea, which
     is superficially very reasonable. Anyone re-pinning this function now has
     to come here, change this, and read the numbers first. */
  {
    const vercelCfg = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      regions?: string[];
      functions?: Record<string, { regions?: string[] }>;
      crons?: unknown[];
    };
    const VOICE_FN = "src/app/api/ai/voice/session/route.ts";
    check("the voice handshake is NOT pinned away from the project's region",
      vercelCfg.functions?.[VOICE_FN]?.regions === undefined);
    check("  …and no per-function region override survives at all",
      Object.keys(vercelCfg.functions ?? {}).length === 0);
    check("the project default is the region that actually completes handshakes",
      JSON.stringify(vercelCfg.regions) === JSON.stringify(["hnd1"]));
    /* Non-vacuity: rewriting vercel.json is how the scheduled work gets
       dropped by accident, and it has been rewritten twice now. */
    check("  …and the cron jobs sharing this file survived the edit",
      Array.isArray(vercelCfg.crons) && vercelCfg.crons.length === 6);

    /* THE FIELD THAT MADE THE REVERSAL POSSIBLE, and the reason it stays.
       `region=` in this log is the VENDOR's label. Without our own execution
       region there was no way to tell a handshake that moved and still failed
       from one that never moved — and no way to count successes per region,
       which is the comparison that settled it. */
    check("a failed handshake reports the region OUR function ran in",
      /from=\$\{process\.env\.VERCEL_REGION \?\? "local"\}/.test(code));
    check("  …distinctly from the vendor's own region label",
      /from=\$\{[^}]*\}[\s\S]{0,60}region=\$\{cfg\.regionLabel\}/.test(code));
    check("  …and a SUCCESSFUL one reports it too, or successes cannot be counted per region",
      /handshake ok[\s\S]{0,200}?from=\$\{process\.env\.VERCEL_REGION/.test(code));
  }

  check("and carries no endpoint, model, key or region",
    !/sdpUrl/.test(successReturn) && !/apiKey/.test(successReturn) &&
    !/AI_VOICE_MODEL/.test(successReturn) && !/regionLabel/.test(successReturn));
  check("the vendor's error body is logged, never forwarded",
    /detail=\$\{detail\}/.test(code) && !/error: detail/.test(code) && !/error: `.*\$\{detail\}/.test(code));
  check("the config diagnosis goes to the log, not to the caller",
    /console\.error\(`\[ai\.voice\] not configured/.test(code) &&
    !/error: diagnoseVoiceConfig/.test(code));
  /* The key appears exactly once, in the Authorization header it exists for. */
  check("the key is referenced once, in the header",
    (code.match(/cfg\.apiKey/g) ?? []).length === 1 &&
    /Authorization: `Bearer \$\{cfg\.apiKey\}`/.test(code));
  check("the key is never logged", !/console\.\w+\([^)]*apiKey/.test(code));
}

console.log("\n── 3. The probe's verdict table separates the failures that matter ──");
{
  /* THE WHOLE POINT of the probe is that these three are DIFFERENT actions for
     an operator: rotate the key, fix the workspace id, or stop looking because
     it already works. A table that collapsed any two of them would still
     "pass" a test that only checked it returned a string. */
  const bad = verdictForStatus(401);
  const forbidden = verdictForStatus(403);
  const missing = verdictForStatus(404);
  const rejected = verdictForStatus(400);

  check("401 says the credential was rejected", bad.credential_ok === false);
  check("403 is treated as a credential failure too", forbidden.credential_ok === false);
  check("404 is NOT reported as a bad key", missing.credential_ok === false);
  check("400 means the credential was ACCEPTED — the offer was ours to get wrong",
    rejected.credential_ok === true);
  check("422 is accepted the same way as 400", verdictForStatus(422).credential_ok === true);

  /* Distinctness, not mere presence. Three failures that say the same words
     are one failure with three status codes. */
  check("401 and 404 do not give the same advice", bad.verdict !== missing.verdict);
  check("401 names the key variable", bad.verdict.includes("AI_VOICE_API_KEY"));
  check("404 names the base url and the model, which is where a wrong workspace id lives",
    missing.verdict.includes("AI_VOICE_BASE_URL") && missing.verdict.includes("AI_VOICE_MODEL"));
  check("400's verdict says configuration is correct",
    /configured correctly/i.test(rejected.verdict));

  check("429 is a credential success, not a config error",
    verdictForStatus(429).credential_ok === true);
  check("500 does not blame the configuration",
    verdictForStatus(500).credential_ok === true && /vendor/i.test(verdictForStatus(500).verdict));
  check("an unmapped status is reported rather than guessed",
    verdictForStatus(418).credential_ok === false && verdictForStatus(418).verdict.includes("418"));
}

/* Sections 4-6 exercise real async paths, so the rest of the suite runs
   inside an async entry point. tsx compiles to CJS here — top-level await is
   not available. */
void (async () => {
  console.log("\n── 4. The probe spends the key correctly and reports no vendor words ──");
  {
    let seenUrl = "";
    let seenAuth = "";
    let seenType = "";
    let seenBody = "";
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      seenUrl = String(url);
      const h = (init?.headers ?? {}) as Record<string, string>;
      seenAuth = h["Authorization"] ?? "";
      seenType = h["Content-Type"] ?? "";
      seenBody = String(init?.body ?? "");
      return new Response("workspace ws-SECRET-ID quota exceeded", { status: 400 });
    }) as unknown as typeof fetch;

    const out = await probeVoice(GOOD, fakeFetch);
    check("a configured env produces a probe", out !== null);
    check("the probe POSTs to the model-applied url", seenUrl.includes("model=some-model-id"));
    check("the key travels in the Authorization header",
      seenAuth === `Bearer ${GOOD.AI_VOICE_API_KEY}`);
    check("the key is NOT in the url", !seenUrl.includes(GOOD.AI_VOICE_API_KEY));
    check("the content type is SDP", seenType === "application/sdp");
    check("the offer sent is deliberately incomplete — no session can open",
      seenBody.startsWith("v=") && seenBody.length < 32);
    check("a 400 is reported as reachable and credential-ok",
      out!.reachable === true && out!.credential_ok === true && out!.status === 400);

    /* THE VENDOR'S BODY MUST NOT COME BACK. The fake returned a workspace id in
       its error text; none of it may appear in what we hand the operator. */
    const asText = JSON.stringify(out);
    check("the vendor's error body is not echoed", !asText.includes("ws-SECRET-ID"));
    check("the key is not echoed", !asText.includes(GOOD.AI_VOICE_API_KEY));
  }

  console.log("\n── 5. Failure modes of the probe itself ──");
  {
    const unconfigured = await probeVoice({ AI_VOICE_BASE_URL: "https://x.invalid/a" });
    check("an unconfigured env probes nothing rather than throwing", unconfigured === null);

    const throwing = (async () => { throw new Error("connect ECONNREFUSED 10.1.2.3:443"); }) as unknown as typeof fetch;
    const dead = await probeVoice(GOOD, throwing);
    check("an unreachable host is reported, not thrown", dead !== null && dead.reachable === false);
    check("an unreachable host is never credential-ok", dead!.credential_ok === false);
    check("the thrown message — which can carry the resolved host — is not echoed",
      !JSON.stringify(dead).includes("10.1.2.3"));
    check("the unreachable verdict names the variable to check",
      dead!.verdict.includes("AI_VOICE_BASE_URL"));

    /* THE CODE SURVIVES, THE MESSAGE DOES NOT. A bare Error has no cause, so
       the probe reports the error's NAME; a fetch failure carries undici's
       code in .cause, and THAT is what separates "DNS" from "TCP never
       opened" — the distinction this investigation lost twice. */
    check("a failure with no cause reports the error name and nothing more",
      dead!.cause === "Error");
    const withCode = (async () => {
      const err = new TypeError("fetch failed");
      (err as { cause?: unknown }).cause = Object.assign(
        new Error("connect timeout to 10.1.2.3:443"), { code: "UND_ERR_CONNECT_TIMEOUT" });
      throw err;
    }) as unknown as typeof fetch;
    const timedOut = await probeVoice(GOOD, withCode);
    check("a fetch failure reports the transport code",
      timedOut!.cause === "TypeError/UND_ERR_CONNECT_TIMEOUT");
    check("  …and still not the host inside the cause's message",
      !JSON.stringify(timedOut).includes("10.1.2.3"));
    const okProbe = await probeVoice(GOOD, (async () => new Response("", { status: 400 })) as unknown as typeof fetch);
    check("an HTTP answer has no cause — the field means transport failure only",
      okProbe!.cause === null);

    /* THE TIMEOUT IS THE CALLER'S TO SET. The watchdog needs the real route's
       budget; the admin page keeps the old default. A probe that ignored the
       argument would make the watchdog measure the wrong thing silently. */
    let seenTimeout: AbortSignal | undefined;
    const capturing = (async (_u: string | URL, init?: RequestInit) => {
      seenTimeout = init?.signal ?? undefined;
      return new Response("", { status: 400 });
    }) as unknown as typeof fetch;
    await probeVoice(GOOD, capturing, 50);
    check("the probe carries an abort signal", seenTimeout instanceof AbortSignal);
    /* Node unrefs the timer behind AbortSignal.timeout: a promise waiting on
       nothing BUT that signal lets the process exit silently, mid-suite, with
       code 0 — which is exactly what happened the first time this ran. The
       ref'd fallback timer keeps the loop alive; the abort wins at 50ms. */
    const stalling = ((_u: string | URL, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        const fallback = setTimeout(() => rej(new Error("fallback: abort never fired")), 5_000);
        init?.signal?.addEventListener("abort", () => { clearTimeout(fallback); rej(init.signal!.reason); });
      })) as unknown as typeof fetch;
    const t0 = Date.now();
    const gaveUp = await probeVoice(GOOD, stalling, 50);
    check("a stalled connection is abandoned at the timeout the caller chose",
      gaveUp!.reachable === false && Date.now() - t0 < 2_000);
    check("  …and reported as the timeout it was",
      gaveUp!.cause === "TimeoutError");
  }

  console.log("\n── 6. The status route reports voice, and reports it safely ──");
  {
    const code = readFileSync("src/app/api/ai/providers/route.ts", "utf8");
    const bare = strip(code);
    check("voice status is reported without ?probe=1 too",
      /voice: voiceStatus/.test(bare));
    check("the probe result is only attached under ?probe=1",
      /voice: \{\s*\.\.\.voiceStatus,\s*\.\.\.\(voiceProbe \? \{ probe: voiceProbe \} : \{\}\),/.test(bare) &&
      /alt: \{ \.\.\.altStatus, \.\.\.\(altProbe \? \{ probe: altProbe \} : \{\}\) \}/.test(bare));
    check("the diagnosis is only sent when voice is NOT configured",
      /voiceIsConfigured \? \{\} : \{ not_configured_because: diagnoseVoiceConfig/.test(bare));
    /* The key must enter this file exactly once, to be handed to the probe, and
     must never be read a second time into anything that gets serialised. */
    const keyReads = bare.match(/process\.env\.AI_VOICE_API_KEY/g) ?? [];
    check("the key is read from the environment exactly once", keyReads.length === 1);
    check("that one read is the env getter passed to the probe",
      /AI_VOICE_API_KEY: process\.env\.AI_VOICE_API_KEY/.test(bare) &&
      /probeVoice\(voiceEnv\(\)\)/.test(bare));
    check("no resolved config value is referenced by the route at all",
      !/apiKey/.test(bare) && !/sdpUrl/.test(bare));
    check("the voice probe overlaps the provider probes rather than serialising",
      bare.indexOf("const voiceProbePromise") < bare.indexOf("const probes = await Promise.all") &&
      bare.indexOf("await voiceProbePromise") > bare.indexOf("const probes = await Promise.all"));
    check("this route is still super-admin only", /if \(!auth\.is_super_admin\)/.test(bare));
  }

  console.log("\n── 7. The voice catalogue is configuration, and the server owns it ──");
  {
    const v = parseVoiceOptions("Ethan:Omar, Chelsie:Layla");
    check("pairs parse into id and label",
      v.length === 2 && v[0].vendorId === "Ethan" && v[0].label === "Omar");
    check("keys are ours, not the vendor's",
      v[0].key === "v1" && v[1].key === "v2" && !v.some((o) => o.key === o.vendorId));
    check("a bare id with no label shows as itself",
      () => parseVoiceOptions("Ethan")[0].label === "Ethan");
    check("whitespace around entries is tolerated",
      () => parseVoiceOptions("  Ethan : Omar  ")[0].vendorId === "Ethan");
    check("a label may contain a colon — only the first splits",
      () => parseVoiceOptions("Ethan:Omar: warm")[0].label === "Omar: warm");

    /* A malformed entry must be DROPPED, not offered: a voice in the picker
       the server would reject is a menu item that fails when chosen. */
    check("an empty entry is dropped", parseVoiceOptions("Ethan:Omar,,Chelsie:Layla").length === 2);
    check("an entry with no id is dropped", parseVoiceOptions(":Nameless,Ethan:Omar").length === 1);
    check("a duplicate id is dropped", parseVoiceOptions("Ethan:Omar,Ethan:Other").length === 1);
    check("no configuration is an empty list, not a failure",
      parseVoiceOptions(undefined).length === 0 && parseVoiceOptions("").length === 0);

    /* THE BROWSER PROPOSES, THE SERVER DISPOSES. */
    check("a known key resolves", resolveVoice(v, "v1")?.vendorId === "Ethan");
    check("an unknown key resolves to nothing", resolveVoice(v, "v9") === null);
    check("no key resolves to nothing", resolveVoice(v, null) === null);
    check("a VENDOR id is not accepted as a key — the client never learns them",
      resolveVoice(v, "Ethan") === null);
  }

  console.log("\n── 8. What the client may know, and what it may not ──");
  {
    const v = parseVoiceOptions("Ethan:Omar,Chelsie:Layla");
    const listed = publicVoiceList(v);
    check("the list carries a key and a label",
      () => listed[0].key === "v1" && listed[0].label === "Omar");
    check("the vendor id never appears in the public list",
      !JSON.stringify(listed).includes("Ethan") && !JSON.stringify(listed).includes("Chelsie"));
    check("and nothing else rides along",
      () => Object.keys(listed[0]).sort().join(",") === "key,label");
  }

  console.log("\n── 9. The session the server authors ──");
  {
    const v = parseVoiceOptions("Ethan:Omar");
    const withVoice = buildSessionUpdate(v[0]);
    const without = buildSessionUpdate(null);

    check("it is a session.update", withVoice.type === "session.update");
    check("a chosen voice is applied as the VENDOR id — the one place it travels",
      withVoice.session.voice === "Ethan");
    check("no choice means no voice field, so the vendor's default is used",
      !("voice" in without.session));
    check("it asks for audio, not text alone",
      JSON.stringify(withVoice.session.modalities) === JSON.stringify(["text", "audio"]));
    check("it requests the user's transcript",
      JSON.stringify(withVoice.session.input_audio_transcription) === JSON.stringify({ enabled: true }));
    check("it configures server-side turn detection",
      (withVoice.session.turn_detection as { type?: string })?.type === "server_vad");
    check("it names both audio formats",
      withVoice.session.input_audio_format === "pcm" && withVoice.session.output_audio_format === "pcm");

    /* THE IDENTITY RULE, AND WHY THIS SECTION INVERTED.

       Shipped with no instructions at all, the model answered "who are you"
       with a vendor's name — spoken aloud, to a user. A voice session carries
       no history and no system message unless this event supplies one, so an
       empty `instructions` was never neutral: it was the model's own idea of
       itself. */
    const instructions = String(withVoice.session.instructions ?? "");
    check("the session carries instructions at all", instructions.length > 0);
    check("it names Koleex AI as what it is",
      /Koleex AI/.test(instructions) && /Koleex International Group/.test(instructions));
    check("it forbids naming any underlying model or provider",
      /NEVER name, hint at, confirm/.test(instructions));
    check("it covers the indirect routes, not just a direct question",
      /joke|hypothetical|roleplay|translation/.test(instructions));
    check("it forbids repeating a provider name that appears in tool output",
      /Never repeat a model or provider name/.test(instructions));

    /* IMPORTED, NOT RESTATED. Two copies of an identity policy drift, and the
       copy that drifts is the one nobody is looking at. */
    const cfgSrc = readFileSync("src/lib/server/ai/voice/session-config.ts", "utf8");
    check("the rule is imported from the text path rather than re-typed",
      /import \{ AI_PROVENANCE_RULE \}/.test(cfgSrc) && /AI_PROVENANCE_RULE \+/.test(cfgSrc));
    check("and it is the SAME text the text path uses",
      instructions.includes(AI_PROVENANCE_RULE));

    /* An operator who could switch this off could switch off the identity
       rule. It is what the product is, not a setting. */
    check("the instructions are not configurable by environment",
      !/process\.env/.test(cfgSrc) && !/AI_VOICE_INSTRUCTIONS/.test(cfgSrc));

    /* Spoken answers are heard, not read. */
    check("it asks for spoken style rather than markdown",
      /No markdown/.test(instructions) && /heard, not read/.test(instructions));

    /* THIS USED TO READ "still no tool definitions — acting by voice is a
       later step", and it was the right assertion while voice could not act
       at all. Voice can now look things up, so the safety property is no
       longer "no tools": it is that voice may only ever run READ-ONLY tools
       the SERVER chose, because a call has no confirmation step and a spoken
       "yes" is audio the model transcribed on the same channel as the
       request.

       Deleting the check when the feature landed would have removed the only
       thing standing between "voice can search" and "voice can draft a
       quotation nobody approved". It is narrowed, not dropped. */
    {
      const declared = (withVoice.session as { tools?: Array<{ name?: string }> }).tools ?? [];
      const names = declared.map((t) => String(t?.name ?? ""));
      check("voice declares only tools on the server's own allow-list",
        names.length > 0 && names.every((n) => VOICE_TOOL_NAMES.includes(n)));
      const WRITEY = /^(create|update|delete|complete|reassign|remember|forget|suggest)/i;
      const writes = names.filter((n) => WRITEY.test(n));
      check(
        writes.length === 0
          ? "and not one of them is a write — a call cannot act, only look up"
          : `A WRITE TOOL IS REACHABLE BY VOICE: ${writes.join(", ")}`,
        writes.length === 0,
      );
      /* The client must not be able to widen it: the list is server-side. */
      check("the allow-list lives on the server, not in the browser bundle",
        /server-only/.test(readFileSync("src/lib/server/ai/voice/tools.ts", "utf8")));
    }
    check("no endpoint, model, key or workspace travels in the session",
      !/aliyun|maas|qwen|dashscope|sk-|ws-pl|Bearer/i.test(JSON.stringify(withVoice)));
  }

  console.log("\n── 10. The route gates GET exactly as it gates POST — through ONE shared gate ──");
  {
    const code2 = readFileSync("src/app/api/ai/voice/session/route.ts", "utf8");
    const bare = strip(code2);
    const gate = strip(readFileSync("src/lib/server/ai/voice/gate.ts", "utf8"));

    /* ONE GATE, SHARED — and now shared across FILES. The chain used to be a
       private function in this route; the transcript route made a second copy
       the likely outcome, and a copied chain is how requireInternalUser was
       dropped from this very file once. So the chain lives in gate.ts, both
       routes import it, and neither may carry a step of its own. */
    check("the auth chain lives in one exported function",
      /export async function authorizeVoice\(/.test(gate) &&
      (gate.match(/export async function/g) ?? []).length === 1);
    check("the gate module is server-only", /^import "server-only";/m.test(gate));
    const bodyOf = (verb: string) => {
      const at = bare.indexOf(`export async function ${verb}(`);
      if (at === -1) return "";
      const next = ["GET", "POST"]
        .map((v) => bare.indexOf(`export async function ${v}(`, at + 1))
        .filter((i) => i > -1);
      return bare.slice(at, next.length ? Math.min(...next) : bare.length);
    };
    check("GET goes through the gate", /authorize\(req\)/.test(bodyOf("GET")));
    check("GET returns nothing before the gate has passed",
      /if \(gate instanceof NextResponse\) return gate;/.test(bodyOf("GET")));
    check("POST goes through the gate", /authorize\(req\)/.test(bodyOf("POST")));
    check("POST returns nothing before the gate has passed",
      /if \(gate instanceof NextResponse\) return gate;/.test(bodyOf("POST")));
    check("the chain still has all three steps in order",
      gate.indexOf("requireAuth(req)") < gate.indexOf("requireInternalUser(auth)") &&
      gate.indexOf("requireInternalUser(auth)") < gate.indexOf('checkModule(ctx, "AI Voice", "view")'));
    check("each step appears exactly once in the gate",
      (gate.match(/requireInternalUser\(auth\)/g) ?? []).length === 1 &&
      (gate.match(/requireAuth\(req\)/g) ?? []).length === 1 &&
      (gate.match(/checkModule\(ctx, "AI Voice", "view"\)/g) ?? []).length === 1);
    /* THE ROUTE MAY NOT RE-IMPLEMENT A STEP. A route that imported requireAuth
       beside the gate would be a route where someone could one day call it
       INSTEAD of the gate. */
    check("neither verb re-implements a gate",
      !/requireAuth|requireInternalUser|checkModule|buildUserContext/.test(bare));

    check("GET returns the public list, never the raw catalogue",
      /publicVoiceList\(cfg\.voices\)/.test(bare) && !/voices: cfg\.voices/.test(bare));
    check("an unconfigured deployment offers an empty list rather than an error",
      /cfg \? publicVoiceList\(cfg\.voices\) : \[\]/.test(bare));
  }

  console.log("\n── 11. The watchdog measures the real path, on the real budget, and says so safely ──");
  {
    /* WHY A SUITE SECTION FOR A CRON. Every earlier diagnosis of the voice
       504 waited on the owner pressing the button. This route is what makes
       the path's health a NUMBER instead of a complaint — and a watchdog that
       silently measured the wrong endpoint, the wrong budget, or nothing at
       all would be worse than none, because it would be believed. */
    const WATCH = "src/app/api/cron/voice-watch/route.ts";
    const code = readFileSync(WATCH, "utf8");
    const bare = strip(code);
    const session = strip(readFileSync("src/app/api/ai/voice/session/route.ts", "utf8"));
    const vercelCfg = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons?: { path: string; schedule: string }[];
    };

    /* Scheduled, at a cadence that yields a per-region success RATE within
       hours rather than days. */
    const cron = (vercelCfg.crons ?? []).find((c) => c.path === "/api/cron/voice-watch");
    check("vercel.json schedules the watchdog", cron !== undefined);
    check("  …every fifteen minutes — 96 samples a day", cron?.schedule === "*/15 * * * *");

    /* Guarded like every other cron, and BEFORE anything is spent. */
    const guardAt = bare.indexOf("process.env.CRON_SECRET");
    const probeAt = bare.indexOf("await probeVoice(");
    check("the watchdog is gated by the cron bearer", guardAt !== -1 &&
      /authz !== `Bearer \$\{secret\}`/.test(bare) && /status: 401/.test(bare));
    check("  …before the probe runs", guardAt < probeAt);

    /* THE SAME REQUEST A CALL MAKES. Not a HEAD, not a ping to the host,
       not a second hand-rolled fetch — the probe module, with the shared
       env reader, so a field the session route reads cannot be one the
       watchdog forgets. */
    check("it probes through the shared probe module — both regions",
      /import \{ probeVoice \} from "@\/lib\/server\/ai\/voice\/probe"/.test(bare) &&
      /probeVoice\(r\.env, fetch, WATCH_TIMEOUT_MS\)/.test(bare) &&
      /readAltVoiceEnv\(\)/.test(bare));
    check("  …with the shared env reader, not a private copy of the variable list",
      /readVoiceEnv\(\)/.test(bare) && !/process\.env\.AI_VOICE_/.test(bare));
    check("  …and never calls fetch itself", !/\bfetch\(/.test(bare));

    /* THE SAME BUDGET A CALL GETS. Read both constants out of the source and
       compare the numbers: a probe that gives up sooner reports failures
       callers never see; one that waits longer hides the ones they do. */
    const watchBudget = Number((bare.match(/const WATCH_TIMEOUT_MS = ([\d_]+)/)?.[1] ?? "").replace(/_/g, ""));
    const routeBudgets = (session.match(/HANDSHAKE_ATTEMPT_BUDGETS_MS = \[([^\]]+)\]/)?.[1] ?? "")
      .split(",").map((n) => Number(n.trim().replace(/_/g, ""))).filter((n) => Number.isFinite(n));
    check("the watchdog waits exactly as long as the route's longest attempt",
      routeBudgets.length > 0 && watchBudget === Math.max(...routeBudgets));
    const maxDur = Number(bare.match(/export const maxDuration = (\d+)/)?.[1] ?? "0");
    check("  …and the function's own ceiling clears that budget",
      maxDur * 1000 > watchBudget);

    /* THE SAME VOCABULARY. One log query must cover real calls and probes. */
    check("the log line carries the tag, our region, the vendor label, the duration and the cause",
      /\[ai\.voice\.watch\]/.test(bare) &&
      /from=\$\{from\}/.test(bare) && /from = process\.env\.VERCEL_REGION \?\? "local"/.test(bare) &&
      /region=\$\{region\}/.test(bare) && /afterMs=\$\{probe\.ms\}/.test(bare) &&
      /cause=\$\{probe\.cause \?\? "none"\}/.test(bare));
    check("  …with the same field names the session route logs",
      /from=\$\{/.test(session) && /region=\$\{/.test(session) && /afterMs=/.test(session) && /cause=/.test(session));
    check("a failure is logged at error level, a success is not",
      /if \(probe\.reachable\) console\.log\(line\)/.test(bare) && /else console\.error\(line\)/.test(bare));
    /* FOUR GREEN RUNS THAT SAID NOTHING. The verdict has to be in the status
       code, because that is what the status-code breakdown and the cron
       history count; a log line at info level is not reliably surfaced. */
    check("no region reachable is a 503, so the verdict is countable by status — one reachable region is a served caller",
      /\{ status: anyReachable \? 200 : 503 \}/.test(bare) && /const anyReachable = rows\.some\(\(r\) => r\.reachable\)/.test(bare));
    check("  …and each region logs its own line, with its slot", /slot=\$\{r\.slot\}/.test(bare));
    check("a lost configuration is said once, and answered quietly",
      /console\.warn\("\[ai\.voice\.watch\] not configured/.test(bare) &&
      /configured: false/.test(bare));

    /* NEVER THE URL, NEVER THE KEY, NEVER THE VENDOR'S WORDS. */
    check("no endpoint, key or vendor text can reach the log or the response",
      !/sdpUrl/.test(bare) && !/apiKey/.test(bare) && !/AI_VOICE_API_KEY/.test(bare) &&
      !/AI_VOICE_BASE_URL/.test(bare) && !/verdict/.test(bare));
    check("route files export handlers and config only",
      (bare.match(/^export /gm) ?? []).length === 3 &&
      /export const dynamic/.test(bare) && /export const maxDuration/.test(bare) &&
      /export async function GET/.test(bare));

    /* THE ADMIN PAGE IS UNCHANGED. Adding a parameter must not have moved
       the page that was already measuring at its own, shorter budget. */
    const providers = strip(readFileSync("src/app/api/ai/providers/route.ts", "utf8"));
    check("the status page still probes at the default budget",
      /probeVoice\(voiceEnv\(\)\)/.test(providers));
  }

  console.log("\n── 12. The call knows what was typed before it ──");
  {
    const t = (role: RecentTurn["role"], content: string): RecentTurn => ({ role, content });
    const chat = [t("user", "first"), t("assistant", "second"), t("user", "third"), t("assistant", "fourth")];

    /* NEWEST FIRST, RETURNED IN ORDER. A budget that fits two turns keeps the
       LAST two, chronological — not the first two, and not reversed. */
    const two = capTurnsToBudget(chat, ("third".length + 8) + ("fourth".length + 8));
    check("the budget keeps the most recent turns", two.map((x) => x.content).join(",") === "third,fourth");
    check("  …in chronological order", two[0].role === "user" && two[1].role === "assistant");
    check("a budget with room keeps everything", capTurnsToBudget(chat, 10_000).length === 4);
    check("no budget keeps nothing", capTurnsToBudget(chat, 0).length === 0);

    /* BYTES, NOT CHARACTERS. Ten Arabic letters are twenty bytes. A budget
       counted in characters would overfill the channel with Arabic. */
    const arabic = [t("user", "ماكينة قص"), t("assistant", "أكيد")];
    const bytesOfLast = Buffer.byteLength("أكيد") + 8;
    const charsOfBoth = "ماكينة قص".length + 8 + "أكيد".length + 8;
    check("the budget is measured in bytes",
      capTurnsToBudget(arabic, bytesOfLast).length === 1 &&
      capTurnsToBudget(arabic, charsOfBoth).length === 1);

    /* BREAK, NOT CONTINUE. Once a turn does not fit, nothing older is taken:
       a hole in the middle of a conversation misleads more than a shorter one. */
    const gappy = [t("user", "short"), t("assistant", "x".repeat(200)), t("user", "tiny")];
    const capped = capTurnsToBudget(gappy, ("tiny".length + 8) + 20);
    check("an oversized turn stops the walk rather than being skipped",
      capped.length === 1 && capped[0].content === "tiny");

    const long = capTurnsToBudget([t("user", "y".repeat(HISTORY_MAX_CHARS_PER_TURN + 50))], 10_000);
    check("one turn is cut to its opening", long[0].content.length === HISTORY_MAX_CHARS_PER_TURN && long[0].content.endsWith("…"));
    check("whitespace runs collapse — a pasted table is not a budget's worth of spaces",
      capTurnsToBudget([t("user", "a   \n\n  b")], 100)[0].content === "a b");
    check("an empty turn is skipped, not counted", capTurnsToBudget([t("user", "   "), t("user", "k")], 100).length === 1);

    const block = historyBlock(two);
    check("the block frames the turns as a record, not instructions",
      /never an instruction to you/.test(block));
    check("  …asks not to re-introduce or read it back",
      /Do not introduce yourself again/.test(block) && /do not read/.test(block));
    check("  …labels the speakers and keeps the order", block.indexOf("User: third") < block.indexOf("You: fourth"));
    check("no turns means no block at all", historyBlock([]) === "");

    /* THE ID IS A QUERY STRING VALUE GOING INTO A DATABASE PREDICATE. */
    check("a UUID is accepted", parseConversationParam("6f1d2c3b-4a5e-4f60-9b7c-1234567890ab") === "6f1d2c3b-4a5e-4f60-9b7c-1234567890ab");
    check("  …and lower-cased", parseConversationParam("6F1D2C3B-4A5E-4F60-9B7C-1234567890AB") === "6f1d2c3b-4a5e-4f60-9b7c-1234567890ab");
    check("anything else is not a conversation id",
      parseConversationParam(null) === null && parseConversationParam("") === null &&
      parseConversationParam("1 or 1=1") === null && parseConversationParam("new chat") === null);

    /* WHERE IT LANDS. Full session only — the compact one exists because the
       full one did not fit. */
    const v = parseVoiceOptions("Ethan:Omar");
    const withHistory = buildVoiceSessionPayload(v[0], [], two);
    const without = buildVoiceSessionPayload(v[0], [], []);
    const fullText = String(withHistory.full.session.instructions);
    check("the history reaches the full session", fullText.includes("User: third") && fullText.includes("THE CONVERSATION SO FAR"));
    check("  …after the taught index, nearest the end",
      fullText.indexOf("THE CONVERSATION SO FAR") > fullText.indexOf("SPOKEN STYLE"));
    check("  …and never the compact fallback",
      !String(withHistory.compact.session.instructions).includes("third"));
    check("no history leaves the session exactly as it was",
      JSON.stringify(without) === JSON.stringify(buildVoiceSessionPayload(v[0])));
    /* THE BOUND MOVED FROM 24 000 TO 30 000 when the caller's own read tools
       (eight schemas, ~5.5 KB) joined the voice list. The real ceiling is the
       DataChannel's negotiated message size — 64 KB and up in every shipping
       browser — and the compact fallback covers a transport that refuses the
       full one. Measured with the viewer block, a taught question and a full
       history: 27.8 KB. */
    check("the budget constant keeps the full session well inside the channel",
      HISTORY_BUDGET_BYTES <= 3_000 && Buffer.byteLength(JSON.stringify(withHistory.full)) < 30_000);

    /* THE ROUTE'S HALF, read. */
    const route = strip(readFileSync("src/app/api/ai/voice/session/route.ts", "utf8"));
    const hist = strip(readFileSync("src/lib/server/ai/voice/history.ts", "utf8"));
    check("the read happens after the vendor has answered",
      route.indexOf("loadRecentTurns(") > route.indexOf("fetch(cfg.sdpUrl,"));
    check("  …scoped to the caller's tenant AND account",
      /loadRecentTurns\(supabaseServer, conversationId, gate\.tenantId, gate\.accountId\)/.test(route));
    check("  …with a ceiling and a fail-open",
      /setTimeout\(\(\) => resolve\(\[\]\), HISTORY_TIMEOUT_MS\)/.test(route) &&
      /let recentTurns: RecentTurn\[\] = \[\];/.test(route) &&
      /conversation history unavailable/.test(route));
    /* THE OWNERSHIP CHECK IS IN THE LOADER, BEFORE THE MESSAGE READ. */
    const ownAt = hist.indexOf('.from("ai_conversations")');
    const msgAt = hist.indexOf('.from("ai_messages")');
    check("the loader checks ownership before reading a single message",
      ownAt !== -1 && msgAt !== -1 && ownAt < msgAt &&
      /\.eq\("tenant_id", tenantId\)[\s\S]{0,80}\.eq\("account_id", accountId\)/.test(hist) &&
      /if \(!owned\) return \[\];/.test(hist));
    check("  …strips embedded attachment text and drops system rows",
      /stripAttachEmbed\(content\)/.test(hist) && /role !== "user" && role !== "assistant"/.test(hist));
    check("  …and reads a bounded number, newest first",
      /\.order\("created_at", \{ ascending: false \}\)[\s\S]{0,40}\.limit\(HISTORY_MAX_TURNS\)/.test(hist));
  }

  console.log("\n── 13. Spoken turns become messages — through the server, never around it ──");
  {
    const route = strip(readFileSync("src/app/api/ai/voice/transcript/route.ts", "utf8"));
    check("the transcript route exists and is server-only", /^import "server-only";/m.test(route));
    check("it goes through the same voice gate as the handshake",
      /import \{ authorizeVoice \} from "@\/lib\/server\/ai\/voice\/gate"/.test(route) &&
      /const gate = await authorizeVoice\(req\);/.test(route) &&
      /if \(gate instanceof NextResponse\) return gate;/.test(route));
    check("  …before the body is even read",
      route.indexOf("authorizeVoice(req)") < route.indexOf("req.json()"));
    check("  …and re-implements no step of it",
      !/requireAuth|requireInternalUser|checkModule/.test(route));

    check("a budget is consumed, from the shared table, before any write",
      /BUDGETS\.voiceTranscriptPerAccount\(\)/.test(route) &&
      route.indexOf("consumeBudget") < route.indexOf(".insert("));
    const b = BUDGETS.voiceTranscriptPerAccount();
    check("  …and that budget is real: its own bucket, a minute window, a ceiling",
      b.bucket === "voice_transcript" && b.windowSec === 60 && b.max > 0 && b.max <= 120);

    /* THE CONVERSATION MUST BE THE CALLER'S. Same triple predicate as every
       other conversation mutation, and before the insert. */
    const ownAt = route.indexOf('.from("ai_conversations")');
    /* ANCHORED TO THE SELECT. The update further down carries the same three
       predicates, and a regex that could match either let a mutation drop the
       account check from the ownership read while the suite stayed green. */
    check("ownership is checked with the tenant+account predicate before the write",
      ownAt !== -1 && ownAt < route.indexOf(".insert(") &&
      /\.select\("id, title, message_count"\)\s*\.eq\("id", conversationId\)\s*\.eq\("tenant_id", gate\.tenantId\)\s*\.eq\("account_id", gate\.accountId\)\s*\.maybeSingle\(\)/.test(route) &&
      /if \(!conv\) return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);/.test(route));
    check("  …and the summary update is scoped the same way",
      (route.match(/\.eq\("account_id", gate\.accountId\)/g) ?? []).length === 2 &&
      (route.match(/\.eq\("tenant_id", gate\.tenantId\)/g) ?? []).length === 2);
    check("the conversation id is parsed as a UUID, not trusted as a string",
      /parseConversationParam\(/.test(route));

    /* THE BODY IS A CLOSED SHAPE. */
    check("roles come from a closed set", /role !== "user" && role !== "assistant"/.test(route));
    check("the batch and each turn are capped",
      /const MAX_TURNS = 20;/.test(route) && /list\.length > MAX_TURNS/.test(route) &&
      /trimmed\.length > MAX_TURN_CHARS/.test(route));
    check("empty text is refused", /if \(!trimmed \|\| /.test(route));
    check("via is voice or text and nothing else",
      /via !== "voice" && via !== "text"/.test(route) && /source: t\.via/.test(route));

    /* WHAT IS WRITTEN, AND WHAT IS NOT. */
    check("rows carry the tenant and the conversation",
      /tenant_id: gate\.tenantId,[\s\S]{0,40}conversation_id: conversationId,/.test(route));
    check("no model is called — a title is cut from the first user turn",
      !/aiChat|aiProviderConfigured|runAgent/.test(route) && /firstUser\.text\.slice\(0, TITLE_CHARS\)/.test(route));
    check("the conversation summary rolls by the number of turns written",
      /message_count: \(conv\.message_count \?\? 0\) \+ turns\.length/.test(route));
    check("rows go back through the provider mask like every other message",
      /withPublicProvider\(r\)/.test(route));
    /* Production must not log prompts or replies. Every console call here
       carries a count, a status or a Postgres message — never a turn. */
    const logs = route.match(/console\.\w+\([^)]*\)/g) ?? [];
    check("nothing logged names the text of a turn",
      logs.length > 0 && logs.every((l) => !/\btext\b|content|turns\[|batch/.test(l)));
    check("the vendor is not involved at all", !/sdpUrl|apiKey|AI_VOICE_/.test(route));

    /* THE COLUMN THE ROWS LAND IN, in the repo. */
    const mig = readFileSync("supabase/migrations/ai_messages_source.sql", "utf8");
    check("the migration adds ONE column with a default, so existing rows are 'text'",
      /add column if not exists source text not null default 'text'/.test(mig));
    check("  …constrained to the two values the code writes",
      /check \(source in \('text', 'voice'\)\)/.test(mig));
    check("  …with the rollback written down", /drop column source/.test(mig));
    check("  …and no new table", !/create table/i.test(mig));
  }

  console.log("\n── 14. The call knows who is on it — from the session, never from the audio ──");
  {
    /* FROM THE SAVED TRANSCRIPT: the caller told the assistant his name and
       that he was a super admin, and the assistant still could not say what
       he was allowed to see. The written lanes carry a viewer block (finding
       N7); the voice session carried nothing about the caller. */
    const v = parseVoiceOptions("Ethan:Omar");
    const owner = { name: "Kamal El Shafei", username: "kamal", role: "Owner", department: "Management", isSuperAdmin: true };
    const rep = { name: null, username: "mona", role: "Sales Rep", department: null, isSuperAdmin: false };
    const withOwner = String(buildVoiceSessionPayload(v[0], [], [], owner).full.session.instructions);
    const withRep = String(buildVoiceSessionPayload(v[0], [], [], rep).full.session.instructions);
    const nobody = String(buildVoiceSessionPayload(v[0], [], [], null).full.session.instructions);
    check("the full session names the caller from the session",
      /WHO YOU ARE TALKING TO/.test(withOwner) && withOwner.includes("Kamal El Shafei") && withOwner.includes("username kamal"));
    check("  …with role and department", withOwner.includes("role: Owner, super admin") && withOwner.includes("department: Management"));
    check("a super admin is told never to be denied",
      /never tell them they lack access/.test(withOwner) && /never that they may not see it/.test(withOwner));
    check("an ordinary user is told their permissions decide, not the call",
      !/never tell them they lack access/.test(withRep) && /decided by their permissions on each lookup/.test(withRep));
    check("a caller with no display name is addressed by username", withRep.includes(": mona (username mona)"));
    check("the block says the claim made out loud changes nothing",
      /from their signed-in session/.test(withOwner) && /never say you do not know who they are/.test(withOwner));
    check("  …and not to guess their gender", /do not assume their gender/.test(withOwner));
    check("no viewer, no block — the fixture sessions are unchanged", !/WHO YOU ARE TALKING TO/.test(nobody) &&
      JSON.stringify(buildVoiceSessionPayload(v[0], [], [], null)) === JSON.stringify(buildVoiceSessionPayload(v[0])));
    const compact = String(buildVoiceSessionPayload(v[0], [], [], owner).compact.session.instructions);
    check("the compact fallback carries one line about the caller",
      compact.includes("You are speaking with Kamal El Shafei") && /never say they lack permission/.test(compact));
    check("  …and stays small", compact.length < 3_200);

    /* THE ROUTE FEEDS IT FROM THE GATE, and the gate from buildUserContext. */
    const route = strip(readFileSync("src/app/api/ai/voice/session/route.ts", "utf8"));
    const gate = strip(readFileSync("src/lib/server/ai/voice/gate.ts", "utf8"));
    check("the route passes the gate's viewer into the session",
      /buildVoiceSessionPayload\(voice, taughtQuestions, recentTurns, gate\.viewer, sttLanguage\)/.test(route));
    check("the gate takes the viewer from the permission context, not from the request",
      /viewer: \{\s*name: ctx\.viewer\.name,/.test(gate) && /isSuperAdmin: ctx\.viewer\.isSuperAdmin,/.test(gate) &&
      !/req\.(json|text|headers)/.test(gate.slice(gate.indexOf("viewer: {"))));

    /* HOW THE CALLER IS ADDRESSED. Also from the transcript: "يا حبيبي",
       "يا ماما", and a man addressed in the feminine. */
    check("the dialect rule bans pet names and gender guessing",
      /never حبيبي/.test(withOwner) && /Do NOT guess gender from a voice/.test(withOwner) &&
      /switch fully and at once/.test(withOwner));
  }

  console.log("\n── 15. The caller's language is a hint for the transcriber — full session only, allow-listed ──");
  {
    /* THE SAVED TRANSCRIPT HAD AN EGYPTIAN SENTENCE COME BACK AS CHINESE
       CHARACTERS. A transcriber told the language does not do that. The hint
       rides only on the FULL session, because a field the far side does not
       know is a refused configuration — and the compact one is the answer to
       a refusal, so it must never carry the same field. */
    check("the three UI languages are accepted", parseSttLanguage("ar") === "ar" && parseSttLanguage("EN") === "en" && parseSttLanguage(" zh ") === "zh");
    check("anything else is no hint",
      parseSttLanguage(null) === null && parseSttLanguage("") === null && parseSttLanguage("ar-EG") === null &&
      parseSttLanguage("fr") === null && parseSttLanguage("ar; drop table") === null);
    const v = parseVoiceOptions("Ethan:Omar");
    const withHint = buildVoiceSessionPayload(v[0], [], [], null, "ar");
    const without = buildVoiceSessionPayload(v[0], [], [], null, null);
    const fullT = (withHint.full.session as { input_audio_transcription?: Record<string, unknown> }).input_audio_transcription;
    const compactT = (withHint.compact.session as { input_audio_transcription?: Record<string, unknown> }).input_audio_transcription;
    check("the full session carries the language beside the existing flag",
      fullT?.enabled === true && fullT?.language === "ar");
    check("the compact session never carries it", compactT?.enabled === true && !("language" in (compactT ?? {})));
    /* Directly, not only through the payload builder: a compact session built
       with a language handed to it must still refuse the field, because the
       compact one is what answers a refusal of exactly that field. */
    const compactDirect = buildSessionUpdate(v[0], "x", "compact", "ar").session as { input_audio_transcription?: Record<string, unknown> };
    check("  …even when handed one directly", !("language" in (compactDirect.input_audio_transcription ?? {})));
    check("no hint leaves both sessions exactly as they were",
      JSON.stringify(without) === JSON.stringify(buildVoiceSessionPayload(v[0])) &&
      !("language" in ((without.full.session as { input_audio_transcription?: object }).input_audio_transcription ?? {})));
  }

  summarised = true;
  console.log("\n── 16. A second region: configuration, order, the hint, and what the browser learns ──");
  {
    const { readAltVoiceEnv, parseRegionHint } = await import("../src/lib/server/ai/voice/config");
    process.env.AI_VOICE_ALT_BASE_URL = "https://alt.example/realtime";
    process.env.AI_VOICE_ALT_API_KEY = "alt-key";
    process.env.AI_VOICE_ALT_MODEL = "alt-model";
    process.env.AI_VOICE_ALT_REGION_LABEL = "intl";
    process.env.AI_VOICE_VOICES = "Ethan:Omar";
    const altEnv = readAltVoiceEnv();
    check("the ALT variables map into the ordinary env shape, so one parser serves both regions",
      altEnv.AI_VOICE_BASE_URL === "https://alt.example/realtime" && altEnv.AI_VOICE_API_KEY === "alt-key" && altEnv.AI_VOICE_MODEL === "alt-model" && altEnv.AI_VOICE_REGION_LABEL === "intl");
    check("  …and the voice catalogue is shared, not per region", altEnv.AI_VOICE_VOICES === "Ethan:Omar");
    const altCfg = parseVoiceConfig(altEnv);
    check("  …parsed by the same rules: https, model applied, label kept", altCfg !== null && altCfg.sdpUrl === "https://alt.example/realtime?model=alt-model" && altCfg.regionLabel === "intl");
    check("  …and refused by the same rules", parseVoiceConfig({ ...altEnv, AI_VOICE_BASE_URL: "http://alt.example" }) === null);
    delete process.env.AI_VOICE_ALT_BASE_URL; delete process.env.AI_VOICE_ALT_API_KEY; delete process.env.AI_VOICE_ALT_MODEL; delete process.env.AI_VOICE_ALT_REGION_LABEL; delete process.env.AI_VOICE_VOICES;
    check("absent ALT variables are simply no second region", parseVoiceConfig(readAltVoiceEnv()) === null);

    check("the region hint is two words and nothing else", parseRegionHint("alt") === "alt" && parseRegionHint("primary") === "primary" && parseRegionHint("cn-north") === null && parseRegionHint("https://x") === null && parseRegionHint("") === null && parseRegionHint(null) === null);

    const route = readFileSync("src/app/api/ai/voice/session/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    check("both regions are parsed, and voice is off only when NEITHER serves",
      /const primary = parseVoiceConfig\(voiceEnv\(\)\);\s*const alt = parseVoiceConfig\(altVoiceEnv\(\)\);\s*if \(!primary && !alt\)/.test(route));
    check("the primary is tried first unless the browser asked for the other one",
      /if \(hint === "alt" && alt\) candidates\.push\(\{ slot: "alt", cfg: alt \}\);\s*if \(primary\) candidates\.push\(\{ slot: "primary", cfg: primary \}\);\s*if \(alt && !candidates\.some\(\(c\) => c\.slot === "alt"\)\) candidates\.push\(\{ slot: "alt", cfg: alt \}\);/.test(route));
    check("  …a hint can only reorder endpoints the server owns — it never becomes a url", !/hint[^\n]*sdpUrl|sdpUrl[^\n]*hint/.test(route));
    check("a region that fails every attempt hands over to the next; a success stops everything",
      /regions: for \(const region of candidates\)/.test(route) && /break regions;/.test(route));
    check("with two regions each gets the long attempt and one short one, inside the ceiling",
      (() => { const m = route.match(/const TWO_REGION_ATTEMPT_BUDGETS_MS = \[([\d_, ]+)\]/); const b = m ? m[1].split(",").map((x) => Number(x.replace(/_/g, ""))) : []; const ceiling = Number(route.match(/export const maxDuration = (\d+)/)?.[1]); return b.length === 2 && b[0] === 13_000 && 2 * b.reduce((a, c) => a + c, 0) + 10_000 <= ceiling * 1000; })());
    check("the log names the slot beside the vendor label, on success and on failure",
      /handshake ok attempt=\$\{attempt\}\/\$\{budgets\.length\} slot=\$\{region\.slot\}/.test(route) && /attempt=\$\{attempt\}\/\$\{budgets\.length\} slot=\$\{region\.slot\} from=/.test(route));
    const successReturn16 = route.slice(route.lastIndexOf("return NextResponse.json("));
    check("the browser learns the SLOT that served and whether another exists — two neutral words, no label, no host",
      /region: served, alt_available: candidates\.length > 1/.test(successReturn16) && !/regionLabel|sdpUrl/.test(successReturn16));
    check("the key is still referenced once, in the header", (route.match(/cfg\.apiKey/g) ?? []).length === 1);

    const providers = readFileSync("src/app/api/ai/providers/route.ts", "utf8");
    check("the status route reports the second region in the same shape, naming ALT variables",
      /alt: altStatus/.test(providers) && /readAltVoiceEnv\(\)/.test(providers) && /replace\("AI_VOICE_", "AI_VOICE_ALT_"\)/.test(providers));

    /* PICTURES ON A CALL. The owner's call for "a heat press photo" got four
       other manufacturers' presses from the web, and the model wrote a
       markdown link into its spoken words. The session it is handed says
       which pictures come from where, and that it never writes one. */
    const sc = readFileSync("src/lib/server/ai/voice/session-config.ts", "utf8");
    check("the voice session says a machine picture is a product question, never a web picture",
      /PICTURES ON A CALL/.test(sc) && /A picture of a MACHINE, a press or any equipment is ALWAYS a Koleex[\s"+]*product question: searchProducts/.test(sc) && /never search_web, and never another[\s"+]*manufacturer's machine/.test(sc));
    check("  …and that it never writes a link, a file name or markdown into what it says", /you never write a link, a file name or[\s"+]*markdown into what you say/.test(sc));
  }

  console.log("\n── 17. Tuned from a real call: phantom turns, the filler, and the calendar pictures ──");
  {
    const sc = readFileSync("src/lib/server/ai/voice/session-config.ts", "utf8");
    check("turn detection takes more than a breath to interrupt: threshold up, padding, longer silence",
      /threshold: 0\.65,\s*prefix_padding_ms: 300,\s*silence_duration_ms: 900,/.test(sc));
    check("a turn with no words is not a question — never 'you're welcome', and a cut-off answer continues",
      /A TURN WITH NO WORDS IN IT/.test(sc) && /Never answer it with[\s"+]*\\"you're welcome\\"/.test(sc) && /CONTINUE that answer from where you stopped/.test(sc));
    check("the pause is filled with 'let me think' aloud, before the lookup — and never a search word",
      /ALWAYS SAY A SHORT FILLER ALOUD FIRST, before the lookup/.test(sc) && /let me think/.test(sc) && !/let me check/i.test(sc));
    check("web pictures on a call are opt-in: want_images, only when the caller asked to see one",
      /call search_web with want_images true; otherwise never/.test(sc));
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("NOT proved here: the SDP exchange itself. This environment cannot reach the vendor — see the header.");

})().catch((e) => {
  /* An unexpected rejection must be a NAMED failure, not an uncaught exception.
     A mutation that made probeVoice rethrow instead of reporting crashed this
     suite with a Node stack trace — which fails CI, but tells whoever reads the
     log nothing about which guarantee broke. */
  console.log(`  ✗ the suite threw instead of asserting: ${e instanceof Error ? e.message : String(e)}`);
  console.log("\nFAILED:\n  · an async section rejected — see above");
  process.exit(1);
});
