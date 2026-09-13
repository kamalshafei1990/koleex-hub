#!/usr/bin/env tsx

/* ===========================================================================
   Image creation (photos plan, option 3).

   generate_image is the one AI surface that is PAID PER CALL and WRITES to a
   public bucket, so what is proved here is mostly what must NOT happen:

     · the CONFIG — the vendor is four variables; a plaintext url, a missing
       key or a bad size leaves the feature inert and says which variable;
     · the ADAPTER — with a stubbed fetch and a fake store: the request shape,
       the key only in a header, bytes accepted only when they are a real
       png/jpeg/webp, a vendor url fetched once and https-only, a size cap,
       a dead vendor as a cause and never a throw, the prompt never logged;
     · the TOOL — egress refused before any call, not-configured said plainly,
       the note beside the url, never a "denied";
     · the PROMPT and ROUTING — the tool loop carries the rule, and a request
       to draw leaves the tool-less lane in three languages.

   Runs with --conditions=react-server: the modules are server-only. The
   budget is skipped with AI_RATE_LIMIT=off, exactly as an operator would.
   ========================================================================== */

import { readFileSync } from "node:fs";
import {
  parseImageConfig, diagnoseImageConfig, parseImageExtraBody, sniffImage, generateImage,
  IMAGE_TIMEOUT_MS, MAX_IMAGE_BYTES, MAX_PROMPT_CHARS, type ImageMime,
} from "../src/lib/server/ai/image-gen";
import { imageGenTools, GENERATED_IMAGE_NOTE, NOT_CONFIGURED_MESSAGE, FAILED_MESSAGE } from "../src/lib/server/ai-agent/tools/image-gen";
import { listTools } from "../src/lib/server/ai-agent/tool-registry";
import { isVoiceTool } from "../src/lib/server/ai/voice/tools";
import { IMAGE_GEN_RULE } from "../src/lib/server/ai/prompt-builder";
import { buildSystemPrompt } from "../src/lib/server/ai/prompts";
import { isImageCreationRequest } from "../src/lib/server/ai/core/decide-turn";
import { BUDGETS } from "../src/lib/server/ai/security/rate-limit";

