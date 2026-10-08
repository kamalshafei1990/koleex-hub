/* ---------------------------------------------------------------------------
   Shipping — build the canonical port / airport reference dataset.

       npm run shipping:build-reference          (writes scripts/shipping/data/*)

   This is a BUILD step, not a runtime one. It downloads three public-domain
   sources, merges them, and writes the JSON that `seed-shipping-reference.mts`
   loads into Supabase. Re-run it when a source publishes a new release; the
   generated files are committed so seeding never depends on the network.

   ── The sources, and why these three ───────────────────────────────────────
   · UN/LOCODE 2025-1 (UNECE)      — the identity layer. Every location's
     official code, name, subdivision and FUNCTION digits. Digit 1 = seaport,
     digit 4 = airport; that is how a code is classified here rather than by
     guessing from its name.
   · NGA World Port Index (Pub 150) — the commercial layer. 3,807 real ports
     with coordinates, harbour size, harbour type and container facilities.
     "NO COPYRIGHT CLAIMED UNDER TITLE 17 U.S.C." — public domain.
   · OurAirports                    — the air layer. Released to the public
     domain; the only free IATA-coded airport list that is still maintained
     (OpenFlights has not moved since 2019 and is ODbL + a paid commercial
     licence, so it is deliberately NOT used).

   ── ⚠️ THE CODE THAT WILL MIS-ROUTE A SHIPMENT IF YOU "SIMPLIFY" THIS ──────
   UN/LOCODE assigns **CNSHA to Shanghai Hongqiao INTERNATIONAL AIRPORT** and
   **CNSGH to the Shanghai SEAPORT**. The freight trade does the opposite and
   books ocean cargo as CNSHA. Same trap on Ningbo: CNNGB is Ningbo Lishe
   airport, CNNBO is the port. Both spellings are real and both are in daily
   use, so this file stores the STANDARD code on the port and records the
   trade code as an alias of kind "trade_code". Never collapse the two, and
   never let a lookup guess between them — a wrong port is worse than no port.

   ── Matching discipline ────────────────────────────────────────────────────
   Koleex already ships three hand-curated port lists (src/lib/ports.ts and two
   inside QuotationA4Preview). Their wording is what the business prints on a
   packing list, so it wins for DISPLAY, and the merge attaches it to the
   official record. The automatic matcher is deliberately strict: exact,
   unambiguous, same-country only. Anything ambiguous resolves to NOTHING and
   lands in MANUAL_LOCODE below, where a human checked it against the register.
   A port with no confirmed code keeps `locode: null` — it is never invented.
   --------------------------------------------------------------------------- */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "data");
const CACHE = path.join(HERE, ".cache");
const REPO = path.resolve(HERE, "..", "..");

const SOURCES = {
  unlocode: {
    url: "https://opensource.unicc.org/un/unece/uncefact/vocab-locode/-/jobs/artifacts/2025-1/download?job=package-release",
    file: "unlocode.zip",
    note: "UN/LOCODE 2025-1, UNECE / UNICC open-source mirror",
  },
  wpi: {
    url: "https://msi.nga.mil/api/publications/download?type=view&key=16920959/SFH00000/UpdatedPub150.csv",
    file: "wpi.csv",
    note: "NGA World Port Index (Pub 150) — public domain",
  },
  airports: {
    url: "https://davidmegginson.github.io/ourairports-data/airports.csv",
    file: "airports.csv",
    note: "OurAirports — public domain",
  },
} as const;

/* ── manual overrides ────────────────────────────────────────────────────────
   Every line here was looked up in the UN/LOCODE register by hand; the comment
   is the register's own name for that code. Keyed by the exact display name
   the Koleex lists use. A name absent from this map and unmatched by the
   automatic pass keeps locode: null on purpose.                              */
