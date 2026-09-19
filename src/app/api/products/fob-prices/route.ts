import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { globalFobForProducts } from "@/lib/server/products-fob";

/* ---------------------------------------------------------------------------
   /api/products/fob-prices — Global FOB (USD) for a LIST of products.

   WHY A SEPARATE ROUTE
   --------------------
   The catalogue card shows a price, and there was no safe way to get one:

     · /api/products/signals carries the SUPPLIER COST and is deliberately
       Product Data only — sending it to a catalogue browser would leak what
       we pay our factories. That route is off-limits here by design.
     · /api/products/price-preview computes exactly one cost and additionally
       demands Commercial Policy admin access, so it can neither serve a
       browsing employee nor 271 cards without 271 round-trips.

   So this route is the narrow middle: it takes ids, does the cost→FOB maths
   SERVER-SIDE, and returns ONLY the finished USD number. Cost, extras, VAT,
   margins, levels and supplier identity never cross the boundary.

   ACCESS (owner decision, 2026-08-29)
   -----------------------------------
   Any Koleex Hub account may see the price — Hub accounts are issued by the
   owner personally, so authentication IS the audience gate. No extra module
   permission, and no anonymous access.

   PRICE SHAPE
   -----------
   "Global FOB" = the tier-agnostic base: landed factory cost → net internal
   → product level uplift → USD at the day's rate. Market bands and customer
   tiers are deliberately NOT applied — the card shows one comparable number,
   not a per-visitor price. The FX rate rides in the response so the card can
   say what it was converted at, and it moves with the daily rate because the
   engine reads it live on every call.
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

const MAX_IDS = 500;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let ids: string[] = [];
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) {
      ids = body.ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    }
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  ids = Array.from(new Set(ids)).slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ prices: {}, fx: null });

  /* The maths lives in lib/server/products-fob.ts (shared with the product
     page's server render); this route is its HTTP face for the catalogue
     card. The wire shape is unchanged: { prices, fx } (+ reason). */
  const out = await globalFobForProducts(auth.tenant_id, ids);
  if (out.reason) {
    /* Not an error for the card — it simply has no price to show yet. */
    return NextResponse.json({ prices: {}, fx: null, reason: out.reason });
  }
  return NextResponse.json({ prices: out.prices, fx: out.fx });
}
