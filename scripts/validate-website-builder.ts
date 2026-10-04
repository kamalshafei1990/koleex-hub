/* ---------------------------------------------------------------------------
   validate:website-builder — the Website app's Page Builder (Phase 3 step 3,
   owner 30/09/2026). A page built here goes out to the PUBLIC site, so the
   rules that keep it safe are pinned rather than remembered:
     · every builder route opens with guardWebsite (signed in, the Website
       module, the host company only); changes need the action, never view;
     · only the super admins and «Website Publish» publish; never under
       view-as;
     · every saved or published page passes cleanPageDoc (known shape, texts
       cut, safe links only, the Hub's own photos only);
     · a stale save is refused (409), publishing keeps a version and tells
       the site to refresh the page;
     · photos: the public bucket website-media, raster types checked by
       their first bytes (never SVG), 8 MB;
     · the bridge serves the PUBLISHED document — the draft only with
       ?draft=1, behind the key — and a page never published keeps the old
       editor's sections;
     · a missing Arabic or Chinese word falls back to English; only English
       is required to publish (owner's picks).
   --------------------------------------------------------------------------- */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./lib/strip-comments";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.log(`  ✗ ${label}`); }
}
const code = (p: string) => stripComments(readFileSync(p, "utf8"));
function between(src: string, from: string, to: string | null): string {
  const a = src.indexOf(from);
  const b = to === null ? src.length : src.indexOf(to, a + 1);
  if (a < 0 || b < 0) { failures.push(`marker missing: ${a < 0 ? from : to}`); console.log(`  ✗ marker missing: ${a < 0 ? from : to}`); return ""; }
  return src.slice(a, b);
}

const DOC = "src/lib/website/page-doc.ts";
const PAGES = "src/lib/server/website/pages.ts";
const GUARD = "src/lib/server/website/guard.ts";
const CATALOG = "src/lib/server/website-catalog.ts";
const MIGRATION = "supabase/migrations/20260930_website_builder.sql";

/* ── 1. The routes ── */
console.log("\n1. Every builder route is guarded");
const routeFiles: string[] = [];
(function walk(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "v1") walk(p); }
    else if (f === "route.ts") routeFiles.push(p);
  }
})("src/app/api/website");
check(`the builder's routes are all found (${routeFiles.length})`, routeFiles.length >= 8);
for (const f of routeFiles) {
  const src = code(f);
  const handlers = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g)].map((m) => m[1]);
  const ok = handlers.length > 0 && handlers.every((h) => {
    const body = between(src, `export async function ${h}(`, null).split(/\nexport async function /)[0];
    const guard = /const auth = await guardWebsite\("(view|create|edit|delete)"\);\s*if \(auth instanceof NextResponse\) return auth;/.exec(body);
    if (!guard) return false;
    /* A change is never allowed with view. */
    return h === "GET" ? true : guard[1] !== "view";
  });
  check(`${f.replace("src/app/api/website/", "")}: every handler opens with guardWebsite (changes need the action)`, ok);
}
const guard = code(GUARD);
check("guardWebsite: signed in, the Website module (view) or the action, and the host company",
  /await requireAuth\(\)/.test(guard) && /requireModuleAccess\(auth, "Website"\)/.test(guard) && /requireModuleAction\(auth, "Website", action\)/.test(guard) && /await requireHostTenant\(auth\)/.test(guard));
const pages = code(PAGES);
check("only the host company's accounts build its site", /const host = await websiteTenantId\(\);\s*if \(!host \|\| auth\.tenant_id !== host\) return \{/.test(pages));

/* ── 2. Publishing ── */
console.log("\n2. Who publishes, and what publishing does");
const canPub = between(pages, "export async function canPublish(", "interface PageRow");
check("never under view-as; super admins; else «Website Publish»",
  /if \(auth\.viewing_as\) return false;/.test(canPub) && /if \(auth\.is_super_admin\) return true;/.test(canPub) && /requireModuleAccess\(auth, WEBSITE_PUBLISH_MODULE\)\) === null/.test(canPub));