let pass = 0, fail = 0;
function check(label: string, ok: boolean): void {
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}`); }
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const TEXT = new TextEncoder().encode("<html>not an image at all</html>");
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");

const ENV = { AI_IMAGE_BASE_URL: "https://images.example/v1", AI_IMAGE_API_KEY: "sk-test", AI_IMAGE_MODEL: "paint-1" };

/* A fetch stub that records every call. */
type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): typeof fetch {
  calls = [];
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const c = { url: String(url), init: init ?? {} };
    calls.push(c);
    return handler(c.url, c.init);
  }) as typeof fetch;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let stored: Array<{ bytes: number; mime: ImageMime }> = [];
const fakeStore = async (bytes: Uint8Array, mime: ImageMime) => { stored.push({ bytes: bytes.byteLength, mime }); return "https://hub.example/storage/v1/object/public/media/ai-generated/x.png"; };

async function main() {
  console.log("\n── 1. The config: four variables, and why not ──");
  {
    check("all three present → configured, url built with /images/generations appended", parseImageConfig(ENV)?.url === "https://images.example/v1/images/generations");
    check("  …a trailing slash is not doubled", parseImageConfig({ ...ENV, AI_IMAGE_BASE_URL: "https://images.example/v1/" })?.url === "https://images.example/v1/images/generations");
    check("  …the default size is 1024x1024 and the label is the host", parseImageConfig(ENV)?.size === "1024x1024" && parseImageConfig(ENV)?.label === "images.example");
    check("  …the key is not carried in the config", !JSON.stringify(parseImageConfig(ENV)).includes("sk-test"));
    check("no key → not configured", parseImageConfig({ ...ENV, AI_IMAGE_API_KEY: "" }) === null);
    check("no model → not configured", parseImageConfig({ ...ENV, AI_IMAGE_MODEL: undefined }) === null);
    check("no url → not configured", parseImageConfig({ ...ENV, AI_IMAGE_BASE_URL: "" }) === null);
    check("http url → REFUSED, not downgraded", parseImageConfig({ ...ENV, AI_IMAGE_BASE_URL: "http://images.example/v1" }) === null);
    check("garbage url → not configured", parseImageConfig({ ...ENV, AI_IMAGE_BASE_URL: "not a url" }) === null);
    check("a custom size is kept when well-formed", parseImageConfig({ ...ENV, AI_IMAGE_SIZE: "1536x1024" })?.size === "1536x1024");
    check("  …and a malformed or absurd size leaves the feature inert", parseImageConfig({ ...ENV, AI_IMAGE_SIZE: "big" }) === null && parseImageConfig({ ...ENV, AI_IMAGE_SIZE: "9999x9999" }) === null);

    const d = diagnoseImageConfig({ AI_IMAGE_BASE_URL: "http://x.example/v1/images/generations", AI_IMAGE_SIZE: "big" });
    check("diagnosis names every missing or wrong variable", d.some((p) => p.startsWith("AI_IMAGE_MODEL")) && d.some((p) => p.startsWith("AI_IMAGE_API_KEY")) && d.some((p) => /not https/.test(p)) && d.some((p) => /duplicated/.test(p)) && d.some((p) => p.startsWith("AI_IMAGE_SIZE")));
    check("  …and never a value", !d.join(" ").includes("x.example"));
    check("  …a well-formed but unconfigured set is told to redeploy", /redeploy/.test(diagnoseImageConfig(ENV).join(" ")));
    check("extra body: protected keys are dropped, others kept", JSON.stringify(parseImageExtraBody('{"model":"evil","prompt":"evil","n":10,"response_format":"url","quality":"hd"}')) === '{"quality":"hd"}');
    check("  …malformed JSON is ignored, not fatal", JSON.stringify(parseImageExtraBody("{nope")) === "{}" && JSON.stringify(parseImageExtraBody("[1]")) === "{}");
  }

  console.log("\n── 2. The bytes: only a real picture goes into the bucket ──");
  {
    check("png, jpeg and webp are recognised from their first bytes", sniffImage(PNG) === "image/png" && sniffImage(JPG) === "image/jpeg" && sniffImage(WEBP) === "image/webp");
    check("html, an empty buffer and a short buffer are not", sniffImage(TEXT) === null && sniffImage(new Uint8Array(0)) === null && sniffImage(new Uint8Array([0x89, 0x50])) === null);
  }

  console.log("\n── 3. The adapter, against a stubbed vendor ──");
  {
    const env = { ...ENV, AI_IMAGE_EXTRA_BODY: '{"quality":"hd","model":"evil"}' };
    const f = stubFetch(() => json({ data: [{ b64_json: b64(PNG), revised_prompt: "x" }] }));
    stored = [];
    const out = await generateImage("  a   poster of a   port  ", { fetch: f, store: fakeStore, env });
    check("a base64 reply becomes a stored picture with a url", out.configured && out.ok && out.url.startsWith("https://") && out.mime === "image/png");
    check("  …stored with the sniffed mime, not a header", stored.length === 1 && stored[0].mime === "image/png");
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    check("  …one POST to {base}/images/generations", calls.length === 1 && calls[0].url === "https://images.example/v1/images/generations" && calls[0].init.method === "POST");
    check("  …with the model, ONE picture, b64 asked for, the size, and the whitespace-collapsed prompt", body.model === "paint-1" && body.n === 1 && body.response_format === "b64_json" && body.size === "1024x1024" && body.prompt === "a poster of a port");
    check("  …the extra body rides along but cannot replace the model", body.quality === "hd" && body.model === "paint-1");
    const headers = calls[0].init.headers as Record<string, string>;
    check("  …the key travels ONLY in the Authorization header", headers.Authorization === "Bearer sk-test" && !String(calls[0].init.body).includes("sk-test") && !calls[0].url.includes("sk-test"));
    check("  …and never in the outcome", !JSON.stringify(out).includes("sk-test"));
  }
  {
    const f = stubFetch((url) => url.endsWith("/images/generations") ? json({ data: [{ url: "https://cdn.vendor.example/pic.jpg" }] }) : new Response(JPG, { status: 200, headers: { "Content-Type": "image/jpeg" } }));
    stored = [];
    const out = await generateImage("a scene", { fetch: f, store: fakeStore, env: ENV });
    check("a url reply is fetched once, server-side, and stored as what its bytes are", out.configured && out.ok && out.mime === "image/jpeg" && calls.length === 2 && calls[1].url === "https://cdn.vendor.example/pic.jpg" && stored[0]?.mime === "image/jpeg");
    check("  …the follow-up fetch carries NO Authorization header (the vendor's CDN is not the vendor)", !((calls[1].init.headers as Record<string, string> | undefined)?.Authorization));
  }
  {
    const f = stubFetch(() => json({ data: [{ url: "http://cdn.vendor.example/pic.jpg" }] }));
    const out = await generateImage("a scene", { fetch: f, store: fakeStore, env: ENV });
    check("an http vendor url is NOT fetched", calls.length === 1 && out.configured && !out.ok && /no image/.test(out.error));
  }
  {
    const f = stubFetch(() => json({ data: [{ b64_json: b64(TEXT) }] }));
    stored = [];
    const out = await generateImage("a scene", { fetch: f, store: fakeStore, env: ENV });
    check("bytes that are not a picture are refused and NOT stored", out.configured && !out.ok && /not a png/.test(out.error) && stored.length === 0);
  }
  {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1); big.set(PNG);
    const f = stubFetch(() => json({ data: [{ b64_json: b64(big) }] }));
    stored = [];
    const out = await generateImage("a scene", { fetch: f, store: fakeStore, env: ENV });
    check("an oversized picture is refused and NOT stored", out.configured && !out.ok && /too large/.test(out.error) && stored.length === 0);
    /* The body here is a SMALL, valid png under a Content-Length that says
       otherwise: only a check on the header refuses it. Reading the body
       would have accepted it. */
    const f2 = stubFetch((url) => url.endsWith("/images/generations") ? json({ data: [{ url: "https://cdn.vendor.example/big.png" }] }) : new Response(PNG, { status: 200, headers: { "Content-Length": String(MAX_IMAGE_BYTES + 1) } }));
    const out2 = await generateImage("a scene", { fetch: f2, store: fakeStore, env: ENV });
    check("  …and an oversized vendor url is refused by its Content-Length before the body is read", out2.configured && !out2.ok && stored.length === 0);
  }
  {
    const f = stubFetch(() => json({ error: { message: "insufficient credit" } }, 402));
    const out = await generateImage("a scene", { fetch: f, store: fakeStore, env: ENV });
    check("a vendor error is a cause with its status, never a throw", out.configured && !out.ok && out.error === "vendor returned 402");
    const f2 = stubFetch(() => new Response("<html>", { status: 200 }));
    const out2 = await generateImage("a scene", { fetch: f2, store: fakeStore, env: ENV });
    check("  …a non-JSON reply too", out2.configured && !out2.ok && /not JSON/.test(out2.error));
    const f3 = stubFetch(() => { throw new TypeError("fetch failed"); });
    const out3 = await generateImage("a scene", { fetch: f3, store: fakeStore, env: ENV });
    check("  …and a dead socket", out3.configured && !out3.ok && out3.error === "network");
    const f4 = stubFetch(() => json({ data: [{ b64_json: b64(PNG) }] }));
    const out4 = await generateImage("a scene", { fetch: f4, store: async () => null, env: ENV });
    check("  …and a store that fails", out4.configured && !out4.ok && /store/.test(out4.error));
  }
  {
    const f = stubFetch(() => json({ data: [{ b64_json: b64(PNG) }] }));
    const out = await generateImage("a scene", { fetch: f, store: fakeStore, env: { ...ENV, AI_IMAGE_API_KEY: "" } });
    check("unconfigured → no call at all, reported as not configured", !out.configured && calls.length === 0);
    const out2 = await generateImage("   ", { fetch: f, store: fakeStore, env: ENV });
    check("an empty prompt → no call at all", out2.configured && !out2.ok && calls.length === 0);
    const long = "x".repeat(MAX_PROMPT_CHARS + 500);
    await generateImage(long, { fetch: f, store: fakeStore, env: ENV });
    check("a long prompt is cut to the cap before it leaves", (JSON.parse(String(calls[0].init.body)) as { prompt: string }).prompt.length === MAX_PROMPT_CHARS);
    check("the timeout is a real bound, not a default fetch", IMAGE_TIMEOUT_MS <= 60_000 && calls[0].init.signal instanceof AbortSignal);
  }

  console.log("\n── 4. The tool: refuse first, pay second, say it plainly ──");
  process.env.AI_RATE_LIMIT = "off";
  delete process.env.AI_IMAGE_BASE_URL; delete process.env.AI_IMAGE_API_KEY; delete process.env.AI_IMAGE_MODEL;
  const tool = imageGenTools[0];
  const ctx = { auth: { account_id: "11111111-1111-4111-8111-111111111111", tenant_id: "22222222-2222-4222-8222-222222222222" } } as never;
  {
    check("the tool is registered as generate_image", listTools().some((t) => t.name === "generate_image"));
    check("  …internal users only, no module gate, a view action", tool.minRole === "internal" && tool.requiredModule === undefined && tool.requiredAction === "view");
    check("  …and it is NOT a voice tool: a call cannot spend on pictures", !isVoiceTool("generate_image"));
    check("  …its description says never Koleex data, never another maker's logo, and that it costs money", /NEVER put Koleex's own data/.test(tool.description) && /another manufacturer's name or logo/.test(tool.description) && /costs money/.test(tool.description));
  }
  {
    globalThis.fetch = stubFetch(() => json({ data: [{ b64_json: b64(PNG) }] }));
    const r = await tool.handler(ctx, { prompt: "Alpha Textiles quotation 250000 USD margin 18%" });
    check("a prompt carrying Koleex data is refused before any call, and not as a denial", !r.ok && r.permissionStatus === "allowed" && r.data === null && calls.length === 0);
    check("  …refused by the SCANNER — not merely because nothing is configured yet", r.message !== NOT_CONFIGURED_MESSAGE && /Koleex|internal|public/i.test(r.message ?? ""));
    const r2 = await tool.handler(ctx, { prompt: "" });
    check("an empty prompt is refused", !r2.ok && calls.length === 0);
  }
  {
    globalThis.fetch = stubFetch(() => json({ data: [{ b64_json: b64(PNG) }] }));
    const r = await tool.handler(ctx, { prompt: "a poster of a port at dawn" });
    check("unconfigured: said plainly, no call, not a denial", !r.ok && r.permissionStatus === "allowed" && r.message === NOT_CONFIGURED_MESSAGE && calls.length === 0);
    check("  …the message tells the model not to invent a picture", /Say so plainly/.test(NOT_CONFIGURED_MESSAGE) && /without inventing an image/.test(FAILED_MESSAGE));
  }
  {
    process.env.AI_IMAGE_BASE_URL = ENV.AI_IMAGE_BASE_URL; process.env.AI_IMAGE_API_KEY = ENV.AI_IMAGE_API_KEY; process.env.AI_IMAGE_MODEL = ENV.AI_IMAGE_MODEL;
    globalThis.fetch = stubFetch(() => json({ error: { message: "nope" } }, 500));
    const r = await tool.handler(ctx, { prompt: "a poster of a port at dawn" });
    check("configured but failing: the failure message, not a denial, no url", !r.ok && r.permissionStatus === "allowed" && r.message === FAILED_MESSAGE && r.data === null && calls.length === 1);
    check("the note beside a picture says generated, never a Koleex product, one per request", /GENERATED illustration/.test(GENERATED_IMAGE_NOTE) && /NEVER present it as a Koleex product/.test(GENERATED_IMAGE_NOTE) && /One picture per request/.test(GENERATED_IMAGE_NOTE));
    const src = readFileSync("src/lib/server/ai-agent/tools/image-gen.ts", "utf8");
    check("the success envelope carries the url and that note", /data: \{ image_url: outcome\.url, usage_note: GENERATED_IMAGE_NOTE \}/.test(src));
    check("the budget is consumed BEFORE the vendor is called", src.indexOf("consumeBudget(") < src.indexOf("await generateImage(") && src.indexOf("scanEgress(") < src.indexOf("consumeBudget("));
    check("  …both per account and per tenant", /BUDGETS\.imagePerAccount\(\)/.test(src) && /BUDGETS\.imagePerTenant\(\)/.test(src));
    check("  …and the budgets are hourly per account, daily per tenant", BUDGETS.imagePerAccount().windowSec === 3600 && BUDGETS.imagePerAccount().max === 10 && BUDGETS.imagePerTenant().windowSec === 86_400 && BUDGETS.imagePerTenant().max === 100);
    check("the picture is stored under the caller's own tenant and account, never upserted", /const PREFIX = "ai-generated"/.test(src) && /\$\{PREFIX\}\/\$\{tenantId\}\/\$\{accountId\}\//.test(src) && /upsert: false/.test(src));
    check("  …in the public media bucket the product photos already use", /const BUCKET = "media"/.test(src));
    check("no 'denied' anywhere in the tool: nothing here is a permission", !/permissionStatus: "denied"/.test(src));
  }

  console.log("\n── 5. The prompt and the routing ──");
  {
    const promptCtx = {
      auth: { account_id: "11111111-1111-4111-8111-111111111111", tenant_id: "22222222-2222-4222-8222-222222222222", role_id: null, department: "Sales", is_super_admin: false, can_view_private: false, username: "mona", login_email: "mona@example.com", status: "active", user_type: "employee", viewing_as: false, real_account_id: null, view_as_kind: null, view_as_role_id: null },
      modulePermissions: {}, allowedSensitiveFields: new Set<string>(), department: "Sales", isSuperAdmin: false, canViewPrivate: false, timezone: "Asia/Dubai",
      viewer: { name: "Mona Adel", username: "mona", role: "Sales Rep", department: "Sales", isSuperAdmin: false }, memory: {},
    } as never;
    const prompt = buildSystemPrompt(promptCtx, "en", { dialect: "egyptian" });
    check("the tool-loop prompt carries the image rule", prompt.includes(IMAGE_GEN_RULE));
    check("  …which says one picture, generated, never a Koleex product, never invent a url", /ONE picture per request/.test(IMAGE_GEN_RULE) && /NEVER generate a picture OF a Koleex product/.test(IMAGE_GEN_RULE) && /never invent an image url/.test(IMAGE_GEN_RULE));
    const idx = readFileSync("src/lib/server/ai/prompts/index.ts", "utf8");
    check("  …placed beside the web picture rule on the search_web line", /\$\{WEB_IMAGE_RULE\}\$\{IMAGE_GEN_RULE\}/.test(idx));

    check("a request to MAKE a picture leaves the tool-less lane, in three languages",
      isImageCreationRequest("draw me a poster for the Canton Fair stand") &&
      isImageCreationRequest("can you generate an image of a cutting room at dawn") &&
      isImageCreationRequest("design a banner for our booth") &&
      isImageCreationRequest("an illustration of a spreading table") &&
      isImageCreationRequest("ارسملي بوستر للمعرض") &&
      isImageCreationRequest("اعمل لي صورة لخط إنتاج") &&
      isImageCreationRequest("صمم لوجو لقسم الجودة") &&
      isImageCreationRequest("画一张海报") &&
      isImageCreationRequest("生成一个图片"));
    check("  …a verb without a picture noun, or a noun without a verb, does not fire",
      !isImageCreationRequest("make a task for tomorrow") && !isImageCreationRequest("create a meeting with Ahmed") &&
      !isImageCreationRequest("the image is clear, let's proceed") && !isImageCreationRequest("show me a picture of Port Said") &&
      !isImageCreationRequest("اعمل ميتنج بكرة") && !isImageCreationRequest("安排会议"));
    const orch = readFileSync("src/lib/server/ai-agent/orchestrator.ts", "utf8");
    const route = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
    check("  …and both gates — the orchestrator's and the route's short-circuit — honour it", /isImageCreationRequest\(userMessage\)/.test(orch) && /isImageCreationRequest\(normalizedContent\)/.test(route));
  }

  console.log("\n── 6. Reading the source: what is never logged, never fetched ──");
  {
    const src = readFileSync("src/lib/server/ai/image-gen.ts", "utf8");
    const logs = src.match(/console\.(log|warn|error)\([^)]*\)/g) ?? [];
    check("no log line carries the prompt, the key or the bytes", logs.length > 0 && logs.every((l) => !/prompt|key|b64|bytes\b(?!=)/.test(l.replace(/bytes=\$\{bytes\.byteLength\}/, ""))));
    check("a vendor url is fetched only over https", /if \(!\/\^https:\\\/\\\/\/i\.test\(url\)\) return null;/.test(src));
    check("the status route reports image creation with the same not_configured_because shape", /image: imageStatus/.test(readFileSync("src/app/api/ai/providers/route.ts", "utf8")));
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
