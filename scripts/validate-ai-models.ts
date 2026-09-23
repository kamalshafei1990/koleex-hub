/* ---------------------------------------------------------------------------
   validate:ai-models — the Koleex AI models the user chooses between.

   Owner, 2026-09-23: three providers become three Koleex models — Blink,
   Mind, Deep — plus Auto, the default. What must hold:

     1. The catalog is what the picker shows, in three languages, and it
        never names a vendor.
     2. The client ASKS; the server decides — an unknown or switched-off
        model is Auto.
     3. The chosen model goes first and the others stay behind it as
        failover: a choice can never leave a user without an answer.
     4. The browser is told which Koleex model answered, by Koleex name, and
        never credited to a model when none answered.
     5. The route, the orchestrator and the new endpoint are wired that way.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import {
  KOLEEX_MODELS,
  KOLEEX_SERVING_MODELS,
  KOLEEX_MODEL_INFO,
  DEFAULT_KOLEEX_MODEL,
  normalizeKoleexModel,
  normalizeServingModel,
} from "../src/lib/ai/koleex-models";
import {
  adapterForModel,
  parseDisabledModels,
  resolveRequestedModel,
  servedKoleexModel,
  modelAvailability,
  modelAvailable,
} from "../src/lib/server/ai/provider/koleex-model-slots";
import { preferFirst, chatWithToolsVia } from "../src/lib/server/ai/provider/registry";
import { deepseekAdapter } from "../src/lib/server/ai/provider/adapters/deepseek";
import { openAiCompatibleAdapter, secondFallbackAdapter } from "../src/lib/server/ai/provider/adapters/openai-compatible";
import { createBreaker } from "../src/lib/server/ai/router/circuit-breaker";
import type { ProviderAdapter, TurnOutcome } from "../src/lib/server/ai/provider/types";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
}

const VENDOR = /deepseek|qwen|dashscope|alibaba|aliyun|grok|x\.ai|xai|openai|gpt|gemini|google|anthropic|claude|llama|mistral|moonshot|kimi|zhipu/i;

async function main() {
  console.log("\n── 1. The catalog ──");
  check("Auto first, then fastest to deepest", JSON.stringify(KOLEEX_MODELS) === JSON.stringify(["auto", "blink", "mind", "deep"]));
  check("three models can serve; Auto is a choice, not one of them", JSON.stringify(KOLEEX_SERVING_MODELS) === JSON.stringify(["blink", "mind", "deep"]));
  check("Auto is the default for everyone (owner decision 3)", DEFAULT_KOLEEX_MODEL === "auto");
  check("every model has a name and a line in English, Chinese and Arabic",
    KOLEEX_MODELS.every((id) => {
      const i = KOLEEX_MODEL_INFO[id];
      return i.id === id && (["en", "zh", "ar"] as const).every((l) => i.name[l].trim().length > 0 && i.blurb[l].trim().length > 0);
    }));
  check("the brand names are the owner's and are not translated",
    (["blink", "mind", "deep"] as const).every((id) =>
      (["en", "zh", "ar"] as const).every((l) => KOLEEX_MODEL_INFO[id].name[l] === `Koleex ${id[0].toUpperCase()}${id.slice(1)}`)));
  check("Mind is text only; Blink, Deep and Auto can hold a call",
    KOLEEX_MODEL_INFO.mind.voice === false && KOLEEX_MODEL_INFO.blink.voice && KOLEEX_MODEL_INFO.deep.voice && KOLEEX_MODEL_INFO.auto.voice);
  const catalogSrc = readFileSync("src/lib/ai/koleex-models.ts", "utf8");
  check("the catalog the browser ships names no vendor — not in a name, a line, or a comment",
    !VENDOR.test(catalogSrc) && !VENDOR.test(JSON.stringify(KOLEEX_MODEL_INFO)));
  check("…and it is not server-only, because the picker renders it", !/import "server-only"/.test(catalogSrc));

  console.log("\n── 2. The client asks; the server decides ──");
  check("a known model is itself", normalizeKoleexModel("deep") === "deep" && normalizeKoleexModel("blink") === "blink");
  for (const bad of ["Deep", "turbo", "", " mind", null, undefined, 3, {}, ["mind"]]) {
    check(`…anything else is Auto (${JSON.stringify(bad)})`, normalizeKoleexModel(bad) === "auto");
  }
  check("a served model is one of the three, or null", normalizeServingModel("mind") === "mind" && normalizeServingModel("auto") === null && normalizeServingModel("x") === null);
  const off = parseDisabledModels(" Deep , blink,auto,nope ");
  check("the operator switch reads names, case-insensitively, and can never switch off Auto", off.has("deep") && off.has("blink") && off.size === 2);
  check("no switch at all is nothing switched off", parseDisabledModels(undefined).size === 0 && parseDisabledModels("").size === 0);
  check("a switched-off model is served as Auto", resolveRequestedModel("deep", off) === "auto" && resolveRequestedModel("mind", off) === "mind");
  check("an unknown request is Auto whatever the switch", resolveRequestedModel("gpt", new Set()) === "auto");
  check("a switched-off model is unavailable to the picker", modelAvailable("deep", off) === false);

  console.log("\n── 3. The choice goes first; failover stays ──");
  check("each model stands for its slot, Auto for none",
    adapterForModel("auto") === null && adapterForModel("mind") === deepseekAdapter &&
      adapterForModel("blink") === openAiCompatibleAdapter && adapterForModel("deep") === secondFallbackAdapter);

  const fake = (name: string, out: TurnOutcome | (() => TurnOutcome), configured = true): ProviderAdapter & { calls: number } => {
    const a = {
      name,
      calls: 0,
      configured: () => configured,
      model: () => `${name}-m`,
      chat: async () => {
        a.calls++;
        return typeof out === "function" ? out() : out;
      },
    };
    return a;
  };
  const ok = (text: string): TurnOutcome => ({ ok: true, response: { content: text, toolCalls: [], finishReason: "stop", usage: { inputTokens: null, outputTokens: null } } });
  const down: TurnOutcome = { ok: false, status: 503, bodyText: "down" };
  const req = { messages: [{ role: "user" as const, content: "hi" }], maxTokens: 4, temperature: 0 };

  {
    const A = fake("a", ok("A")), B = fake("b", ok("B")), C = fake("c", ok("C"));
    check("preferFirst moves the chosen one to the front and keeps the rest in order",
      preferFirst([A, B, C], C).map((x) => x.name).join() === "c,a,b");
    check("…no preference, or one that is not a candidate, changes nothing",
      preferFirst([A, B, C], null).map((x) => x.name).join() === "a,b,c" && preferFirst([A, B], C).map((x) => x.name).join() === "a,b");
    const out = await chatWithToolsVia([A, B, C], req, { prefer: C, breaker: createBreaker() });
    check("the chosen model answers first", out.ok && out.servedBy === "c" && A.calls === 0 && B.calls === 0);
  }
  {
    const A = fake("a", ok("A")), B = fake("b", ok("B")), C = fake("c", down);
    const out = await chatWithToolsVia([A, B, C], req, { prefer: C, breaker: createBreaker() });
    check("a chosen model that is down fails over — the user is still answered, by the next in order",
      out.ok && out.servedBy === "a" && C.calls === 1 && out.failedOver === true);
  }
  {
    const A = fake("a", ok("A")), C = fake("c", ok("C"), false);
    const out = await chatWithToolsVia([A, C], req, { prefer: C, breaker: createBreaker() });
    check("a chosen model that is not configured is skipped, not attempted", out.ok && out.servedBy === "a" && C.calls === 0);
  }
  {
    const A = fake("a", ok("A")), C = fake("c", down);
    const out = await chatWithToolsVia([A, C], req, { prefer: C, failover: false, breaker: createBreaker() });
    check("the kill-switch still holds: with failover off, the chosen model's failure is the answer", !out.ok && A.calls === 0);
  }

  console.log("\n── 4. The browser is told which Koleex model answered ──");
  const slots = {
    mind: fake("primary", ok("")),
    blink: fake("backup-one", ok("")),
    deep: fake("fallback2", ok(""), false),
  };
  check("a served label maps to its Koleex model by the adapter half only",
    servedKoleexModel("primary:some-model", slots) === "mind" &&
      servedKoleexModel("backup-one:m:fast-small+search", slots) === "blink");
  check("no model is credited when none answered — canned, degraded, none, unknown",
    ["fast-path", "fallback", "none", "unknown", "", null, undefined].every((l) => servedKoleexModel(l, slots) === null));
  check("an unconfigured slot is never credited, even when its placeholder name matches",
    servedKoleexModel("fallback2:x", slots) === null);
  check("a configured model is available until an operator switches it off",
    modelAvailable("mind", new Set(), slots) === true && modelAvailable("mind", parseDisabledModels("mind"), slots) === false);
  check("…and an unconfigured one is never offered", modelAvailable("deep", new Set(), slots) === false);
  const avail = modelAvailability();
  check("the picker's list has the four models, Auto always available",
    avail.map((m) => m.id).join() === "auto,blink,mind,deep" && avail[0].available === true);
  check("…and carries names and booleans only — no vendor, no model id",
    avail.every((m) => Object.keys(m).sort().join() === "available,id") && !VENDOR.test(JSON.stringify(avail)));

  console.log("\n── 5. Wiring ──");
  const route = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
  check("the route resolves the request on the server and derives the preference from it",
    /const chosenModel = resolveRequestedModel\(body\.model\);\s*const prefer = adapterForModel\(chosenModel\);/.test(route));
  check("both fast-lane calls carry the preference",
    (route.match(/\{ onDelta, prefer \}/g) ?? []).length === 2 && !/\{ onDelta \},/.test(route));
  check("both orchestrator calls carry the chosen model",
    (route.match(/orchestrate\(\{\s*model: chosenModel,/g) ?? []).length === 2);
  check("every response names the Koleex model that answered, next to the public provider label",
    (route.match(/agent: withPublicProvider\(agent\),\s*\/\*[\s\S]*?\*\/\s*model: servedKoleexModel\(agent\.provider\),/g) ?? []).length === 4 &&
      (route.match(/agent: withPublicProvider\(agent\),/g) ?? []).length === 4);
  check("the fast lane labels the provider that SERVED, not the one predicted",
    (route.match(/fastProvider = `\$\{out\.servedBy \? `\$\{out\.servedBy\}:\$\{out\.model \?\? "unknown"\}` : activeProviderLabel\(\)\}:fast-/g) ?? []).length === 2);
  const orch = readFileSync("src/lib/server/ai-agent/orchestrator.ts", "utf8");
  check("the orchestrator turns the model into a preference and passes it on both calls",
    /model = "auto",\s*\} = input;/.test(orch) && /const prefer = adapterForModel\(model\);/.test(orch) &&
      /\}, \{ prefer \}\);/.test(orch) && /liveEmit \? \{ onDelta: liveEmit, prefer \} : \{ prefer \},/.test(orch));
  const reg = readFileSync("src/lib/server/ai/provider/registry.ts", "utf8");
  check("the registry reorders only the CONFIGURED candidates, before the breaker",
    /const candidates = preferFirst\(configuredAdapters\(adapters\), opts\?\.prefer \?\? null\);/.test(reg));
  const modelsRoute = readFileSync("src/app/api/ai/models/route.ts", "utf8");
  check("the models endpoint is behind the same door as every Koleex AI endpoint",
    /const auth = await requireAuth\(\);\s*if \(auth instanceof NextResponse\) return auth;\s*const notInternal = requireInternalUser\(auth\);\s*if \(notInternal\) return notInternal;/.test(modelsRoute) &&
      /models: modelAvailability\(\)/.test(modelsRoute) && /private, no-store/.test(modelsRoute));
  check("…and the versioned path is the same handler", /export \{ GET \} from "\.\.\/\.\.\/\.\.\/ai\/models\/route";/.test(readFileSync("src/app/api/v1/ai/models/route.ts", "utf8")));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