const pubRoute = code("src/app/api/website/pages/[slug]/publish/route.ts");
check("the publish route asks canPublish before anything", /if \(!\(await canPublish\(auth\)\)\) return builderJson\(/.test(pubRoute) && pubRoute.indexOf("canPublish(auth)") < pubRoute.indexOf("publishPage("));
const perm = code("src/lib/permission-modules.ts");
check("«Website Publish» is a capability of the Website app (grantable in Roles)", /export const WEBSITE_PUBLISH_MODULE = "Website Publish";/.test(perm) && /\{ name: WEBSITE_PUBLISH_MODULE, app: "Website" \}/.test(perm));
const publish = between(pages, "export async function publishPage(", "export interface PageVersion");
check("a page not ready is refused with its problems", /const problems = publishProblems\(doc\);\s*if \(problems\.length\) return \{/.test(publish));
check("the version row first (unique page+version), then the page — conditional on the old version",
  publish.indexOf('from("page_versions").insert(') > 0 && publish.indexOf('from("page_versions").insert(') < publish.indexOf('from("pages")') && /\.eq\("version", row\.version \?\? 0\)/.test(publish));
check("publishing tells the site to refresh the page", /revalidateWebsite\(\[`page:\$\{row\.slug\}`\]\)/.test(publish));

/* ── 3. Saving ── */
console.log("\n3. Saving the draft");
const save = between(pages, "export async function saveDraft(", "export async function publishPage(");
check("every save passes cleanPageDoc", /const draft = cleanPageDoc\(raw, mediaOrigin\(\)\);/.test(save));
check("a stale save is refused (409): conditional on the draftUpdatedAt the editor loaded",
  /q = expected \? q\.eq\("draft_updated_at", expected\) : q\.is\("draft_updated_at", null\);/.test(save) && /status: 409, code: "conflict"/.test(save));
check("publishing also passes cleanPageDoc", /const doc = cleanPageDoc\(row\.draft \?\? row\.published \?\? emptyDoc\(\), origin\);/.test(publish));

/* ── 4. The gate ── */
console.log("\n4. The page gate (lib/website/page-doc)");
const doc = code(DOC);
const href = between(doc, "export function cleanHref(", "function cleanButton(");
check("links: a site path (never //host), mailto, tel, or https only",
  /\^\\\/\(\?!\\\/\)/.test(href) && /\/\^mailto:/.test(href) && /\/\^tel:/.test(href) && /u\.protocol === "https:"/.test(href) && !/http:/.test(href.replace(/https:/g, "")));
check("photos: the Hub's own storage (website-media, media) only",
  /url\.startsWith\(`\$\{origin\}\/storage\/v1\/object\/public\/website-media\/`\) \|\| url\.startsWith\(`\$\{origin\}\/storage\/v1\/object\/public\/media\/`\)/.test(doc));
check("unknown section types are dropped", /if \(!\(SECTION_TYPES as readonly string\[\]\)\.includes\(type\)\) return null;/.test(doc));
check("nine section types, as picked", /SECTION_TYPES = \["hero", "text", "imageText", "features", "numbers", "products", "gallery", "faq", "cta"\] as const;/.test(doc));
check("control characters are stripped from every text", /\.replace\(\/\[\\u0000-\\u0008/.test(doc));
check("a missing word falls back to English", /\(t\?\.\[lang\] \|\| t\?\.en \|\| ""\)/.test(doc));
check("only English is required to publish", !/\.(ar|zh)\b/.test(between(doc, "export function publishProblems(", "export function missingIn(")));

/* ── 5. Photos ── */
console.log("\n5. Photos");
const upload = between(pages, "export async function uploadPhoto(", "export function previewLink(");
check("the type is read from the first bytes and must match what was sent", /const type = sniffPhoto\(bytes\);/.test(upload) && /declared\.split\(";"\)\[0\]\.trim\(\)\.toLowerCase\(\) !== type/.test(upload));
check("4 MB at most (under the platform's 4.5 MB request cap)", /if \(bytes\.length > MEDIA_BYTES_MAX\)/.test(upload) && /export const MEDIA_BYTES_MAX = 4 \* 1024 \* 1024;/.test(pages));
check("jpeg, png, webp, avif only — no SVG", /const PHOTO_TYPES: Record<string, string> = \{ "image\/jpeg": "jpg", "image\/png": "png", "image\/webp": "webp", "image\/avif": "avif" \};/.test(pages) && !/svg/i.test(upload));
const sql = readFileSync(MIGRATION, "utf8");
check("the bucket is public read, 8 MB, raster types only; page_versions under RLS",
  /'website-media',\s*'website-media',\s*true,\s*8388608,\s*ARRAY\['image\/jpeg', 'image\/png', 'image\/webp', 'image\/avif'\]/.test(sql) && /ALTER TABLE page_versions ENABLE ROW LEVEL SECURITY;/.test(sql) && !/CREATE POLICY/i.test(stripComments(sql, { lang: "sql" })));

/* ── 6. The bridge ── */
console.log("\n6. What the site receives");
const catalog = code(CATALOG);
const wp = between(catalog, "export async function websitePage(", "export interface WebsiteJob");
check("the published document, or the draft only when asked (draft=1)",
  /const source = opts\.draft \? \(p\.draft \?\? p\.published\) : \(summary\.version > 0 \? p\.published : null\);/.test(wp));
check("…always through cleanPageDoc", /if \(source\) return \{ page: summary, doc: cleanPageDoc\(source, origin\), sections: \[\] \};/.test(wp));
const bridgeRoute = code("src/app/api/website/v1/pages/[slug]/route.ts");
check("the draft flag is read only behind the bridge key", bridgeRoute.indexOf("requireWebsiteBridge(req)") > 0 && bridgeRoute.indexOf("requireWebsiteBridge(req)") < bridgeRoute.indexOf('get("draft") === "1"'));
const preview = between(pages, "export function previewLink(", null);
check("the preview link is signed with the bridge key and lasts 10 minutes",
  /createHmac\("sha256", key\)\.update\(`preview:\$\{slug\}:\$\{exp\}`\)/.test(preview) && /const exp = Math\.floor\(now \/ 1000\) \+ 600;/.test(preview));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
