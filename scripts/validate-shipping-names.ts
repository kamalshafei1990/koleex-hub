#!/usr/bin/env node
/* validate:shipping-names — a port's Arabic and Chinese name (26/09/2026;
 * plan published the same day, owner: "do the right way").
 *
 *   §1 the pure rules — a screen shows an APPROVED name in its language or
 *      the Latin one; a name is written in its own script, short and plain;
 *      a search matches «الاسكندريه» to «الإسكندرية».
 *   §2 a translated name is SHOWN, never RESOLVED — the owner's identifier
 *      rule (15/09/2026). port-resolver's resolvers never read one; only the
 *      picker's search does, and only approved names; a missing table or a
 *      failed read answers "no names", never an error.
 *   §3 the screens — the picker shows placeName(); what identifies a port
 *      (a rate search, a saved lane, the quote form's lane) is its LATIN
 *      name; saved lanes show their names by code; the picker's cache key
 *      carries the names' version.
 *   §4 the review — Shipping · edit for reading and deciding; the seed never
 *      overwrites a person's decision.
 *   §5 the migration — additive, RLS on with the service_role policy only,
 *      one place per row, the three statuses.
 *   §6 printing stays Latin — only Shipping's screens, its API and its
 *      scripts import the names.
 *
 * Source rules are checked in both directions, like validate:reports: the
 * real file passes, and a mutated copy that breaks the rule must fail.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments";
import {
  ARAB_STATES, NAME_GROUPS, checkPlaceName, isTranslatedTerm, placeName, placeSearchKey,
} from "../src/lib/shipping/place-names";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));
const eq = (got: unknown, want: unknown, m: string) => expect(JSON.stringify(got) === JSON.stringify(want), m, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (src: string) => stripComments(src);

/** One occurrence exactly, or the source unchanged (rule() then reports that
 *  the mutation did not apply). split/join, never .replace: `$&` is live. */
const once = (src: string, from: string, to: string) => {
  const parts = src.split(from);
  return parts.length === 2 ? parts.join(to) : src;
};

/** A rule must pass on the real file and fail on the mutation. */
function rule(name: string, file: string, check: (c: string) => string[], mutate: (src: string) => string) {
  const src = read(file);
  const real = check(code(src));
  expect(real.length === 0, `${name} (${file})`, real.join("; "));
  const mutated = mutate(src);
  if (mutated === src) { fail(`${name}: the mutation did not apply — update the guard`); return; }
  expect(check(code(mutated)).length > 0, `${name}: a copy that breaks it fails`);
}

/** The body of `function <name>(` / `async function <name>(` up to the next top-level function. */
function body(c: string, fn: string): string {
  const m = new RegExp(`\\n(?:export )?(?:async )?function ${fn}\\(`).exec(c);
  if (!m) return "";
  const next = c.slice(m.index + 1).search(/\n(?:export )?(?:async )?function |\nexport (?:const|interface|type) /);
  return next < 0 ? c.slice(m.index) : c.slice(m.index, m.index + 1 + next);
}

/* ── §1 the pure rules ─────────────────────────────────────────────────── */
console.log("\n§1 the pure rules");
eq(placeName("Alexandria", undefined, "ar"), "Alexandria", "no approved name → the Latin name");
eq(placeName("Alexandria", { ar: "الإسكندرية" }, "ar"), "الإسكندرية", "an approved Arabic name shows on an Arabic screen");
eq(placeName("Alexandria", { ar: "الإسكندرية" }, "en"), "Alexandria", "…and never on an English one");
eq(placeName("Qingdao", { ar: "تشينغداو" }, "zh"), "Qingdao", "a Chinese screen without a Chinese name shows Latin, not Arabic");
eq(placeName("Qingdao", { zh: "青岛" }, "zh"), "青岛", "an approved Chinese name shows on a Chinese screen");
eq(placeName("Qingdao", { zh: "" }, "zh"), "Qingdao", "an empty name is no name");
eq([checkPlaceName("ar", "Alexandria"), checkPlaceName("zh", "Qingdao")], [null, null], "a name not written in its own script is refused");
eq(checkPlaceName("ar", "  الإسكندرية   الجديدة "), "الإسكندرية الجديدة", "spaces are tidied");
eq(checkPlaceName("zh", "青岛"), "青岛", "a Chinese name is kept");
eq([checkPlaceName("ar", "<b>الإسكندرية</b>"), checkPlaceName("ar", "ا".repeat(121)), checkPlaceName("ar", 7)], [null, null, null], "markup, 121 characters and a non-string are refused");
eq(placeSearchKey("الإسكندرية"), placeSearchKey("الاسكندريه"), "«الاسكندريه» finds «الإسكندرية» (alef, ta marbuta)");
eq(placeSearchKey("مُحَمَّد"), "محمد", "tashkeel is ignored");
eq([placeSearchKey("ميناء ـــ زايد"), placeSearchKey("Jebel ALI")], ["ميناء زايد", "jebel ali"], "tatweel is dropped; Latin is lower-cased");
eq([isTranslatedTerm("Alex"), isTranslatedTerm("الإسكندرية"), isTranslatedTerm("青岛"), isTranslatedTerm("EGALY")], [false, true, true, false], "only an Arabic or Chinese search reads translated names");
expect(ARAB_STATES.length === 22 && ARAB_STATES.includes("EG") && NAME_GROUPS[0] === "koleex", "review starts with Koleex's ports; the Arab states are the 22 of the League, Egypt among them");

