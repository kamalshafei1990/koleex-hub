#!/usr/bin/env tsx

/* ===========================================================================
   Web search with pictures (photos plan, option 2).

   search_web is the agent's only route to the public internet, and from this
   change it also carries pictures back for a user who asked to SEE something
   public. Three things are asserted here, because each is the kind that
   fails silently:

     · the PROVIDER PARSE — Tavily's `images` arrive as bare URL strings or as
       {url, description} objects; both are read, neither is trusted (https
       only, deduplicated, capped), and Brave never claims to have any;
     · the TOOL ENVELOPE — `images` appears in the result only when there are
       some, and the picture rule rides beside them where the model reads it;
     · the PROMPT — the tool loop's system prompt names the rule, so a model
       that never calls the tool still knows a picture is possible.

   Runs with --conditions=react-server: the modules are server-only.
   ========================================================================== */

import { readFileSync } from "node:fs";
import { searchWeb } from "../src/lib/server/ai/web-search";
import { webSearchTools } from "../src/lib/server/ai-agent/tools/web-search";
import { WEB_IMAGE_RULE, PRODUCT_PHOTO_RULE } from "../src/lib/server/ai/prompt-builder";
import { buildSystemPrompt } from "../src/lib/server/ai/prompts";

let pass = 0, fail = 0;
function check(label: string, ok: boolean): void {
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}`); }
}

/* A fetch stub that records the outgoing request and answers with `body`. */
let lastRequest: { url: string; init: RequestInit } | null = null;
function stubFetch(body: unknown, status = 200): void {
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    /* Picture checks are HEAD requests to the picture hosts: answered as an
       image unless the URL says otherwise, and never recorded as "the"
       request — that is the search call. */
    if (init?.method === "HEAD") {
      const u = String(url);
      if (u.includes("dead")) return new Response(null, { status: 404 });
      if (u.includes("notimage")) return new Response(null, { status: 200, headers: { "Content-Type": "text/html" } });
      return new Response(null, { status: 200, headers: { "Content-Type": "image/jpeg" } });
    }
    lastRequest = { url: String(url), init: init ?? {} };
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

const searchTheWeb = webSearchTools[0];
const ctx = { auth: { account_id: "a", tenant_id: "t" } } as never;

async function main() {
  console.log("\n── 1. Tavily: pictures are asked for on the same call, and read out defensively ──");
  process.env.TAVILY_API_KEY = "test-key";
  delete process.env.BRAVE_SEARCH_API_KEY;
  {
    stubFetch({
      answer: "Port Said is on the Mediterranean.",
      results: [{ title: "Port Said", url: "https://en.example/port-said", content: "A port city." }],
      images: [
        { url: "https://img.example/a.jpg", description: "Port Said harbour at dusk" },
        "https://img.example/b.jpg",
        { url: "http://img.example/plain.jpg", description: "not https" },
        { url: "https://img.example/a.jpg", description: "duplicate of the first" },
        { url: "javascript:alert(1)", description: "never" },
        { url: 'https://img.example/q"uote.jpg', description: "a quote in the url" },
        { url: "https://img.example/c.jpg", description: "x".repeat(400) },
        { url: "https://img.example/d.jpg" },
        { url: "https://img.example/e.jpg", description: "fifth — over the cap" },
      ],
    });
    const out = await searchWeb("Port Said port picture", { images: true });
    const body = JSON.parse(String(lastRequest?.init.body ?? "{}")) as Record<string, unknown>;
    check("the request asks Tavily for pictures — and NOT for generated descriptions, which is where the timeouts went", body.include_images === true && body.include_image_descriptions === false);
    check("  …on the ONE search call — no second request", lastRequest?.url === "https://api.tavily.com/search");
    check("the outcome is Tavily's with results and an answer", out.provider === "tavily" && out.results.length === 1 && out.answer?.startsWith("Port Said") === true);
    check("pictures are read whether Tavily sends strings or objects", out.images.some((i) => i.url === "https://img.example/a.jpg") && out.images.some((i) => i.url === "https://img.example/b.jpg"));
    check("  …a described picture keeps its caption", out.images.find((i) => i.url === "https://img.example/a.jpg")?.description === "Port Said harbour at dusk");
    check("  …an undescribed one is captioned with the query", out.images.find((i) => i.url === "https://img.example/b.jpg")?.description === "Port Said port picture");
    check("  …a long caption is cut", (out.images.find((i) => i.url === "https://img.example/c.jpg")?.description.length ?? 999) <= 160);
    check("http, javascript: and a URL with a quote are all dropped", !out.images.some((i) => !/^https:/.test(i.url) || i.url.includes('"')));
    check("a duplicate URL appears once", out.images.filter((i) => i.url === "https://img.example/a.jpg").length === 1);
    check("at most four pictures come back", out.images.length === 4 && !out.images.some((i) => i.url === "https://img.example/e.jpg"));
  }
  {
    /* A PICTURE THAT DOES NOT LOAD IS NOT SHOWN. */
    stubFetch({ results: [], images: ["https://img.example/dead.jpg", "https://img.example/notimage.jpg", "https://img.example/ok.jpg"] });
    const out = await searchWeb("Cairo stadium picture", { images: true });
    check("a dead link and a non-image are dropped before the model ever sees them; the one that loads survives",
      out.images.length === 1 && out.images[0].url === "https://img.example/ok.jpg");
    const { filterLoadableImages } = await import("../src/lib/server/ai/web-search");
    const imgs = [{ url: "https://a.example/1.jpg", description: "a" }, { url: "https://a.example/2.jpg", description: "b" }, { url: "https://a.example/3.jpg", description: "c" }];
    const kept = await filterLoadableImages(imgs, async (u) => {
      if (u.endsWith("1.jpg")) throw new Error("refused");
      if (u.endsWith("2.jpg")) return new Promise(() => {}) as never; /* never answers */
      return { ok: true, headers: { get: () => "image/png" } };
    }, 60);
    check("  …a host that refuses and a host that never answers are both dropped, within the deadline", kept.length === 1 && kept[0].url === "https://a.example/3.jpg");
    check("  …an empty list costs nothing", (await filterLoadableImages([], async () => { throw new Error("must not be called"); })).length === 0);
    const src = readFileSync("src/lib/server/ai/web-search.ts", "utf8");
    check("  …the search awaits the check on its own pictures, bounded to a second and a half", /images: await filterLoadableImages\(parseImages\(json\.images, query\)\)/.test(src) && /export const IMAGE_CHECK_TIMEOUT_MS = 1_500;/.test(src));
  }
  {
    stubFetch({ results: [{ title: "t", url: "https://x.example/1", content: "c" }] });
    const out = await searchWeb("no pictures here");
    check("a reply without an images field yields an empty list, not a crash", Array.isArray(out.images) && out.images.length === 0);
    stubFetch({ results: [{ title: "t", url: "https://x.example/1", content: "c" }], images: "https://not-a-list.example/x.jpg" });
    const odd = await searchWeb("odd shape");
    check("an images field that is not a list is ignored", odd.images.length === 0);
  }
  {
    stubFetch({}, 500);
    const out = await searchWeb("provider down");
    check("a dead provider degrades with an error AND an empty picture list", Boolean(out.error) && out.images.length === 0 && out.results.length === 0);
  }

  console.log("\n── 2. Brave: never claims pictures it did not fetch ──");
  {
    delete process.env.TAVILY_API_KEY;
    process.env.BRAVE_SEARCH_API_KEY = "brave-key";
    stubFetch({ web: { results: [{ title: "t", url: "https://x.example/1", description: "<strong>c</strong>" }] } });
    const out = await searchWeb("anything");
    check("Brave outcome carries an empty images list", out.provider === "brave" && out.results.length === 1 && out.images.length === 0);
    check("  …and its one request is the web endpoint, not an image endpoint", String(lastRequest?.url).startsWith("https://api.search.brave.com/res/v1/web/search?"));
  }
  {
    delete process.env.BRAVE_SEARCH_API_KEY;
    const out = await searchWeb("nothing configured");
    check("with no key at all the outcome is unconfigured with an empty images list", out.configured === false && out.images.length === 0);
  }

  console.log("\n── 3. The tool envelope: pictures only when there are some, the rule beside them ──");
  process.env.TAVILY_API_KEY = "test-key";
  {
    stubFetch({
      results: [{ title: "Port Said", url: "https://en.example/port-said", content: "A port city." }],
      images: [{ url: "https://img.example/a.jpg", description: "Port Said harbour" }],
    });
    const r = await searchTheWeb.handler(ctx, { query: "Port Said port picture", want_images: true });
    const data = r.data as { images?: unknown[]; usage_note: string } | null;
    check("a search with pictures returns them in the data", r.ok && Array.isArray(data?.images) && data!.images.length === 1);
    check("  …and the usage note tells the model how to show one", /PICTURES:/.test(data?.usage_note ?? "") && /at most two/.test(data?.usage_note ?? ""));
    check("  …and that a Koleex product never gets a web picture", /for Koleex products use the product's own/.test(data?.usage_note ?? ""));
    check("  …and that a picture failing to load is not an apology", /mainland China/.test(data?.usage_note ?? ""));
    check("  …with the brand rule still first", (data?.usage_note ?? "").startsWith("These are public web results"));
    check("  …sources are still the page URLs, not the pictures", Array.isArray(r.sources) && r.sources.length === 1 && r.sources[0] === "https://en.example/port-said");
  }
  {
    stubFetch({ results: [{ title: "t", url: "https://x.example/1", content: "c" }] });
    const r = await searchTheWeb.handler(ctx, { query: "USD to CNY rate" });
    const data = r.data as Record<string, unknown> | null;
    check("a search without pictures has NO images key at all", r.ok && data !== null && !("images" in data));
    check("  …and the plain brand note only", data?.usage_note === "These are public web results, for facts only. Never present another manufacturer's product as an option — Koleex only ever recommends Koleex machines. Cite the source URL for any figure you take from here, and say how fresh it is when a date is given.");
  }
  {
    const r = await searchTheWeb.handler(ctx, { query: "Alpha Textiles quotation 250000 USD margin 18%" });
    check("the egress guard still runs before any picture is fetched", !r.ok && r.permissionStatus === "allowed" && r.data === null);
  }
  check("the tool description says pictures are possible", /SHOW a picture/.test(searchTheWeb.description));

  console.log("\n── 4. The prompt: the tool loop knows a picture is possible, and where it may NOT come from ──");
  {
    const promptCtx = {
      auth: { account_id: "11111111-1111-4111-8111-111111111111", tenant_id: "22222222-2222-4222-8222-222222222222", role_id: null, department: "Sales", is_super_admin: false, can_view_private: false, username: "mona", login_email: "mona@example.com", status: "active", user_type: "employee", viewing_as: false, real_account_id: null, view_as_kind: null, view_as_role_id: null },
      modulePermissions: {}, allowedSensitiveFields: new Set<string>(), department: "Sales", isSuperAdmin: false, canViewPrivate: false, timezone: "Asia/Dubai",
      viewer: { name: "Mona Adel", username: "mona", role: "Sales Rep", department: "Sales", isSuperAdmin: false }, memory: {},
    } as never;
    const prompt = buildSystemPrompt(promptCtx, "en", { dialect: "egyptian" });
    check("the tool-loop prompt carries the web picture rule", prompt.includes(WEB_IMAGE_RULE));
    check("  …which says at most two, exact URL, never a manufacturer's machine or logo",
      /at most TWO/.test(WEB_IMAGE_RULE) && /EXACTLY as returned/.test(WEB_IMAGE_RULE) && /NEVER show another manufacturer's machine or logo/.test(WEB_IMAGE_RULE));
    check("  …and that Koleex products come from the product tools, not the web", /never use a web picture for a Koleex product/.test(WEB_IMAGE_RULE));
    check("  …and that a picture not loading is not an apology", /do not apologise/.test(WEB_IMAGE_RULE));
    /* The tool loop is the lane that actually receives photo_url from
       searchProducts — and until this change the only lane WITHOUT the
       product photo rule; the four prompt-builder lanes had it since the
       Product Data pass. */
    check("the product photo rule is a different rule, and the tool loop now carries it too", prompt.includes(PRODUCT_PHOTO_RULE) && PRODUCT_PHOTO_RULE !== WEB_IMAGE_RULE);
    const src = readFileSync("src/lib/server/ai/prompts/index.ts", "utf8");
    check("  …the web rule sits on the search_web line, where the tool is explained", /Koleex only ever recommends Koleex\.\$\{WEB_IMAGE_RULE\}/.test(src));
    check("  …the product rule sits on the PRODUCT routing line, where searchProducts is explained", /this is your own knowledge\.\$\{PRODUCT_PHOTO_RULE\}/.test(src));
  }

  console.log("\n── 4b. A MACHINE IS NEVER A WEB PICTURE — the deterministic lock ──");
  {
    const { isMachineQuery } = await import("../src/lib/server/ai/web-search");
    check("machine vocabulary is recognised in three languages",
      ["manual heat press machine 40x40", "sublimation press", "40x40 press price", "fabric cutter price", "overlock sewing", "DTF printer", "ماكينة تطريز", "مكبس حراري يدوي", "معدات خياطة", "热转印机", "裁床", "缝纫设备"].every(isMachineQuery));
    check("  …and public things are not machines", !["Cairo International Stadium", "Zamalek SC jersey", "USD to CNY rate", "weather in Guangzhou", "Port Said harbour"].some(isMachineQuery));
    process.env.TAVILY_API_KEY = "test-key";
    stubFetch({
      results: [{ title: "Heat presses", url: "https://x.example/presses", content: "A press." }],
      images: [{ url: "https://img.example/press.jpg", description: "another maker's press" }],
    });
    const out = await searchWeb("manual heat press machine 40x40");
    const body = JSON.parse(String(lastRequest?.init.body ?? "{}")) as Record<string, unknown>;
    check("a machine query does not even ASK the provider for pictures", body.include_images === false);
    check("  …and the text results still come back as reference", out.results.length === 1);
    const r = await searchTheWeb.handler(ctx, { query: "manual heat press machine 40x40" });
    const data = r.data as { images?: unknown; usage_note: string } | null;
    check("the tool result for a machine carries NO images key, whatever the provider sent", r.ok && data !== null && !("images" in data));
    check("  …and the note sends the model to the product tools, never another manufacturer", /NO PICTURES FOR MACHINES/.test(data?.usage_note ?? "") && /searchProducts/.test(data?.usage_note ?? "") && /NEVER show, link or describe another manufacturer's machine/.test(data?.usage_note ?? ""));
    check("  …with the brand rule still first", (data?.usage_note ?? "").startsWith("These are public web results"));
    /* And a public thing still gets its picture. */
    stubFetch({ results: [{ title: "Stadium", url: "https://x.example/stadium", content: "c" }], images: ["https://img.example/stadium.jpg"] });
    const r2 = await searchTheWeb.handler(ctx, { query: "Cairo International Stadium", want_images: true });
    const d2 = r2.data as { images?: unknown[] } | null;
    check("a stadium is not a machine: it still gets its picture", r2.ok && Array.isArray(d2?.images) && d2!.images.length === 1);
    /* PICTURES ARE OPT-IN. "What is the date today" came back with two
       calendar pictures; the model must say the user asked to SEE something
       before a picture is fetched or shown. */
    stubFetch({ results: [{ title: "Date", url: "https://x.example/date", content: "c" }], images: ["https://img.example/calendar.jpg"] });
    const r3 = await searchTheWeb.handler(ctx, { query: "what is the date today" });
    const b3 = JSON.parse(String(lastRequest?.init.body ?? "{}")) as Record<string, unknown>;
    const d3 = r3.data as Record<string, unknown> | null;
    check("without want_images the provider is not asked for pictures", b3.include_images === false);
    check("  …and none are shown even if the provider sent some", r3.ok && d3 !== null && !("images" in d3) && !/PICTURES:/.test(String(d3?.usage_note)));
    check("  …the schema offers want_images as a boolean the model must set deliberately", (searchTheWeb.parameters.properties as Record<string, { type: string }>).want_images?.type === "boolean" && !(searchTheWeb.parameters.required ?? []).includes("want_images"));
  }

  console.log("\n── 4c. A search that times out WITH pictures is asked again for the text alone ──");
  {
    process.env.TAVILY_API_KEY = "test-key";
    const calls: Array<Record<string, unknown>> = [];
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push(body);
      if (body.include_images === true) {
        const err = new Error("This operation was aborted"); err.name = "AbortError"; throw err;
      }
      return new Response(JSON.stringify({ results: [{ title: "Stadium", url: "https://x.example/stadium", content: "c" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const out = await searchWeb("Cairo International Stadium", { images: true });
    check("the first attempt asked for pictures and timed out; the second asked for text only", calls.length === 2 && calls[0].include_images === true && calls[1].include_images === false);
    check("  …and the caller gets the answer rather than 'nothing came back'", out.configured && !out.error && out.results.length === 1 && out.images.length === 0);
    const calls2: Array<Record<string, unknown>> = [];
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls2.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
      const err = new Error("This operation was aborted"); err.name = "AbortError"; throw err;
    }) as typeof fetch;
    const out2 = await searchWeb("Cairo International Stadium", { images: true });
    check("a second timeout is reported honestly, and there is no third attempt", calls2.length === 2 && Boolean(out2.error) && out2.results.length === 0);
    const calls4: Array<Record<string, unknown>> = [];
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls4.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
      const err = new Error("This operation was aborted"); err.name = "AbortError"; throw err;
    }) as typeof fetch;
    await searchWeb("Cairo International Stadium");
    check("a text-only search that times out is not retried — there is nothing to drop", calls4.length === 1);
    const calls3: Array<Record<string, unknown>> = [];
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls3.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
      return new Response("{}", { status: 500 });
    }) as typeof fetch;
    await searchWeb("Cairo International Stadium");
    check("a provider ERROR is not retried — only a timeout is", calls3.length === 1);
    const src = readFileSync("src/lib/server/ai/web-search.ts", "utf8");
    check("the retry has its own, shorter ceiling", /const RETRY_TIMEOUT_MS = 6_000;/.test(src) && /searchTavily\(tavily, query, false, RETRY_TIMEOUT_MS\)/.test(src));
  }

  console.log("\n── 5. Reading the source: the picture never comes from anywhere but the search reply ──");
  {
    const src = readFileSync("src/lib/server/ai/web-search.ts", "utf8");
    check("images are https-only by regex", /\^https:\\\/\\\//.test(src));
    check("the cap is four", /const MAX_IMAGES = 4;/.test(src));
    check("no image proxy: nothing in the module fetches an image URL", !/fetch\([^)]*image/i.test(src));
    const tool = readFileSync("src/lib/server/ai-agent/tools/web-search.ts", "utf8");
    check("the tool spreads images in only when non-empty — never for a machine query, never unless asked", /const images = machine \|\| !wantImages \? \[\] : outcome\.images;/.test(tool) && /\.\.\.\(images\.length > 0 \? \{ images \} : \{\}\)/.test(tool));
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
