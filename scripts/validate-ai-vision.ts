/* ---------------------------------------------------------------------------
   validate:ai-vision — a picture is read FOR the question, quickly, through a
   provider the environment chooses (2026-09-04).
   --------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { buildVisionPrompt, parseVisionConfig, questionForPrompt } from "../src/lib/server/ai/vision";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean | (() => boolean)) {
  let ok = false;
  try { ok = typeof cond === "function" ? cond() : cond; } catch (e) { label += ` (threw: ${e instanceof Error ? e.message : String(e)})`; }
  if (ok) { pass++; console.log(`  ✓ ${label}`); } else { failures.push(label); console.log(`  ✗ ${label}`); }
}

console.log("── 1. The configured provider ──");
{
  const good = parseVisionConfig({ AI_VISION_BASE_URL: "https://vision.example/compatible-mode/v1/", AI_VISION_API_KEY: "k", AI_VISION_MODEL: "some-vl" });
  check("base url + key + model → the chat-completions URL, the model, the host as label — never the key",
    !!good && good.url === "https://vision.example/compatible-mode/v1/chat/completions" && good.model === "some-vl" && good.label === "vision.example" &&
    !JSON.stringify(good).includes('"k"'));
  check("a base url already ending in /chat/completions is not doubled",
    parseVisionConfig({ AI_VISION_BASE_URL: "https://v.example/v1/chat/completions", AI_VISION_API_KEY: "k", AI_VISION_MODEL: "m" })?.url === "https://v.example/v1/chat/completions");
  check("missing any of the three → not configured; plaintext http → refused",
    parseVisionConfig({ AI_VISION_BASE_URL: "https://v.example/v1", AI_VISION_MODEL: "m" }) === null &&
    parseVisionConfig({ AI_VISION_BASE_URL: "https://v.example/v1", AI_VISION_API_KEY: "k" }) === null &&
    parseVisionConfig({ AI_VISION_API_KEY: "k", AI_VISION_MODEL: "m" }) === null &&
    parseVisionConfig({ AI_VISION_BASE_URL: "http://v.example/v1", AI_VISION_API_KEY: "k", AI_VISION_MODEL: "m" }) === null &&
    parseVisionConfig({ AI_VISION_BASE_URL: "not a url", AI_VISION_API_KEY: "k", AI_VISION_MODEL: "m" }) === null);
}

console.log("\n── 2. The prompt ──");
{
  check("the user's words are one line, capped, and lead the prompt; without them the old general reading stands",
    questionForPrompt("  what\nis   this ?  ") === "what is this ?" && questionForPrompt("x".repeat(400)).length === 301 &&
    buildVisionPrompt("what is this ?").startsWith('A colleague who cannot see this image asked: "what is this ?". Describe what they need in order to answer that, first and briefly.') &&
    buildVisionPrompt("").startsWith("Describe this image for a colleague who cannot see it"));
  check("the reading stays short unless it is a document or table; codes and totals are still transcribed; no guessing",
    /otherwise keep the whole reading under 150 words/.test(buildVisionPrompt("q")) && /reproduce its content in reading order/.test(buildVisionPrompt("q")) &&
    /model codes, serial numbers, part numbers, brand names/.test(buildVisionPrompt("q")) && /Do not guess/.test(buildVisionPrompt("q")));
}

console.log("\n── 3. The module, read ──");
{
  const src = readFileSync("src/lib/server/ai/vision.ts", "utf8");
  check("the configured provider is tried FIRST, the default provider answers when there is none or it failed; every path returns null, never throws",
    /if \(configured\) \{\s*const text = await askProvider\(configured, configuredKey, prompt, dataUrl\);\s*if \(text\) return \{ text \};\s*\}\s*if \(defaultKey\) \{/.test(src) &&
    /if \(!configured && !defaultKey\) return null;/.test(src) && !/\bthrow\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")));
  check("logs carry the host label, timing and counts — never the reading, never a model name in the result",
    /console\.log\(`\[ai\.vision\] ok via=\$\{provider\.label\} ms=\$\{Date\.now\(\) - t0\} chars=\$\{text\.length\}`\)/.test(src) &&
    /export interface VisionResult \{\s*text: string;\s*\}/.test(src));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: a live vision provider — reading a real photo through the configured one is the test.");
