import "server-only";

/* ---------------------------------------------------------------------------
   Shipping — turn whatever a human or a provider says into one canonical port.

   Inputs this has to cope with, all of them real and all of them in the Hub
   today: "CNSGH", "CNSHA", "Shanghai", "Shanghai, China", "Ningbo-Zhoushan",
   "Al Iskandariyh (Alexandria)", "el dekheila".

   It resolves through shipping_port_aliases, which the reference build filled
   with every spelling from UN/LOCODE, the World Port Index and Koleex's own
   three lists. An unknown string resolves to NULL — never to the nearest
   guess. Fuzzy matching belongs in a search box, not in the thing that decides
   which port a price belongs to.

   ⚠️ AMBIGUITY IS AN ANSWER. "Alexandria" is a real port in Egypt and a real
   port in the United States. resolvePort() returns `ambiguous` with the
   candidates so the caller can ask, rather than silently picking one.

   ── ⚠️ FIVE DIFFERENT THINGS THAT ALL LOOK LIKE "A PORT CODE" ─────────────
   They are never interchangeable and this module never treats them as though
   they were:

     1. UN/LOCODE      the canonical identifier of a SEAPORT here (CNSGH)
     2. IATA           the canonical identifier of an AIRPORT here (PVG)
     3. provider code  what one provider's API wants. Resolved INSIDE that
                       provider's adapter, never globally — see
                       providers/trade-codes.ts
     4. trade alias    what the freight trade says out of habit (CNSHA for the
                       Shanghai seaport, which the register assigns to Hongqiao
                       AIRPORT). An alias row, never a replacement.
     5. display name   translated, for humans, never an identifier

   Measured on this data set, all three hazards are real, not theoretical:
     · 787 UN/LOCODEs appear in BOTH the port and the airport table. USDET is
       the Detroit seaport AND Coleman A. Young airport. A code alone does not
       say which table it came from, so every code travels with its SYSTEM.
     · A three-letter IATA code prefixed with its country is often a real and
       DIFFERENT seaport: CN + ZJG is Zhangjiagang, a port, not an airport.
     · 24 port NAMES are spelled exactly like some other port's UN/LOCODE.
       "Gaeta" is an Italian port and GAETA is the code of Etame Terminal in
       Gabon; "Camas" is a US port and CAMAS is Masson in Canada. The first
       version of resolvePort() took any five-character input as a code and
       answered "Gaeta" with an oil terminal in Gabon — silently, with a 200.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

/** Which coding system a code belongs to. Never inferred from its shape. */
export type CodeSystem = "unlocode" | "iata";

export interface CanonicalPort {
  id: string;
  /** UN/LOCODE, and ONLY ever a UN/LOCODE. Null when the register has none. */
  locode: string | null;
  /** IATA, and ONLY ever IATA. Set on airports, null on seaports. */
  iata: string | null;
  /** Which of the two above is this endpoint's canonical identifier. */
  codeSystem: CodeSystem;
  name: string;
  nameOfficial: string | null;
  countryCode: string;
  countryName: string | null;
  lat: number | null;
  lng: number | null;
  seaRegion: string | null;
  harborSize: string | null;
  isContainer: boolean | null;
  inKoleexList: boolean;
}

export type PortResolution =
  | { status: "ok"; port: CanonicalPort; matchedOn: string }
  | { status: "ambiguous"; candidates: CanonicalPort[] }
  | { status: "unknown" };

const PORT_COLS =
  "id, locode, name, name_official, country_code, country_name, lat, lng, sea_region, harbor_size, is_container, in_koleex_list";

