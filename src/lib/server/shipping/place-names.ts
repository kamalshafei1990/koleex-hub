import "server-only";

/* ---------------------------------------------------------------------------
   Approved port names, for the screens that SHOW a port (src/lib/shipping/
   place-names.ts says why they are never used to FIND one).

   The table ships in its own migration (20260926_shipping_place_names.sql),
   applied separately from this code. Until it exists — or if a read fails
   for any reason — every function here answers "no names": the screens stay
   in Latin and nothing breaks. A translated name is a nicety; the picker, the
   lane and the saved routes must never fail because of one.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { isPlaceNameLang, placeSearchKey, type PlaceNames } from "@/lib/shipping/place-names";

type NameRow = { port_id: string; lang: string; name: string };

/** Approved names of these ports, by port id. Empty on any failure. */
export async function approvedNamesForPorts(ids: string[]): Promise<Map<string, PlaceNames>> {
  const out = new Map<string, PlaceNames>();
  const unique = [...new Set(ids)].filter(Boolean);
  /* Chunked: a few hundred uuids in one .in() builds a request line the
     platform drops with a bare "fetch failed". */
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await supabaseServer.from("shipping_place_names")
      .select("port_id, lang, name")
      .in("port_id", unique.slice(i, i + 100))
      .eq("status", "approved");
    if (error) return new Map();
    for (const r of (data ?? []) as NameRow[]) {
      if (!isPlaceNameLang(r.lang)) continue;
      const names = out.get(r.port_id) ?? {};
      names[r.lang] = r.name;
      out.set(r.port_id, names);
    }
  }
  return out;
}

/** Approved names of system ports by UN/LOCODE — for rows that stored only a
 *  code and a Latin label (recent searches, favourite lanes). */
export async function approvedNamesForLocodes(codes: string[]): Promise<Record<string, PlaceNames>> {
  const unique = [...new Set(codes.map((c) => c.trim().toUpperCase()))].filter((c) => /^[A-Z]{2}[A-Z0-9]{3}$/.test(c));
  if (!unique.length) return {};
  const { data, error } = await supabaseServer.from("shipping_ports").select("id, locode")
    .is("tenant_id", null).in("locode", unique);
  if (error || !data?.length) return {};
  const codeById = new Map((data as Array<{ id: string; locode: string }>).map((r) => [r.id, r.locode]));
  const names = await approvedNamesForPorts([...codeById.keys()]);
  const out: Record<string, PlaceNames> = {};
  for (const [id, n] of names) out[codeById.get(id)!] = n;
  return out;
}

/** Changes whenever a name is approved, edited or taken back — the picker puts
 *  it in its reference URL, so an hour-long cache never shows a stale name. */
export async function placeNamesVersion(): Promise<string> {
  const { data, error } = await supabaseServer.from("shipping_place_names")
    .select("updated_at").order("updated_at", { ascending: false }).limit(1);
  if (error || !data?.length) return "0";
  return String(Date.parse((data[0] as { updated_at: string }).updated_at) || 0);
}

/** Ports whose APPROVED Arabic or Chinese name matches a typed term — for the
 *  picker's list only. The operator still chooses a row, with its code and
 *  country in view; a name is never turned into a port by itself. */
export async function portIdsByApprovedName(term: string, limit: number): Promise<string[]> {
  const key = placeSearchKey(term).replace(/[%_,()\\]/g, " ").trim();
  if (!key) return [];
  const { data, error } = await supabaseServer.from("shipping_place_names")
    .select("port_id")
    .eq("status", "approved").not("port_id", "is", null)
    .ilike("search_key", `%${key}%`)
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) return [];
  return [...new Set((data ?? []).map((r) => (r as { port_id: string }).port_id))];
}
