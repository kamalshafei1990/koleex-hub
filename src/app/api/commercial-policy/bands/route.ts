import "server-only";

/* GET /api/commercial-policy/bands — lightweight, non-privileged view of the
   Market Bands + country→band assignment from Commercial Setup.

   The full /api/commercial-policy snapshot is admin-only because it exposes
   margin floors, adjustment percentages, and approval chains. This endpoint
   deliberately returns ONLY the non-sensitive directory bits a customer form
   needs to label + auto-assign a customer's band from their country:
     - band code / name / label / sort order
     - country_code → band code map
   No adjustment_percent, no flex ranges, no approval data. Gated to any
   authenticated user in the tenant. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getMarketBands, getBandCountries } from "@/lib/server/commercial-policy";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const [bands, bandCountries] = await Promise.all([
    getMarketBands(auth.tenant_id),
    getBandCountries(auth.tenant_id),
  ]);

  const activeBands = bands
    .filter((b) => b.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((b) => ({ code: b.code, name: b.name, label: b.label }));

  // country_code (upper) → band code, resolving the band_id via the bands list.
  const bandById = new Map(bands.map((b) => [b.id, b.code]));
  const countryBands: Record<string, string> = {};
  for (const bc of bandCountries) {
    const code = bandById.get(bc.band_id);
    if (code) countryBands[bc.country_code.toUpperCase()] = code;
  }

  return NextResponse.json(
    { bands: activeBands, countryBands },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}