const MANUAL_LOCODE: Record<string, { locode: string; iso2?: string; why: string }> = {
  "Hamad Port":            { locode: "QAHMD", why: "QAHMD 'BGN/PCGN1956 - HAMAD', seaport" },
  "Hamad Port (Doha)":     { locode: "QAHMD", why: "same port, the quotation list's spelling" },
  "Lagos — Apapa":         { locode: "NGLOS", why: "NGLOS 'Lagos'; quotation list spelling" },
  "Lagos — Tin Can":       { locode: "NGTIN", why: "NGTIN 'Tincan/Lagos'; quotation list spelling" },
  "Ningbo-Zhoushan":       { locode: "CNNBO", why: "CNNBO 'Ningbo' (CNNGB is Ningbo Lishe Apt)" },
  "Shenzhen":              { locode: "CNSNZ", why: "CNSNZ 'Shenzhen' (CNSZX is Shenzhen Baoan Apt)" },
  "Tianjin":               { locode: "CNTXG", why: "CNTXG 'Tianjin Xingang Pt', the container port" },
  "Fangchenggang":         { locode: "CNFAN", why: "CNFAN 'Fangcheng Pt'" },
  "Huanghua":              { locode: "CNHUH", why: "CNHUH 'Huanghua Pt'" },
  "Foshan":                { locode: "CNFRT", why: "CNFRT 'Foshan New Pt'" },
  "Hong Kong":             { locode: "HKHKG", iso2: "HK", why: "HKHKG 'Hong Kong'; listed under China in ports.ts, but HK is its own ISO country" },
  "Baku (Alat)":           { locode: "AZBAK", why: "AZBAK 'Baku'" },
  "Ain Sokhna":            { locode: "EGAIS", why: "EGAIS 'Ain Sukhna'" },
  "Marseille-Fos":         { locode: "FRMRS", why: "FRMRS 'Marseille'" },
  "Dunkirk":               { locode: "FRDKK", why: "FRDKK 'Dunkerque'" },
  Genoa:                   { locode: "ITGOA", why: "ITGOA 'Genova'" },
  Nagoya:                  { locode: "JPNGO", why: "JPNGO 'Nagoya, Aichi'" },
  Kuryk:                   { locode: "KZKUR", why: "KZKUR 'Kuryk' (register marks road only; Caspian ferry port)" },
  Misrata:                 { locode: "LYMRA", why: "LYMRA 'Misurata'" },
  "Lagos (Apapa)":         { locode: "NGLOS", why: "NGLOS 'Lagos'" },
  "Lagos (Tin Can)":       { locode: "NGTIN", why: "NGTIN 'Tincan/Lagos'" },
  "Manzanillo (PSA)":      { locode: "PAMIT", why: "PAMIT 'Manzanillo'" },
  "Szczecin-Swinoujscie":  { locode: "PLSZZ", why: "PLSZZ 'Szczecin'" },
  Odessa:                  { locode: "UAODS", why: "UAODS 'Odesa'" },
  "Khalifa Port":          { locode: "AEKHL", why: "AEKHL 'Mina Khalifa/Abu Dhabi'" },
  Fujairah:                { locode: "AEFJR", why: "AEFJR 'Al Fujayrah'" },
  "Coega (Ngqura)":        { locode: "ZAZBA", why: "ZAZBA 'Coega'" },
  Djibouti:                { locode: "DJJIB", iso2: "DJ", why: "DJJIB 'Djibouti'; ports.ts files it under Ethiopia" },
  "New York/New Jersey":   { locode: "USNYC", why: "USNYC 'New York'" },
  "New York / NJ":         { locode: "USNYC", why: "USNYC 'New York'" },
  "Port Said West":        { locode: "EGPSW", why: "EGPSW 'Port Said West'" },
  Beihai:                  { locode: "CNBIH", why: "CNBIH 'Beihai Pt'" },
  Taizhou:                 { locode: "CNTAZ", why: "CNTAZ 'Taizhou Pt', ZJ — the owner confirmed 26/09/2026 that Koleex's Taizhou is 台州, Zhejiang; CNTZO and CNTZU are Taizhou, JS (泰州)" },
};

/* Names the register genuinely cannot resolve. Listed so the next person does
   not re-run the same searches — and so a silent null is a decision, not a gap. */