/** Must match normRaw() in scripts/shipping/build-reference-dataset.mts. */
export function normaliseAlias(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

type Row = {
  id: string; locode: string | null; name: string; name_official: string | null;
  country_code: string; country_name: string | null; lat: number | null; lng: number | null;
  sea_region: string | null; harbor_size: string | null; is_container: boolean | null;
  in_koleex_list: boolean;
};

const toPort = (r: Row): CanonicalPort => ({
  id: r.id, locode: r.locode, iata: null, codeSystem: "unlocode",
  name: r.name, nameOfficial: r.name_official,
  countryCode: r.country_code, countryName: r.country_name,
  lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng),
  seaRegion: r.sea_region, harborSize: r.harbor_size, isContainer: r.is_container,
  inKoleexList: r.in_koleex_list,
});

/**
 * @param countryCode narrows an ambiguous name. Pass it whenever the caller
 *        knows the country — it is what turns "Alexandria" into one answer.
 */
export async function resolvePort(input: string, countryCode?: string): Promise<PortResolution> {
  const raw = (input ?? "").trim();
  if (!raw) return { status: "unknown" };

  const alias = normaliseAlias(raw);
  if (!alias) return { status: "unknown" };

  /* ⚠️ BOTH LOOKUPS RUN, AND A DISAGREEMENT IS AMBIGUITY — NOT A WINNER.
     The first version short-circuited: five characters meant "this is a code",
     so it answered before ever consulting the name index. That is how "Gaeta",
     an Italian port, returned Etame Terminal in Gabon, whose UN/LOCODE happens
     to be GAETA. Twenty-four names in this data set collide that way.

     So the code index and the name index are consulted together and their
     answers are merged. One answer is an answer; two are a question for the
     operator. */
  const [exact, byName] = await Promise.all([
    /^[A-Z]{2}[A-Z0-9]{3}$/i.test(raw)
      ? supabaseServer.from("shipping_ports").select(PORT_COLS)
          .eq("locode", raw.toUpperCase()).is("tenant_id", null).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseServer.from("shipping_port_aliases")
      .select(`kind, shipping_ports!inner(${PORT_COLS})`)
      .eq("alias", alias).limit(50),
  ]);

  const byId = new Map<string, { port: CanonicalPort; kind: string }>();
  const consider = (p: CanonicalPort, kind: string) => {
    if (countryCode && p.countryCode !== countryCode.toUpperCase()) return;
    const prev = byId.get(p.id);
    /* Keep the strongest reason we matched, for the "why" tooltip. */
    if (!prev || rank(kind) > rank(prev.kind)) byId.set(p.id, { port: p, kind });
  };

  if (exact.data) consider(toPort(exact.data as Row), "locode");
  for (const row of ((byName.data ?? []) as unknown as { kind: string; shipping_ports: Row }[])) {
    consider(toPort(row.shipping_ports), row.kind);
  }

  const hits = [...byId.values()];
  if (!hits.length) return { status: "unknown" };
  if (hits.length === 1) return { status: "ok", port: hits[0].port, matchedOn: hits[0].kind };

  /* More than one port answers. A Koleex lane is a safe tie-break for two
     ports that share a NAME — "Alexandria" in Egypt versus Virginia. It is NOT
     safe when the disagreement is between coding systems: if one candidate
     matched as a code and another as a name, they are different KINDS of
     answer and picking either would be the Gaeta bug with extra steps. */
  const kinds = new Set(hits.map((h) => h.kind));
  const codeVsName = kinds.has("locode") && hits.some((h) => h.kind !== "locode");
  if (!codeVsName) {
    const ours = hits.filter((h) => h.port.inKoleexList);
    if (ours.length === 1) return { status: "ok", port: ours[0].port, matchedOn: `${ours[0].kind}+koleex` };
  }

  return { status: "ambiguous", candidates: hits.map((h) => h.port) };
}

/**
 * The canonical identifier of an endpoint, WITH the system it belongs to.
 *
 * Everything downstream — the cache key, the stored rate row, the provider
 * request — goes through this, so a bare code string never travels on its own.
 */
export function endpointCode(port: CanonicalPort): { code: string; system: CodeSystem } | null {
  if (port.codeSystem === "iata") return port.iata ? { code: port.iata, system: "iata" } : null;
  return port.locode ? { code: port.locode, system: "unlocode" } : null;
}

