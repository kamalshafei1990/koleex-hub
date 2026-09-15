import "server-only";

/* ---------------------------------------------------------------------------
   /api/shipping/reference — ports, airports and the countries that have them.

   ── Why this is a search endpoint and not a dump ───────────────────────────
   The canonical tables hold 3,806 ports and 4,569 airports. Shipping that to
   the browser would be several megabytes on every visit, for a picker in which
   an operator types four letters. So the whole table stays on the server and
   this returns at most 50 rows, ordered commercially: ports Koleex already
   ships through first, then the big container ports, then the rest.

   Reference data is identical for every tenant, so it is cached for an hour —
   long, because UN/LOCODE publishes twice a year.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { portCountries, searchPorts } from "@/lib/server/shipping/port-resolver";
import { stageTimer } from "@/lib/server/perf";

const MODULE = "Shipping";
const CACHE = "private, max-age=3600, stale-while-revalidate=86400";

export async function GET(req: Request) {
  const _t = stageTimer("shipping.reference");
  const auth = await requireAuth();
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) { _t.done({ status: 403 }); return deny; }
  _t.mark("auth");

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "ports";
  const term = url.searchParams.get("q")?.trim() ?? "";
  const country = url.searchParams.get("country")?.trim() || undefined;
  /* 100, not 50: China has 74 ports and 242 airports, so a smaller ceiling
     truncated a plain browse of the origin country. The United States has 662
     ports, so a ceiling is still necessary — the picker says when it has hit
     one rather than hiding it. */
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));

  try {
    if (kind === "countries") {
      const rows = await portCountries();
      _t.mark("db");
      const { header } = _t.done({ status: 200, kind, rows: rows.length });
      return NextResponse.json({ countries: rows }, { headers: { "Cache-Control": CACHE, "Server-Timing": header } });
    }

    if (kind === "airports") {
      let q = supabaseServer.from("shipping_airports")
        .select("id, iata, icao, locode, name, country_code, municipality, lat, lng, size")
        .is("tenant_id", null).eq("is_active", true);
      if (country) q = q.eq("country_code", country.toUpperCase());
      if (term) {
        const esc = term.replace(/[%,()]/g, " ").trim();
        if (esc) q = q.or(`name.ilike.%${esc}%,iata.ilike.${esc}%,municipality.ilike.%${esc}%`);
      }
      const { data, error } = await q
        .order("size", { ascending: true })      // 'large' sorts before 'medium'
        .order("name", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      _t.mark("db");
      const { header } = _t.done({ status: 200, kind, rows: data?.length ?? 0 });
      return NextResponse.json({ airports: data ?? [] }, { headers: { "Cache-Control": CACHE, "Server-Timing": header } });
    }

    const ports = await searchPorts({
      term, countryCode: country, limit,
      originOnly: url.searchParams.get("origin") === "1",
    });
    _t.mark("db");
    const { header } = _t.done({ status: 200, kind: "ports", rows: ports.length });
    return NextResponse.json({ ports }, { headers: { "Cache-Control": CACHE, "Server-Timing": header } });
  } catch (e) {
    _t.done({ status: 500, error: 1 });
    /* The upstream message is logged, never returned — it can name columns. */
    console.warn("[shipping.reference]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "reference_unavailable" }, { status: 500 });
  }
}
