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
    const out = await searchWeb("Port Said port picture");
    const body = JSON.parse(String(lastRequest?.init.body ?? "{}")) as Record<string, unknown>;
    check("the request asks Tavily for pictures with descriptions", body.include_images === true && body.include_image_descriptions === true);
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
    const r = await searchTheWeb.handler(ctx, { query: "Port Said port picture" });
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

  console.log("\n── 5. Reading the source: the picture never comes from anywhere but the search reply ──");
  {
    const src = readFileSync("src/lib/server/ai/web-search.ts", "utf8");
    check("images are https-only by regex", /\^https:\\\/\\\//.test(src));
    check("the cap is four", /const MAX_IMAGES = 4;/.test(src));
    check("no image proxy: nothing in the module fetches an image URL", !/fetch\([^)]*image/i.test(src));
    const tool = readFileSync("src/lib/server/ai-agent/tools/web-search.ts", "utf8");
    check("the tool spreads images in only when non-empty", /\.\.\.\(outcome\.images\.length > 0 \? \{ images: outcome\.images \} : \{\}\)/.test(tool));
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