const KIND_RANK: Record<string, number> = {
  locode: 5, trade_code: 4, koleex_list: 3, unlocode_name: 2, wpi_name: 1, wpi_alt: 0,
};
const rank = (k: string) => KIND_RANK[k] ?? 0;

/**
 * The code to SEND a provider for this port.
 *
 * Providers book ocean cargo on the trade spelling (CNSHA), not the register's
 * (CNSGH). Passing the standard code to a provider that expects the trade one
 * returns "no route" at best. See the header of the reference builder.
 */
export async function tradeCodeFor(locode: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("shipping_ports")
    .select("id, shipping_port_aliases!inner(raw, kind)")
    .eq("locode", locode.toUpperCase())
    .eq("shipping_port_aliases.kind", "trade_code")
    .limit(1).maybeSingle();
  const alias = (data as { shipping_port_aliases?: { raw: string }[] } | null)?.shipping_port_aliases?.[0];
  return alias?.raw?.toUpperCase() ?? null;
}

/** Bulk version, so one search does not run N queries. */
export async function tradeCodeMap(locodes: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = [...new Set(locodes.filter(Boolean).map((c) => c.toUpperCase()))];
  if (!wanted.length) return out;
  const { data } = await supabaseServer
    .from("shipping_port_aliases")
    .select("raw, shipping_ports!inner(locode)")
    .eq("kind", "trade_code");
  for (const row of (data ?? []) as unknown as { raw: string; shipping_ports: { locode: string | null } }[]) {
    const code = row.shipping_ports?.locode?.toUpperCase();
    if (code && wanted.includes(code)) out.set(code, row.raw.toUpperCase());
  }
  return out;
}

export interface PortSearchHit extends CanonicalPort { matchedOn?: string }

/**
 * Type-ahead over the 3,806 ports. Server-side on purpose — the whole table
 * must never reach the browser.
 *
 * Ordering is commercial, not alphabetical: ports Koleex already ships
 * through first, then big container ports, then everything else.
 */
