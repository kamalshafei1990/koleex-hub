import "server-only";

/* ---------------------------------------------------------------------------
   /api/shipping/place-names — Shipping → Port names, where a person approves
   the Arabic and Chinese name of each port before any screen shows it.

   GET    the ports of a group (Koleex list, China, Egypt, Arab states, all)
          with each language's proposal or decision, a page at a time.
   PATCH  { portId, lang, action: "approve" | "reject" | "reopen", name? }.

   Both are Shipping · edit. Names are global reference data (like the ports
   themselves), so there is no tenant filter — only who may change them.

   The table ships in 20260926_shipping_place_names.sql, applied apart from
   this code; until then GET answers { ready: false } and the screen says so.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { stageTimer } from "@/lib/server/perf";
import {
  ARAB_STATES, checkPlaceName, isNameGroup, isPlaceNameLang, placeSearchKey,
  type NameGroup, type PlaceNameLang, type PlaceNameStatus,
} from "@/lib/shipping/place-names";

const MODULE = "Shipping";
const PAGE = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PortRow = {
  id: string; locode: string | null; name: string; name_official: string | null;
  country_code: string; country_name: string | null; in_koleex_list: boolean;
};
type NameRow = {
  port_id: string; lang: string; name: string; status: PlaceNameStatus;
  source: "wikidata" | "manual"; source_ref: string | null; reviewed_at: string | null;
};
type NameEntry = { name: string; status: PlaceNameStatus; source: "wikidata" | "manual"; sourceRef: string | null };

const decided = (e: NameEntry | null) => !!e && e.status !== "proposed";
const entryOf = (r: NameRow): NameEntry => ({ name: r.name, status: r.status, source: r.source, sourceRef: r.source_ref });

/** Every system port of a group, read in pages (the United States alone has 662). */
async function portsOf(group: NameGroup, q: string): Promise<PortRow[] | null> {
  const out: PortRow[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabaseServer.from("shipping_ports")
      .select("id, locode, name, name_official, country_code, country_name, in_koleex_list")
      .is("tenant_id", null).eq("is_active", true);
    if (group === "koleex") query = query.eq("in_koleex_list", true);
    else if (group === "cn") query = query.eq("country_code", "CN");
    else if (group === "eg") query = query.eq("country_code", "EG");
    else if (group === "arab") query = query.in("country_code", [...ARAB_STATES]);
    const esc = q.replace(/[%,()]/g, " ").trim();
    if (esc) query = query.or(`name.ilike.%${esc}%,locode.ilike.${esc}%,name_official.ilike.%${esc}%`);
    const { data, error } = await query.order("id").range(from, from + 999);
    if (error) return null;
    out.push(...((data ?? []) as PortRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** The whole names table — a few thousand short rows, read in pages. Null
 *  when it does not exist yet. */
async function allNames(): Promise<Map<string, Partial<Record<PlaceNameLang, NameEntry>>> | null> {
  const out = new Map<string, Partial<Record<PlaceNameLang, NameEntry>>>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseServer.from("shipping_place_names")
      .select("port_id, lang, name, status, source, source_ref, reviewed_at")
      .not("port_id", "is", null).order("id").range(from, from + 999);
    if (error) return null;
    for (const r of (data ?? []) as NameRow[]) {
      if (!isPlaceNameLang(r.lang)) continue;
      const cur = out.get(r.port_id) ?? {};
      cur[r.lang] = entryOf(r);
      out.set(r.port_id, cur);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function GET(req: Request) {
  const _t = stageTimer("shipping.place-names");
  const auth = await requireAuth();
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }
  const deny = await requireModuleAction(auth, MODULE, "edit");
  if (deny) { _t.done({ status: 403 }); return deny; }
  _t.mark("auth");

  const url = new URL(req.url);
  const group: NameGroup = isNameGroup(url.searchParams.get("group")) ? (url.searchParams.get("group") as NameGroup) : "koleex";
  const status = url.searchParams.get("status") === "done" ? "done" : url.searchParams.get("status") === "all" ? "all" : "todo";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const page = Math.max(0, Math.min(500, Number(url.searchParams.get("page")) || 0));

  const [ports, names, groupPorts] = await Promise.all([portsOf(group, q), allNames(), q ? portsOf(group, "") : null]);
  _t.mark("db");
  if (!names) {
    const { header } = _t.done({ status: 200, ready: 0 });
    return NextResponse.json({ ready: false }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": header } });
  }
  if (!ports) { _t.done({ status: 500 }); return NextResponse.json({ error: "Could not load the ports." }, { status: 500 }); }

  const rowsAll = ports.map((p) => {
    const n = names.get(p.id) ?? {};
    return {
      id: p.id, locode: p.locode, name: p.name, nameOfficial: p.name_official,
      countryCode: p.country_code, countryName: p.country_name, inKoleexList: p.in_koleex_list,
      ar: n.ar ?? null, zh: n.zh ?? null,
    };
  });
  /* Koleex's own ports first, then by country and name — the order the owner
     picked for the review (Koleex list, China, Egypt, the Arab states). */
  rowsAll.sort((a, b) => Number(b.inKoleexList) - Number(a.inKoleexList)
    || a.countryCode.localeCompare(b.countryCode) || a.name.localeCompare(b.name));
  const done = (r: (typeof rowsAll)[number]) => decided(r.ar) && decided(r.zh);
  const filtered = status === "all" ? rowsAll : rowsAll.filter((r) => (status === "done" ? done(r) : !done(r)));

  /* The progress line counts the whole group, whatever the filter or search. */
  const scope = (groupPorts ?? ports).map((p) => names.get(p.id) ?? {});
  const counts = {
    ports: scope.length,
    arApproved: scope.filter((n) => n.ar?.status === "approved").length,
    zhApproved: scope.filter((n) => n.zh?.status === "approved").length,
    arDecided: scope.filter((n) => decided(n.ar ?? null)).length,
    zhDecided: scope.filter((n) => decided(n.zh ?? null)).length,
  };

  const { header } = _t.done({ status: 200, rows: filtered.length });
  return NextResponse.json({
    ready: true, group, status, page, pageSize: PAGE, total: filtered.length, counts,
    rows: filtered.slice(page * PAGE, page * PAGE + PAGE),
  }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": header } });
}

export async function PATCH(req: Request) {
  const _t = stageTimer("shipping.place-names.write");
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }
  const deny = await requireModuleAction(auth, MODULE, "edit");
  if (deny) { _t.done({ status: 403 }); return deny; }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { _t.done({ status: 400 }); return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const portId = typeof body.portId === "string" && UUID.test(body.portId) ? body.portId : null;
  const lang = isPlaceNameLang(body.lang) ? body.lang : null;
  const action = body.action === "approve" || body.action === "reject" || body.action === "reopen" ? body.action : null;
  if (!portId || !lang || !action) { _t.done({ status: 400 }); return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const { data: port } = await supabaseServer.from("shipping_ports").select("id")
    .eq("id", portId).is("tenant_id", null).maybeSingle();
  if (!port) { _t.done({ status: 404 }); return NextResponse.json({ error: "not_found" }, { status: 404 }); }

  const { data: had, error: readError } = await supabaseServer.from("shipping_place_names")
    .select("port_id, lang, name, status, source, source_ref, reviewed_at")
    .eq("port_id", portId).eq("lang", lang).maybeSingle();
  if (readError) { _t.done({ status: 503 }); return NextResponse.json({ error: "not_ready" }, { status: 503 }); }
  const existing = had as NameRow | null;
  const now = new Date().toISOString();

  let saved: NameRow | null = null;
  if (action === "approve") {
    const name = checkPlaceName(lang, body.name);
    if (!name) { _t.done({ status: 400 }); return NextResponse.json({ error: "invalid_name" }, { status: 400 }); }
    /* A proposal approved as it stands keeps its Wikidata provenance; a name
       the reviewer typed or corrected is theirs. */
    const kept = existing?.source === "wikidata" && existing.name === name;
    const { data, error } = await supabaseServer.from("shipping_place_names").upsert({
      port_id: portId, lang, name, search_key: placeSearchKey(name), status: "approved",
      source: kept ? "wikidata" : "manual", source_ref: kept ? existing!.source_ref : null,
      reviewed_by: auth.account_id, reviewed_at: now, updated_at: now,
    }, { onConflict: "port_id,lang" }).select("port_id, lang, name, status, source, source_ref, reviewed_at").single();
    if (error) { _t.done({ status: 500 }); return NextResponse.json({ error: "save_failed" }, { status: 500 }); }
    saved = data as NameRow;
  } else {
    if (!existing) { _t.done({ status: 404 }); return NextResponse.json({ error: "nothing_to_change" }, { status: 404 }); }
    const patch = action === "reject"
      ? { status: "rejected", reviewed_by: auth.account_id, reviewed_at: now, updated_at: now }
      : { status: "proposed", reviewed_by: null, reviewed_at: null, updated_at: now };
    const { data, error } = await supabaseServer.from("shipping_place_names").update(patch)
      .eq("port_id", portId).eq("lang", lang)
      .select("port_id, lang, name, status, source, source_ref, reviewed_at").single();
    if (error) { _t.done({ status: 500 }); return NextResponse.json({ error: "save_failed" }, { status: 500 }); }
    saved = data as NameRow;
  }

  const { header } = _t.done({ status: 200, action });
  return NextResponse.json({ entry: entryOf(saved) }, { headers: { "Server-Timing": header } });
}