const KNOWN_UNRESOLVED: Record<string, string> = {
  "Bandar Imam Khomeini": "IRBKK and IRBKM both plausible",
  Reykjanesbaer: "municipality, not a registered port location",
  Bosaso: "SOBSA is the airport; no seaport entry",
};

/* Trade codes that differ from the standard. ONLY codes with direct evidence
   of provider usage belong here — see the header. */
const TRADE_CODES: { locode: string; trade: string; why: string }[] = [
  { locode: "CNSGH", trade: "CNSHA", why: "ocean bookings and rate providers quote Shanghai as CNSHA; UN/LOCODE gives CNSHA to Shanghai Hongqiao Apt" },
  { locode: "CNNBO", trade: "CNNGB", why: "same convention on Ningbo; UN/LOCODE gives CNNGB to Ningbo Lishe Apt" },
];

/* ── plumbing ───────────────────────────────────────────────────────────── */

function csv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out;
}

const strip = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const normRaw = (s: string) => strip(s).replace(/[^a-z0-9]+/g, " ").trim();
const normLoose = (s: string) => strip(s)
  .replace(/\b(port|pt|puerto|porto|harbour|harbor|gang|terminal|city|de|del|la|el)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ").trim();

/** Every spelling one name can legitimately answer to. */
function nameForms(s: string): string[] {
  const out = new Set<string>();
  const add = (v: string) => { const a = normRaw(v); if (a) out.add(a); const b = normLoose(v); if (b) out.add(b); };
  add(s);
  add(String(s ?? "").replace(/\(.*?\)/g, " "));
  for (const m of String(s ?? "").matchAll(/\(([^)]+)\)/g)) add(m[1]);
  for (const part of String(s ?? "").split(/\s*[/;]\s*/)) if (part !== s) add(part);
  return [...out];
}

/** "3114N 12129E" → decimal degrees. */
function unlCoord(c: string): { lat: number; lng: number } | null {
  const m = /^(\d{2})(\d{2})([NS])\s+(\d{3})(\d{2})([EW])$/.exec((c || "").trim());
  if (!m) return null;
  return {
    lat: +(((+m[1] + +m[2] / 60) * (m[3] === "S" ? -1 : 1)).toFixed(4)),
    lng: +(((+m[4] + +m[5] / 60) * (m[6] === "W" ? -1 : 1)).toFixed(4)),
  };
}