/* ── §2 shown, never resolved ─────────────────────────────────────────── */
console.log("\n§2 a translated name is shown, never resolved");
{
  const PR = "src/lib/server/shipping/port-resolver.ts";
  const RESOLVERS = ["resolvePort", "resolveAirport", "resolveEndpoint", "tradeCodeFor", "tradeCodeMap"];
  rule("the resolvers never read a translated name", PR,
    (c) => {
      const out: string[] = [];
      for (const fn of RESOLVERS) {
        const b = body(c, fn);
        if (!b) out.push(`${fn} not found`);
        else if (/approvedNamesFor|portIdsByApprovedName|shipping_place_names|placeSearchKey|\.names\b/.test(b)) out.push(`${fn} reads a translated name`);
      }
      return out;
    },
    (src) => once(src, "export async function resolvePort(input: string, countryCode?: string): Promise<PortResolution> {",
      "export async function resolvePort(input: string, countryCode?: string): Promise<PortResolution> {\n  void (await portIdsByApprovedName(input, 5));"));
  rule("only the picker's search reads names, and only for an Arabic or Chinese term", PR,
    (c) => {
      const b = body(c, "searchPorts");
      return b.includes("if (term && isTranslatedTerm(term)) {") && b.includes("await portIdsByApprovedName(term, limit)") && b.includes("await approvedNamesForPorts(ports.map((p) => p.id))")
        ? [] : ["the picker's search does not read approved names the way it should"];
    },
    (src) => once(src, "if (term && isTranslatedTerm(term)) {", "if (term) {"));

  const SN = "src/lib/server/shipping/place-names.ts";
  rule("the screens read APPROVED names only", SN,
    (c) => {
      const need = [body(c, "approvedNamesForPorts"), body(c, "portIdsByApprovedName")];
      return need.every((b) => b.includes('.eq("status", "approved")')) ? [] : ["a proposal nobody approved can reach a screen"];
    },
    (src) => once(src, '    .eq("status", "approved").not("port_id", "is", null)\n', '    .not("port_id", "is", null)\n'));
  rule("a missing table or a failed read answers \"no names\" — the picker never breaks", SN,
    (c) => {
      const out: string[] = [];
      if (!body(c, "approvedNamesForPorts").includes("if (error) return new Map();")) out.push("approvedNamesForPorts throws");
      if (!body(c, "approvedNamesForLocodes").includes("if (error || !data?.length) return {};")) out.push("approvedNamesForLocodes throws");
      if (!body(c, "placeNamesVersion").includes('if (error || !data?.length) return "0";')) out.push("placeNamesVersion throws");
      if (!body(c, "portIdsByApprovedName").includes("if (error) return [];")) out.push("portIdsByApprovedName throws");
      if (/\bthrow\b/.test(c)) out.push("something here throws");
      return out;
    },
    (src) => once(src, "    if (error) return new Map();", "    if (error) throw new Error(error.message);"));
}

