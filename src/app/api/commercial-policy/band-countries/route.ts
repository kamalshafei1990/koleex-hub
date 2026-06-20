import "server-only";

/* PUT /api/commercial-policy/band-countries
   Replace the full country → market-band assignment map for the caller's
   tenant. Writes to commercial_band_countries (id, tenant_id, band_id,
   country_code) — the same table the pricing engine reads to resolve a
   country's market adjustment.

   Body: { rows: [{ country_code: "EG", band_id: "<uuid>" }, ...] }
   The array is the COMPLETE desired assignment. We reconcile by deleting
   every existing row for the tenant and inserting the supplied set, so
   "what the admin sees is exactly what's stored". Country codes are
   upper-cased; band_ids are validated against the tenant's own bands so a
   client can't point a country at another tenant's band.

   Gated to super_admin / admin / general_manager — same as the section
   editor. Returns the fresh bandCountries list for an in-place snapshot
   patch. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getBandCountries } from "@/lib/server/commercial-policy";

const POLICY_ADMIN_ROLES = new Set<string>(["super_admin", "admin", "general_manager"]);

async function callerHasPolicyAccess(roleId: string | null, isSuperAdmin: boolean): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (!roleId) return false;
  const { data } = await supabaseServer.from("roles").select("slug").eq("id", roleId).maybeSingle();
  const slug = (data as { slug?: string } | null)?.slug;
  return !!slug && POLICY_ADMIN_ROLES.has(slug);
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const allowed = await callerHasPolicyAccess(auth.role_id, auth.is_super_admin);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorised to edit the commercial policy" }, { status: 403 });
  }

  let body: { rows?: { country_code?: unknown; band_id?: unknown }[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const inbound = Array.isArray(body.rows) ? body.rows : [];

  /* Validate band_ids against this tenant's bands. */
  const { data: bandRows, error: bandErr } = await supabaseServer
    .from("commercial_market_bands")
    .select("id")
    .eq("tenant_id", auth.tenant_id);
  if (bandErr) {
    return NextResponse.json({ error: bandErr.message }, { status: 500 });
  }
  const validBandIds = new Set<string>((bandRows ?? []).map((b) => (b as { id: string }).id));

  /* Normalise + dedupe by country_code (last assignment wins). */
  const byCountry = new Map<string, string>();
  for (const r of inbound) {
    const cc = typeof r.country_code === "string" ? r.country_code.trim().toUpperCase() : "";
    const bid = typeof r.band_id === "string" ? r.band_id : "";
    if (!cc || cc.length > 3) continue;
    if (!bid || !validBandIds.has(bid)) {
      return NextResponse.json(
        { error: `Invalid band for country ${cc || "?"}` },
        { status: 400 },
      );
    }
    byCountry.set(cc, bid);
  }

  /* Full reconcile: wipe the tenant's assignments, insert the new set. */
  const { error: delErr } = await supabaseServer
    .from("commercial_band_countries")
    .delete()
    .eq("tenant_id", auth.tenant_id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (byCountry.size > 0) {
    const inserts = Array.from(byCountry.entries()).map(([country_code, band_id]) => ({
      tenant_id: auth.tenant_id,
      band_id,
      country_code,
    }));
    const { error: insErr } = await supabaseServer.from("commercial_band_countries").insert(inserts);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  const fresh = await getBandCountries(auth.tenant_id);
  return NextResponse.json({ ok: true, bandCountries: fresh });
}