export async function searchPorts(opts: {
  term?: string;
  countryCode?: string;
  limit?: number;
  /** Restrict to China, for the origin picker. */
  originOnly?: boolean;
}): Promise<PortSearchHit[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const term = (opts.term ?? "").trim();

  let q = supabaseServer.from("shipping_ports").select(PORT_COLS)
    .is("tenant_id", null).eq("is_active", true);
  if (opts.originOnly) q = q.eq("country_code", "CN");
  else if (opts.countryCode) q = q.eq("country_code", opts.countryCode.toUpperCase());

  if (term) {
    const esc = term.replace(/[%,()]/g, " ").trim();
    if (esc) q = q.or(`name.ilike.%${esc}%,locode.ilike.${esc}%,name_official.ilike.%${esc}%`);
  }

  const { data, error } = await q
    .order("in_koleex_list", { ascending: false })
    .order("harbor_size", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .limit(limit);
  if (error) return [];
  return ((data ?? []) as Row[]).map(toPort);
}

/* ── airports ──────────────────────────────────────────────────────────────
   Air lanes are identified by IATA, and IATA codes live in a different table.
   The rates route used to resolve BOTH ends through shipping_ports, so every
   air search failed with "we don't recognise PVG as a port" — true, and
   useless. resolveEndpoint() is the one entry point both modes use. */

/** An airport, shaped like a port so the engine and the UI need only one type. */
export async function resolveAirport(input: string, countryCode?: string): Promise<PortResolution> {
  const raw = (input ?? "").trim();
  if (!raw) return { status: "unknown" };

  const cols = "id, iata, locode, name, country_code, municipality, lat, lng";
  type ARow = {
    id: string; iata: string; locode: string | null; name: string; country_code: string;
    municipality: string | null; lat: number | null; lng: number | null;
  };
  const asAirport = (r: ARow): CanonicalPort => ({
    id: r.id,
    /* ⚠️ THE IATA CODE DOES NOT GO IN `locode`. An earlier version put it
       there so air and sea could share one field — which meant a stored
       "HAM" could be read as a UN/LOCODE and a stored "USDET" could be read
       as either the Detroit seaport or the Detroit airport (both exist, and
       787 codes are in both tables). The system travels with the code now.

       The airport's OWN UN/LOCODE is kept beside it, because it is a real
       fact about this airport — it is simply not the identifier a freight
       provider quotes on. Two identifiers, neither pretending to be the
       other. */
    locode: r.locode,
    iata: r.iata,
    codeSystem: "iata",
    name: r.name,
    nameOfficial: null,
    countryCode: r.country_code,
    countryName: r.municipality,
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    seaRegion: null, harborSize: null, isContainer: null, inKoleexList: false,
  });

  if (/^[A-Za-z]{3}$/.test(raw)) {
    const { data } = await supabaseServer.from("shipping_airports").select(cols)
      .eq("iata", raw.toUpperCase()).is("tenant_id", null).maybeSingle();
    if (data) return { status: "ok", port: asAirport(data as ARow), matchedOn: "iata" };
  }

  let q = supabaseServer.from("shipping_airports").select(cols)
    .is("tenant_id", null).eq("is_active", true);
  if (countryCode) q = q.eq("country_code", countryCode.toUpperCase());
  const esc = raw.replace(/[%,()]/g, " ").trim();
  if (!esc) return { status: "unknown" };
  const { data, error } = await q.or(`name.ilike.%${esc}%,municipality.ilike.%${esc}%`).limit(10);
  if (error || !data?.length) return { status: "unknown" };
  const hits = (data as ARow[]).map(asAirport);
  if (hits.length === 1) return { status: "ok", port: hits[0], matchedOn: "name" };
  const exact = hits.filter((h) => h.name.toLowerCase() === raw.toLowerCase());
  if (exact.length === 1) return { status: "ok", port: exact[0], matchedOn: "name" };
  return { status: "ambiguous", candidates: hits };
}

/** Resolves whichever kind of endpoint the mode is about. */
export function resolveEndpoint(
  input: string,
  mode: "ocean_fcl" | "ocean_lcl" | "air",
  countryCode?: string,
): Promise<PortResolution> {
  return mode === "air" ? resolveAirport(input, countryCode) : resolvePort(input, countryCode);
}

/* The country list never changes between deploys, so it is built once per
   process and held for an hour. Without this every picker open re-read 3,806
   rows to produce ~180. */
let countryCache: { at: number; rows: { code: string; name: string | null; ports: number }[] } | null = null;
const COUNTRY_TTL_MS = 60 * 60_000;

/**
 * Countries that actually have a port, for the destination step.
 *
 * ⚠️ PAGINATED, and that is not optional. PostgREST caps a response at 1,000
 * rows regardless of `.limit()`, so the first version of this read 1,000 of
 * 3,806 ports and reported 49 countries instead of 180 — silently, with a 200.
 */
export async function portCountries(): Promise<{ code: string; name: string | null; ports: number }[]> {
  if (countryCache && Date.now() - countryCache.at < COUNTRY_TTL_MS) return countryCache.rows;

  const agg = new Map<string, { code: string; name: string | null; ports: number }>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseServer
      .from("shipping_ports").select("country_code, country_name")
      .is("tenant_id", null).eq("is_active", true)
      .order("country_code", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return countryCache?.rows ?? [];
    const rows = (data ?? []) as { country_code: string; country_name: string | null }[];
    for (const r of rows) {
      const cur = agg.get(r.country_code);
      if (cur) { cur.ports++; if (!cur.name && r.country_name) cur.name = r.country_name; }
      else agg.set(r.country_code, { code: r.country_code, name: r.country_name, ports: 1 });
    }
    if (rows.length < PAGE) break;
  }
  const rows = [...agg.values()].sort((a, b) => a.code.localeCompare(b.code));
  countryCache = { at: Date.now(), rows };
  return rows;
}