async function download(key: keyof typeof SOURCES): Promise<string> {
  const src = SOURCES[key];
  const dest = path.join(CACHE, src.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`  cached  ${src.file}`);
    return dest;
  }
  fs.mkdirSync(CACHE, { recursive: true });
  console.log(`  fetch   ${src.file}  (${src.note})`);
  const res = await fetch(src.url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36" },
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`${src.file}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len && buf.length !== len) throw new Error(`${src.file}: truncated (${buf.length} of ${len} bytes)`);
  fs.writeFileSync(dest, buf);
  return dest;
}

/* ── types ──────────────────────────────────────────────────────────────── */

export interface PortRecord {
  locode: string | null;
  name: string;
  name_official: string | null;
  country_code: string;
  country_name: string;
  lat: number | null;
  lng: number | null;
  harbor_size: string | null;
  harbor_type: string | null;
  is_container: boolean | null;
  wpi_number: number | null;
  sea_region: string | null;
  subdivision: string | null;
  in_koleex_list: boolean;
  source: string;
}
export interface PortAlias { locode_key: string; alias: string; raw: string; kind: string }
export interface AirportRecord {
  iata: string; icao: string | null; locode: string | null; name: string;
  country_code: string; municipality: string | null;
  lat: number | null; lng: number | null; size: "large" | "medium";
}

/* ── build ──────────────────────────────────────────────────────────────── */

async function main() {
  console.log("Shipping reference dataset\n");

  const zipPath = await download("unlocode");
  const wpiPath = await download("wpi");
  const apPath = await download("airports");

  /* UN/LOCODE ships as a zip of CSVs; unzip once into the cache. */
  const unlDir = path.join(CACHE, "unlocode");
  if (!fs.existsSync(unlDir)) {
    const { execFileSync } = await import("node:child_process");
    execFileSync("unzip", ["-oq", zipPath, "-d", unlDir]);
  }

  type Unl = { cc: string; loc: string; code: string; name: string; ascii: string; subdiv: string; func: string; status: string; iata: string; coord: string };
  const unl: Unl[] = [];
  for (const part of ["1", "2", "3"]) {
    const raw = fs.readFileSync(path.join(unlDir, "release", "csv", `UNLOCODE CodeListPart${part}.csv`), "latin1");
    for (const r of csv(raw)) {
      if (r.length < 12 || !r[1] || !r[2] || r[2].length !== 3) continue;
      unl.push({ cc: r[1], loc: r[2], code: r[1] + r[2], name: r[3], ascii: r[4], subdiv: r[5], func: r[6] || "", status: r[7], iata: (r[9] || "").trim(), coord: r[10] || "" });
    }
  }
  const unlByCode = new Map(unl.map((x) => [x.code, x]));
  console.log(`\n  UN/LOCODE    ${unl.length.toLocaleString()} locations`);

  /* seaport-only pool, used when WPI has never heard of a Koleex port */
  const unlSeaByName = new Map<string, Map<string, Unl[]>>();
  for (const x of unl) {
    if (x.func[0] !== "1") continue;
    if (!unlSeaByName.has(x.cc)) unlSeaByName.set(x.cc, new Map());
    const m = unlSeaByName.get(x.cc)!;
    for (const n of new Set([normRaw(x.name), normRaw(x.ascii), normLoose(x.name)])) {
      if (!n) continue;
      if (!m.has(n)) m.set(n, []);
      m.get(n)!.push(x);
    }
  }

  /* country English name → ISO2 */
  const dn = new Intl.DisplayNames(["en"], { type: "region" });
  const nameToIso = new Map<string, string>();
  for (const cc of new Set(unl.map((x) => x.cc))) {
    let en: string | undefined;
    try { en = dn.of(cc); } catch { continue; }
    if (en && en !== cc) nameToIso.set(normRaw(en), cc);
  }
  for (const [k, v] of Object.entries(COUNTRY_ALIASES)) nameToIso.set(normRaw(k), v);
  const isoOf = (name: string) => nameToIso.get(normRaw(name)) ?? null;

  /* NGA World Port Index */
  const wpiRows = csv(fs.readFileSync(wpiPath, "utf8").replace(/^﻿/, ""));
  const wh = wpiRows[0];
  const ci = (n: string) => wh.indexOf(n);
  const C = {
    num: ci("World Port Index Number"), name: ci("Main Port Name"), alt: ci("Alternate Port Name"),
    loc: ci("UN/LOCODE"), country: ci("Country Code"), size: ci("Harbor Size"), type: ci("Harbor Type"),
    cont: ci("Facilities - Container"), lat: ci("Latitude"), lng: ci("Longitude"),
  };
  const ports = new Map<string, PortRecord>();
  const aliases: PortAlias[] = [];
  const keyOf = (p: PortRecord) => p.locode ?? `X:${p.country_code}:${normRaw(p.name)}`;
  const addAlias = (key: string, raw: string, kind: string) => {
    const forms = kind === "locode" || kind === "trade_code" ? [normRaw(raw)] : nameForms(raw);
    for (const alias of forms) if (alias) aliases.push({ locode_key: key, alias, raw, kind });
  };

  let wpiCount = 0;
  for (let i = 1; i < wpiRows.length; i++) {
    const r = wpiRows[i];
    if (!r || r.length < 10 || !r[C.name]) continue;
    const codeRaw = (r[C.loc] || "").replace(/\s+/g, "").toUpperCase();
    const code = /^[A-Z]{2}[A-Z0-9]{3}$/.test(codeRaw) ? codeRaw : null;
    const countryName = (r[C.country] || "").trim();
    const cc = code ? code.slice(0, 2) : isoOf(countryName);
    if (!cc) continue;
    const u = code ? unlByCode.get(code) : undefined;
    const p: PortRecord = {
      locode: code, name: (r[C.name] || "").trim(), name_official: u?.name ?? null,
      country_code: cc, country_name: countryName,
      lat: Number(r[C.lat]) || null, lng: Number(r[C.lng]) || null,
      harbor_size: (r[C.size] || "").trim() || null, harbor_type: (r[C.type] || "").trim() || null,
      is_container: r[C.cont] === "Yes" ? true : r[C.cont] === "No" ? false : null,
      wpi_number: Number(r[C.num]) || null, sea_region: null,
      subdivision: u?.subdiv || null, in_koleex_list: false,
      source: u ? "unlocode+wpi" : "wpi",
    };
    const k = keyOf(p);
    if (ports.has(k)) continue;
    ports.set(k, p);
    wpiCount++;
    if (code) addAlias(k, code, "locode");
    addAlias(k, p.name, "wpi_name");
    const alt = (r[C.alt] || "").trim();
    if (alt) addAlias(k, alt, "wpi_alt");
    if (u) { addAlias(k, u.name, "unlocode_name"); addAlias(k, u.ascii, "unlocode_name"); }
  }
  console.log(`  World Port Index  ${wpiCount.toLocaleString()} ports`);

  /* name index for the strict matcher */
  const byName = new Map<string, Map<string, Set<string>>>();
  for (const a of aliases) {
    const p = ports.get(a.locode_key);
    if (!p) continue;
    if (!byName.has(p.country_code)) byName.set(p.country_code, new Map());
    const m = byName.get(p.country_code)!;
    if (!m.has(a.alias)) m.set(a.alias, new Set());
    m.get(a.alias)!.add(a.locode_key);
  }
  /** Exact and unambiguous, same country only. Ambiguity resolves to null. */
  const match = (cc: string, name: string): string | null => {
    const m = byName.get(cc);
    if (!m) return null;
    for (const form of nameForms(name)) {
      const hit = m.get(form);
      if (hit && hit.size === 1) return [...hit][0];
    }
    return null;
  };

  /* Koleex's own three lists */
  const repo = await loadKoleexLists(REPO);
  const stats = { matched: 0, manual: 0, viaUnlocode: 0, created: 0 };

  function upsert(displayName: string, countryName: string, extra: Partial<PortRecord> = {}): string | null {
    const override = MANUAL_LOCODE[displayName];
    const cc = override?.iso2 ?? isoOf(countryName);
    if (!cc) { console.warn(`  ! no ISO code for country "${countryName}" — add it to COUNTRY_ALIASES`); return null; }

    if (override) {
      const u = unlByCode.get(override.locode);
      const co = u ? unlCoord(u.coord) : null;
      const existing = ports.get(override.locode);
      if (existing) {
        Object.assign(existing, { name: displayName, in_koleex_list: true }, pick(extra));
        addAlias(override.locode, displayName, "koleex_list");
        stats.manual++;
        return override.locode;
      }
      const p: PortRecord = {
        locode: override.locode, name: displayName, name_official: u?.name ?? null,
        country_code: cc, country_name: countryName,
        lat: extra.lat ?? co?.lat ?? null, lng: extra.lng ?? co?.lng ?? null,
        harbor_size: null, harbor_type: null, is_container: null, wpi_number: null,
        sea_region: extra.sea_region ?? null, subdivision: u?.subdiv || null,
        in_koleex_list: true, source: "unlocode+manual",
      };
      ports.set(override.locode, p);
      addAlias(override.locode, displayName, "koleex_list");
      addAlias(override.locode, override.locode, "locode");
      if (u) addAlias(override.locode, u.name, "unlocode_name");
      stats.manual++;
      return override.locode;
    }

    const hit = match(cc, displayName);
    if (hit) {
      const p = ports.get(hit)!;
      p.name = displayName;              // the business's own wording is what gets printed
      p.in_koleex_list = true;
      Object.assign(p, pick(extra));
      addAlias(hit, displayName, "koleex_list");
      stats.matched++;
      return hit;
    }

    const uHits = unlSeaByName.get(cc)?.get(normRaw(displayName)) ?? unlSeaByName.get(cc)?.get(normLoose(displayName));
    if (uHits?.length === 1) {
      const u = uHits[0];
      const co = unlCoord(u.coord);
      const existing = ports.get(u.code);
      if (existing) {
        Object.assign(existing, { name: displayName, in_koleex_list: true }, pick(extra));
        addAlias(u.code, displayName, "koleex_list");
      } else {
        ports.set(u.code, {
          locode: u.code, name: displayName, name_official: u.name,
          country_code: cc, country_name: countryName,
          lat: extra.lat ?? co?.lat ?? null, lng: extra.lng ?? co?.lng ?? null,
          harbor_size: null, harbor_type: null, is_container: null, wpi_number: null,
          sea_region: extra.sea_region ?? null, subdivision: u.subdiv || null,
          in_koleex_list: true, source: "unlocode",
        });
        addAlias(u.code, displayName, "koleex_list");
        addAlias(u.code, u.code, "locode");
        addAlias(u.code, u.name, "unlocode_name");
      }
      stats.viaUnlocode++;
      return u.code;
    }

    const p: PortRecord = {
      locode: null, name: displayName, name_official: null,
      country_code: cc, country_name: countryName,
      lat: extra.lat ?? null, lng: extra.lng ?? null,
      harbor_size: null, harbor_type: null, is_container: null, wpi_number: null,
      sea_region: extra.sea_region ?? null, subdivision: null,
      in_koleex_list: true, source: "koleex_list",
    };
    const k = keyOf(p);
    if (!ports.has(k)) { ports.set(k, p); stats.created++; }
    addAlias(k, displayName, "koleex_list");
    return k;
  }

  for (const n of repo.chinaPorts) upsert(n, "China");
  for (const [country, list] of Object.entries(repo.portsByCountry)) for (const n of list) upsert(n, country);
  for (const o of repo.cnLoading) {
    const g = repo.portGeo[o.value];
    const k = upsert(o.label, "China", g ? { lat: g.lat, lng: g.lng, sea_region: g.region } : {});
    if (k) addAlias(k, o.value, "koleex_list");   // the stored "Port, China" string
  }
  for (const [country, c] of Object.entries(repo.discharge)) {
    for (const o of c.ports) {
      const g = repo.portGeo[o.value];
      const k = upsert(o.label, country, g ? { lat: g.lat, lng: g.lng, sea_region: g.region } : {});
      if (k) addAlias(k, o.value, "koleex_list");   // the stored "Port, Country" string
    }
  }
  console.log(`  Koleex lists      ${stats.matched} matched · ${stats.manual} manual · ${stats.viaUnlocode} via register · ${stats.created} port-only`);

  for (const t of TRADE_CODES) {
    if (ports.has(t.locode)) addAlias(t.locode, t.trade, "trade_code");
    else console.warn(`  ! trade code ${t.trade}: base port ${t.locode} not in dataset`);
  }

  /* airports */
  const apRows = csv(fs.readFileSync(apPath, "utf8"));
  const ah = apRows[0];
  const A = Object.fromEntries(
    ["ident", "type", "name", "latitude_deg", "longitude_deg", "iso_country", "municipality", "iata_code"]
      .map((n) => [n, ah.indexOf(n)]),
  ) as Record<string, number>;
  const unlAptByIata = new Map<string, string>();
  for (const x of unl) if (x.func[3] === "4" && x.iata) unlAptByIata.set(x.iata.toUpperCase(), x.code);
  const airports: AirportRecord[] = [];
  for (let i = 1; i < apRows.length; i++) {
    const r = apRows[i];
    if (!r || r.length < 10) continue;
    const iata = (r[A.iata_code] || "").trim().toUpperCase();
    const type = r[A.type];
    if (!/^[A-Z]{3}$/.test(iata)) continue;
    if (type !== "large_airport" && type !== "medium_airport") continue;
    const cc = (r[A.iso_country] || "").trim();
    const direct = unlByCode.get(cc + iata);
    airports.push({
      iata, icao: (r[A.ident] || "").trim() || null,
      locode: unlAptByIata.get(iata) ?? (direct && direct.func[3] === "4" ? direct.code : null),
      name: r[A.name], country_code: cc,
      municipality: (r[A.municipality] || "").trim() || null,
      lat: Number(r[A.latitude_deg]) || null, lng: Number(r[A.longitude_deg]) || null,
      size: type === "large_airport" ? "large" : "medium",
    });
  }
  console.log(`  OurAirports       ${airports.length.toLocaleString()} IATA airports (large + medium)`);

  /* write */
  fs.mkdirSync(DATA, { recursive: true });
  const portList = [...ports.values()].sort((a, b) => (a.locode ?? a.name).localeCompare(b.locode ?? b.name));
  const uniq = new Map<string, PortAlias>();
  for (const a of aliases) uniq.set(`${a.locode_key}||${a.alias}||${a.kind}`, a);
  const aliasList = [...uniq.values()];

  write(path.join(DATA, "ports.json"), portList);
  write(path.join(DATA, "port-aliases.json"), aliasList);
  write(path.join(DATA, "airports.json"), airports);
  write(path.join(DATA, "meta.json"), {
    built_at: new Date().toISOString(),
    sources: Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, { url: v.url, note: v.note }])),
    counts: { ports: portList.length, aliases: aliasList.length, airports: airports.length },
    unresolved: KNOWN_UNRESOLVED,
  });

  const withCode = portList.filter((p) => p.locode).length;
  const koleex = portList.filter((p) => p.in_koleex_list).length;
  console.log(`\n  ports ${portList.length.toLocaleString()} (${withCode.toLocaleString()} with UN/LOCODE, ${koleex} in Koleex lists)`);
  console.log(`  aliases ${aliasList.length.toLocaleString()} · airports ${airports.length.toLocaleString()}`);
  const noCode = portList.filter((p) => p.in_koleex_list && !p.locode);
  if (noCode.length) {
    console.log(`\n  Koleex ports with no confirmed code (${noCode.length}) — shown by name only, never with a guessed code:`);
    for (const p of noCode) console.log(`    ${p.country_code}  ${p.name}${KNOWN_UNRESOLVED[p.name] ? `  — ${KNOWN_UNRESOLVED[p.name]}` : ""}`);
  }
  console.log(`\n  → ${path.relative(REPO, DATA)}`);
}

function pick(e: Partial<PortRecord>): Partial<PortRecord> {
  const out: Partial<PortRecord> = {};
  if (e.lat != null) out.lat = e.lat;
  if (e.lng != null) out.lng = e.lng;
  if (e.sea_region != null) out.sea_region = e.sea_region;
  return out;
}

function write(file: string, value: unknown) {
  fs.writeFileSync(file, JSON.stringify(value) + "\n");
}

/* Reads the three existing Koleex lists. ports.ts is a plain module; the two
   inside QuotationA4Preview are module-private consts in a 10k-line component,
   so they are parsed out of the source. READ ONLY — nothing here writes to
   either file, and neither is modified by this module. */
async function loadKoleexLists(repoRoot: string) {
  const portsMod = await import(path.join(repoRoot, "src", "lib", "ports.ts")) as {
    CHINA_PORTS: string[]; PORTS_BY_COUNTRY: Record<string, string[]>;
  };
  const src = fs.readFileSync(path.join(repoRoot, "src", "components", "quotations", "QuotationA4Preview.tsx"), "utf8");

  const literalAfter = (declRe: RegExp): string => {
    const m = src.match(declRe);
    if (!m) throw new Error(`QuotationA4Preview: ${declRe} not found — the port lists moved, update this parser`);
    const eq = src.indexOf("=", m.index! + m[0].length - 1);
    let i = eq + 1;
    while (/\s/.test(src[i])) i++;
    const open = src[i], close = open === "{" ? "}" : "]";
    let depth = 0, j = i, inStr: string | null = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (inStr) { if (c === "\\") j++; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (!depth) break; }
    }
    return src.slice(i, j + 1);
  };

  const portGeo: Record<string, { lat: number; lng: number; region: string }> = {};
  for (const m of literalAfter(/const PORT_GEO\s*:/).matchAll(
    /"([^"]+)"\s*:\s*\{\s*coord:\s*\{\s*lat:\s*(-?[\d.]+)\s*,\s*lng:\s*(-?[\d.]+)\s*\}\s*,\s*region:\s*"([^"]+)"/g)) {
    portGeo[m[1]] = { lat: +m[2], lng: +m[3], region: m[4] };
  }
  const optionRe = /\{\s*value:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"(?:\s*,\s*sublabel:\s*"([^"]*)")?\s*\}/g;
  const cnLoading = [...literalAfter(/const CN_LOADING_PORTS\s*:/).matchAll(optionRe)]
    .map((m) => ({ value: m[1], label: m[2] }));

  const dSrc = literalAfter(/const DISCHARGE_PORTS_BY_COUNTRY\s*:/);
  const discharge: Record<string, { iso2: string; ports: { value: string; label: string }[] }> = {};
  const cRe = /"([^"]+)"\s*:\s*\{\s*region:\s*"[^"]+"\s*,\s*iso2:\s*"([A-Z]{2})"\s*,\s*ports:\s*\[/g;
  let cm: RegExpExecArray | null;
  while ((cm = cRe.exec(dSrc))) {
    const start = dSrc.indexOf("[", cm.index + cm[0].length - 1);
    let depth = 0, j = start, inStr: string | null = null;
    for (; j < dSrc.length; j++) {
      const c = dSrc[j];
      if (inStr) { if (c === "\\") j++; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === "[") depth++; else if (c === "]") { depth--; if (!depth) break; }
    }
    discharge[cm[1]] = {
      iso2: cm[2],
      ports: [...dSrc.slice(start, j + 1).matchAll(optionRe)].map((m) => ({ value: m[1], label: m[2] })),
    };
  }

  if (!Object.keys(portGeo).length || !cnLoading.length || !Object.keys(discharge).length) {
    throw new Error("QuotationA4Preview: parsed zero rows from one of the port lists — the shapes changed");
  }
  return {
    chinaPorts: portsMod.CHINA_PORTS,
    portsByCountry: portsMod.PORTS_BY_COUNTRY,
    portGeo, cnLoading, discharge,
  };
}

/* Countries whose English name in the sources does not match Intl.DisplayNames. */
const COUNTRY_ALIASES: Record<string, string> = {
  uae: "AE", "united arab emirates": "AE", uk: "GB", "united kingdom": "GB",
  usa: "US", "united states": "US", "south korea": "KR", "korea south": "KR",
  "north korea": "KP", russia: "RU", vietnam: "VN", "viet nam": "VN",
  taiwan: "TW", syria: "SY", iran: "IR", tanzania: "TZ", venezuela: "VE",
  bolivia: "BO", moldova: "MD", "ivory coast": "CI", "cote d ivoire": "CI",
  "cape verde": "CV", "dr congo": "CD", congo: "CG", brunei: "BN",
  "congo republic": "CG", "republic of the congo": "CG",
  laos: "LA", macau: "MO", "hong kong": "HK", palestine: "PS",
  myanmar: "MM", burma: "MM", "czech republic": "CZ", slovakia: "SK",
  libya: "LY", "east timor": "TL", swaziland: "SZ", eswatini: "SZ",
  turkey: "TR", turkiye: "TR", "trinidad and tobago": "TT",
  "sao tome and principe": "ST", "st vincent and the grenadines": "VC",
  "st kitts and nevis": "KN", "st lucia": "LC", "antigua and barbuda": "AG",
  "bosnia and herzegovina": "BA", "burkina faso": "BF", "costa rica": "CR",
  "dominican republic": "DO", "el salvador": "SV", "equatorial guinea": "GQ",
  "guinea bissau": "GW", "papua new guinea": "PG", "saudi arabia": "SA",
  "sierra leone": "SL", "solomon islands": "SB", "south africa": "ZA",
  "sri lanka": "LK", "new zealand": "NZ", "new caledonia": "NC",
  "marshall islands": "MH", "faroe islands": "FO", "cayman islands": "KY",
  "virgin islands": "VI", "british virgin islands": "VG",
};

await main();