/* ── §3 the screens ────────────────────────────────────────────────────── */
console.log("\n§3 the screens");
{
  const SA = "src/components/shipping/ShippingApp.tsx";
  rule("the picker shows the approved name, with the Latin name and the country in the screen's language under it", SA,
    (c) => (c.includes("const label = placeName(p.name, p.names, lang);") && c.includes("label !== p.name ? p.name : null,")
      && c.includes("countryDisplayName(p.countryCode, p.countryName ?? p.countryCode, lang),") ? [] : ["the picker shows the wrong name"]),
    (src) => once(src, "const label = placeName(p.name, p.names, lang);", "const label = p.name;"));
  rule("a port is identified by its code or its LATIN name — never by what the screen shows", SA,
    (c) => {
      const out: string[] = [];
      if (/\?\?\s*(origin|dest)\.label\b/.test(c)) out.push("a displayed label is used as a port's identity");
      if (!c.includes("origin: origin.code ?? latinOf(origin),") || !c.includes("destination: dest.code ?? latinOf(dest),")) out.push("the rate search or the quote lane does not use the Latin name");
      if (!c.includes("const latinOf = (o: PortOpt): string => o.value?.name || o.label;")) out.push("latinOf changed");
      return out;
    },
    (src) => once(src, "        origin: origin.code ?? latinOf(origin),\n        destination: dest.code ?? latinOf(dest),\n        destinationCountry: country?.value.code,\n        equipment: mode === \"ocean_fcl\" ? equipment : undefined,",
      "        origin: origin.code ?? origin.label,\n        destination: dest.code ?? latinOf(dest),\n        destinationCountry: country?.value.code,\n        equipment: mode === \"ocean_fcl\" ? equipment : undefined,"));
  rule("a saved lane stores the LATIN names", SA,
    (c) => {
      const calls = [...c.matchAll(/saveRoute\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);
      if (calls.length < 2) return ["saveRoute calls not found"];
      return calls.every((s) => s.includes("originLabel: latinOf(origin), destinationLabel: latinOf(dest),")) ? [] : ["a saved lane stores a translated name"];
    },
    (src) => once(src, "      originLabel: latinOf(origin), destinationLabel: latinOf(dest),\n    });", "      originLabel: origin.label, destinationLabel: dest.label,\n    });"));
  rule("a saved lane shows each end's approved name, looked up by code (sea lanes only)", SA,
    (c) => (c.includes('r.mode === "air" ? undefined : routes.names?.[end === "origin" ? r.origin_code : r.destination_code];')
      && c.includes("placeName(r.origin_label ?? r.origin_code, laneNames(routes, r, \"origin\"), lang)")
      && c.includes("restoredEndpoint(r.origin_code, r.origin_label, laneNames(routes, r, \"origin\"), lang)") ? [] : ["saved lanes show Latin names or read airports' codes as ports"]),
    (src) => once(src, 'r.mode === "air" ? undefined : routes.names?.[', "routes.names?.["));
  rule("the picker's cache key carries the names' version", SA,
    (c) => ((c.match(/searchPorts\(\{[^}]*nv: routes\.namesVersion \}\)/g) ?? []).length === 2 ? [] : ["an approved name can hide behind an hour-long cache"]),
    (src) => once(src, "searchPorts({ q: term, origin: true, limit: PICKER_ROWS, nv: routes.namesVersion })", "searchPorts({ q: term, origin: true, limit: PICKER_ROWS })"));
  rule("the lanes' names, their version and the review right ride the lanes call", "src/app/api/shipping/routes/route.ts",
    (c) => (c.includes('rows.filter((r) => r.mode !== "air")') && c.includes("approvedNamesForLocodes(seaCodes)")
      && c.includes('requireModuleAction(auth, MODULE, "edit")') && c.includes("canReviewNames: !reviewDeny") ? [] : ["the Shipping screen cannot show saved lanes' names or who may review"]),
    (src) => once(src, 'requireModuleAction(auth, MODULE, "edit")', 'requireModuleAction(auth, MODULE, "view")'));
}

/* ── §4 the review ─────────────────────────────────────────────────────── */
console.log("\n§4 the review");
{
  const API = "src/app/api/shipping/place-names/route.ts";
  rule("reading and deciding names are Shipping · edit", API,
    (c) => {
      const g = body(c, "GET"), p = body(c, "PATCH");
      return g.includes('requireModuleAction(auth, MODULE, "edit")') && p.includes('requireModuleAction(auth, MODULE, "edit")') ? [] : ["someone without Shipping edit can review names"];
    },
    (src) => once(src, 'const deny = await requireModuleAction(auth, MODULE, "edit");\n  if (deny) { _t.done({ status: 403 }); return deny; }\n\n  let body', 'const deny = await requireModuleAction(auth, MODULE, "view");\n  if (deny) { _t.done({ status: 403 }); return deny; }\n\n  let body'));
  rule("an approved name is checked, and a person's name is theirs", API,
    (c) => {
      const p = body(c, "PATCH");
      return p.includes("const name = checkPlaceName(lang, body.name);") && p.includes('source: kept ? "wikidata" : "manual"')
        && p.includes("reviewed_by: auth.account_id, reviewed_at: now") ? [] : ["an unchecked or unattributed name can be approved"];
    },
    (src) => once(src, "const name = checkPlaceName(lang, body.name);", "const name = typeof body.name === \"string\" ? body.name : null;"));
  rule("before the table exists the screen says so", API,
    (c) => (body(c, "GET").includes("return NextResponse.json({ ready: false }") ? [] : ["a missing table reads as an error"]),
    (src) => once(src, "return NextResponse.json({ ready: false }", "return NextResponse.json({ ready: true }"));

  const SEED = "scripts/shipping/seed-place-names.mts";
  rule("the seed never overwrites a person's decision", SEED,
    (c) => {
      const out: string[] = [];
      if (!c.includes('upsert(slice, { onConflict: "port_id,lang", ignoreDuplicates: true })')) out.push("new proposals can overwrite a row");
      if (!c.includes('.eq("port_id", r.port_id).eq("lang", r.lang).eq("status", "proposed").eq("source", "wikidata")')) out.push("a refresh can change a decided row");
      return out;
    },
    (src) => once(src, ', ignoreDuplicates: true })', " })"));
}

