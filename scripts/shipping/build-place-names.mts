/* ---------------------------------------------------------------------------
   Shipping — proposed Arabic and Chinese names for every coded port.

       npm run shipping:build-names

   Asks Wikidata once, by UN/LOCODE (property P1937 — written WITHOUT a
   space: "EGALY", "CNSGH"; a spaced query returns nothing and reads as
   "no coverage"), and writes scripts/shipping/data/place-names.json. The
   seed (seed-place-names.mts) reads that file and never the network, so a
   seed is reproducible and Wikidata going away cannot block one.

   These are PROPOSALS. A person approves each one in Shipping → Port names
   before any screen shows it: measured 26/09/2026, Wikidata spells Lobito
   «وبيتو», gives Mina Zayed the city's name «أبو ظبي», and suffixes Chinese
   cities with 市. What this script does fix mechanically:
     · Chinese: the simplified label first (zh-hans, then zh-cn, then zh),
       and a trailing 市 ("city") dropped — a port list is not a list of cities.
     · several items can carry one code (city, port, airport): a PORT item's
       label wins, then the lowest Q-number (the long-standing main item).
     · a label not written in its own script is dropped (checkPlaceName).
   --------------------------------------------------------------------------- */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkPlaceName } from "../../src/lib/shipping/place-names";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "data");
const CHUNK = 150;
const ENDPOINT = "https://query.wikidata.org/sparql";
/* Wikidata asks every client to identify itself. The Hub's address, and
   nothing personal. */
const UA = "KoleexHub-place-names/1.0 (+https://hub.koleexgroup.com)";

type Port = { locode: string | null };
type Hit = { qid: string; isPort: boolean; ar?: string; zh?: string };
type Named = { name: string; qid: string };
type Out = { locode: string; ar?: Named; zh?: Named };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const qnum = (qid: string) => Number(qid.replace(/^Q/, "")) || Number.MAX_SAFE_INTEGER;

async function ask(codes: string[]): Promise<Array<Record<string, { value: string }>>> {
  const values = codes.map((c) => `"${c}"`).join(" ");
  const query = `SELECT ?code ?item ?isPort ?ar ?zhHans ?zhCn ?zh WHERE {
    VALUES ?code { ${values} }
    ?item wdt:P1937 ?code .
    OPTIONAL { ?item rdfs:label ?ar FILTER(LANG(?ar) = "ar") }
    OPTIONAL { ?item rdfs:label ?zhHans FILTER(LANG(?zhHans) = "zh-hans") }
    OPTIONAL { ?item rdfs:label ?zhCn FILTER(LANG(?zhCn) = "zh-cn") }
    OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
    BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q44782 } AS ?isPort)
  }`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json", "User-Agent": UA },
      body: "query=" + encodeURIComponent(query),
    });
    if (res.ok) return ((await res.json()) as { results: { bindings: Array<Record<string, { value: string }>> } }).results.bindings;
    /* 429 / 5xx: the service asks for patience, not a retry storm. */
    await sleep(5000 * attempt);
  }
  throw new Error(`Wikidata did not answer for ${codes[0]}…${codes[codes.length - 1]}`);
}

/** The label a reviewer should see first, from the items that carry a code. */
function pick(hits: Hit[], lang: "ar" | "zh"): Named | undefined {
  const ranked = hits.filter((h) => h[lang])
    .sort((a, b) => Number(b.isPort) - Number(a.isPort) || qnum(a.qid) - qnum(b.qid));
  for (const h of ranked) {
    const name = checkPlaceName(lang, h[lang]);
    if (name) return { name, qid: h.qid };
  }
  return undefined;
}

async function main() {
  const ports = JSON.parse(fs.readFileSync(path.join(DATA, "ports.json"), "utf8")) as Port[];
  const codes = [...new Set(ports.map((p) => p.locode).filter((c): c is string => !!c))].sort();
  console.log(`Place names from Wikidata — ${codes.length} UN/LOCODEs, ${Math.ceil(codes.length / CHUNK)} queries`);

  const byCode = new Map<string, Hit[]>();
  for (let i = 0; i < codes.length; i += CHUNK) {
    const rows = await ask(codes.slice(i, i + CHUNK));
    for (const r of rows) {
      const code = r.code.value;
      const qid = r.item.value.replace(/^.*\//, "");
      const list = byCode.get(code) ?? [];
      let hit = list.find((h) => h.qid === qid);
      if (!hit) { hit = { qid, isPort: false }; list.push(hit); byCode.set(code, list); }
      if (r.isPort?.value === "true") hit.isPort = true;
      if (r.ar && !hit.ar) hit.ar = r.ar.value;
      const zh = r.zhHans?.value ?? r.zhCn?.value ?? r.zh?.value;
      if (zh && !hit.zh) hit.zh = zh.replace(/市$/, "");
    }
    process.stdout.write(`\r  ${Math.min(i + CHUNK, codes.length)}/${codes.length}`);
    await sleep(1500);
  }
  console.log();

  const names: Out[] = [];
  for (const code of codes) {
    const hits = byCode.get(code) ?? [];
    const ar = pick(hits, "ar");
    const zh = pick(hits, "zh");
    if (ar || zh) names.push({ locode: code, ...(ar ? { ar } : {}), ...(zh ? { zh } : {}) });
  }
  const counts = { codes: codes.length, onWikidata: byCode.size, ar: names.filter((n) => n.ar).length, zh: names.filter((n) => n.zh).length };
  fs.writeFileSync(path.join(DATA, "place-names.json"), JSON.stringify({
    built_at: new Date().toISOString(),
    source: "wikidata:P1937",
    counts,
    names,
  }, null, 1) + "\n");
  console.log(`  on Wikidata ${counts.onWikidata} · Arabic ${counts.ar} · Chinese ${counts.zh}`);
  console.log(`✓ wrote scripts/shipping/data/place-names.json`);
}

await main().catch((e) => { console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
