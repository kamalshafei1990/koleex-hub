import "server-only";

/* GET /api/commercial-policy/market-adjustments

   The country → market-price-adjustment map, derived from the live
   Commercial-Setup market bands + country segmentation. This is the
   SINGLE SOURCE OF TRUTH for per-country price adjustments: the Price
   Calculator (and anything else that needs "how much do we adjust price
   for country X") reads this instead of a hardcoded table, so editing a
   band or a country's segmentation flows everywhere automatically.

   Unlike GET /api/commercial-policy (super-admin only — it exposes margin
   floors, discount chains, commissions), this endpoint returns ONLY the
   non-sensitive market adjustment per country, so any authenticated tenant
   user (e.g. sales using the calculator) can read it.

   Each entry: { code, name, currency, band, adjustmentPct } where
   adjustmentPct is a fraction (e.g. -0.03 = −3%). A country's band is its
   saved segmentation assignment if present, else the master-list default
   band letter. If the tenant has no active bands configured, `markets` is
   empty so callers fall back to their own defaults (no silent zeroing). */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { COUNTRIES } from "@/lib/commercial-policy/countries";

interface BandLite { id: string; code: string; adjustment_percent: number }

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const [bandRes, mapRes] = await Promise.all([
    supabaseServer
      .from("commercial_market_bands")
      .select("id, code, adjustment_percent, is_active")
      .eq("tenant_id", auth.tenant_id)
      .eq("is_active", true),
    supabaseServer
      .from("commercial_band_countries")
      .select("band_id, country_code")
      .eq("tenant_id", auth.tenant_id),
  ]);

  if (bandRes.error) return NextResponse.json({ error: bandRes.error.message }, { status: 500 });

  const bands = (bandRes.data ?? []) as BandLite[];
  if (bands.length === 0) {
    // Policy not configured for this tenant — let callers use their defaults.
    return NextResponse.json({ markets: [] }, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" },
    });
  }

  const bandById = new Map<string, BandLite>(bands.map((b) => [b.id, b]));
  const bandByCode = new Map<string, BandLite>(bands.map((b) => [b.code.toUpperCase(), b]));
  const assigned = new Map<string, string>();
  for (const r of (mapRes.data ?? []) as { band_id: string; country_code: string }[]) {
    assigned.set(r.country_code.toUpperCase(), r.band_id);
  }

  const markets = COUNTRIES.map((c) => {
    const savedId = assigned.get(c.code.toUpperCase());
    const band =
      (savedId && bandById.get(savedId)) ||
      (c.band ? bandByCode.get(c.band.toUpperCase()) : undefined) ||
      null;
    return {
      code: c.code,
      name: c.name,
      currency: c.currency ?? "USD",
      band: band ? band.code : (c.band ?? "B"),
      // band.adjustment_percent is a whole-number percent (e.g. -3 → -0.03).
      adjustmentPct: band ? Number(band.adjustment_percent) / 100 : 0,
    };
  });

  return NextResponse.json({ markets }, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" },
  });
}