/* ── §5 the migration ──────────────────────────────────────────────────── */
console.log("\n§5 the migration");
{
  const MIG = "supabase/migrations/20260926_shipping_place_names.sql";
  const sql = (s: string) => stripComments(s, { lang: "sql" });
  const check = (c: string): string[] => {
    const out: string[] = [];
    if (!/create table if not exists public\.shipping_place_names/i.test(c)) out.push("the table");
    if (/\b(drop|truncate|delete\s+from)\b/i.test(c) || /\bupdate\s+[\w."]+\s+set\b/i.test(c) || /alter\s+table\b[^;]*\b(drop|alter\s+column|rename)\b/i.test(c)) out.push("not additive");
    if (!/alter table public\.shipping_place_names enable row level security/i.test(c)) out.push("RLS");
    if (!/create policy shipping_place_names_service_role_all on public\.shipping_place_names\s+for all to service_role/i.test(c) || /\bto\s+(anon|authenticated|public)\b/i.test(c)) out.push("service_role only");
    if (!/check \(status in \('proposed', 'approved', 'rejected'\)\)/.test(c)) out.push("statuses");
    if (!/check \(\(port_id is null\) <> \(airport_id is null\)\)/.test(c)) out.push("one place per row");
    if (!/unique index if not exists shipping_place_names_port_key\s+on public\.shipping_place_names \(port_id, lang\)/.test(c)) out.push("one name per port and language");
    return out;
  };
  const real = fs.readFileSync(path.join(ROOT, MIG), "utf8");
  eq(check(sql(real)), [], `additive, RLS on with the service_role policy only, one place per row, three statuses (${MIG})`);
  for (const [what, mutant] of [
    ["RLS commented out", real.split("alter table public.shipping_place_names enable row level security;").join("-- alter table public.shipping_place_names enable row level security;")],
    ["a policy for anon", real.split("for all to service_role using (true) with check (true);").join("for all to anon using (true) with check (true);")],
    ["a DROP slipped in", `${real}\ndrop index if exists public.shipping_ports_country_idx;\n`],
  ] as const) {
    expect(mutant !== real && check(sql(mutant)).length > 0, `the migration check catches: ${what}`);
  }
}

/* ── §6 printing stays Latin ───────────────────────────────────────────── */
console.log("\n§6 printing stays Latin");
{
  const ALLOWED = ["src/components/shipping/", "src/lib/server/shipping/", "src/app/api/shipping/", "src/lib/shipping/"];
  const importers = (files: string[], text: (f: string) => string) =>
    files.filter((f) => /@\/lib\/shipping\/place-names|lib\/shipping\/place-names/.test(text(f)) && !ALLOWED.some((a) => f.startsWith(a)));
  const walk = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(ts|tsx)$/.test(e.name) ? [`${dir}/${e.name}`] : []);
  const files = walk("src");
  const outside = importers(files, (f) => read(f));
  expect(outside.length === 0, `only Shipping's screens, API and libraries use translated names — ${files.length} files read`, outside.join(", "));
  const fake = new Map([["src/components/quotations/QuotationA4Preview.tsx", 'import { placeName } from "@/lib/shipping/place-names";']]);
  expect(importers([...fake.keys()], (f) => fake.get(f)!).length === 1, "a document or print that imported them would be caught");
}

console.log(failed ? `\n✗ validate:shipping-names — ${failed} failed\n` : "\n✓ validate:shipping-names — all rules hold\n");
process.exit(failed ? 1 : 0);
