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
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export interface CanonicalPort {
  id: string;
  locode: string | null;
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
  id: r.id, locode: r.locode, name: r.name, nameOfficial: r.name_official,
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

  /* A well-formed code is looked up directly first: it is the unambiguous
     path, and it keeps CNSGH from going through the alias table at all. */
  if (/^[A-Z]{2}[A-Z0-9]{3}$/i.test(raw)) {
    const { data } = await supabaseServer
      .from("shipping_ports").select(PORT_COLS)
      .eq("locode", raw.toUpperCase()).is("tenant_id", null).maybeSingle();
    if (data) return { status: "ok", port: toPort(data as Row), matchedOn: "locode" };
  }

  const alias = normaliseAlias(raw);
  if (!alias) return { status: "unknown" };

  const { data, error } = await supabaseServer
    .from("shipping_port_aliases")
    .select(`kind, shipping_ports!inner(${PORT_COLS})`)
    .eq("alias", alias)
    .limit(50);
  if (error || !data?.length) return { status: "unknown" };

  const byId = new Map<string, { port: CanonicalPort; kind: string }>();
  for (const row of data as unknown as { kind: string; shipping_ports: Row }[]) {
    const p = toPort(row.shipping_ports);
    if (countryCode && p.countryCode !== countryCode.toUpperCase()) continue;
    const prev = byId.get(p.id);
    /* Keep the strongest reason we matched, for the "why" tooltip. */
    if (!prev || rank(row.kind) > rank(prev.kind)) byId.set(p.id, { port: p, kind: row.kind });
  }

  const hits = [...byId.values()];
  if (!hits.length) return { status: "unknown" };
  if (hits.length === 1) return { status: "ok", port: hits[0].port, matchedOn: hits[0].kind };

  /* More than one port answers to this name. If exactly one of them is a port
     Koleex already ships through, that is a safe tie-break — it is the one the
     operator meant. Otherwise ask. */
  const ours = hits.filter((h) => h.port.inKoleexList);
  if (ours.length === 1) return { status: "ok", port: ours[0].port, matchedOn: `${ours[0].kind}+koleex` };

  return { status: "ambiguous", candidates: hits.map((h) => h.port) };
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
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
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

/** Countries that actually have a port in the table, for the destination step. */
export async function portCountries(): Promise<{ code: string; name: string | null; ports: number }[]> {
  const { data, error } = await supabaseServer
    .from("shipping_ports").select("country_code, country_name")
    .is("tenant_id", null).eq("is_active", true).limit(20000);
  if (error) return [];
  const agg = new Map<string, { code: string; name: string | null; ports: number }>();
  for (const r of (data ?? []) as { country_code: string; country_name: string | null }[]) {
    const cur = agg.get(r.country_code);
    if (cur) { cur.ports++; if (!cur.name && r.country_name) cur.name = r.country_name; }
    else agg.set(r.country_code, { code: r.country_code, name: r.country_name, ports: 1 });
  }
  return [...agg.values()].sort((a, b) => a.code.localeCompare(b.code));
}
