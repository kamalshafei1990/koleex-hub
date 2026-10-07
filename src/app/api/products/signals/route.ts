/* ---------------------------------------------------------------------------
   POST /api/products/signals — INTERNAL work signals for the Product Data
   grid, for a LIST of product ids. Per product:

     readiness  — 0-100, the SAME computeReadiness engine the editor uses,
                  so the card and the detail page never disagree
     missing    — up to 3 actionable gap keys (photo/specs/cost/desc/code)
     cost       — effective cost in CNY (cost-permission gated)
     visible    — customers can see it (distinct from status)
     updatedAt  — staleness
     supplier   — { id } into the `suppliers` dictionary, or { id: null,
                  name } when the model row carries free text

   WHY IDS, NOT THE WHOLE CATALOGUE (22 Sep 2026). The GET version read every
   product, every model, every media row, every supplier link, every
   translation and EVERY contact on every open, then shipped 408 KB back:
   190 KB of signals (each carrying a full supplier object with a 200-byte
   logo URL — the same eight suppliers, repeated 394 times), 158 KB of model
   maps the list response already delivers with each page, and 60 KB of
   thumbnails. That was for 394 products; at the owner's 3,000 it is ~3 MB
   per open, and the grid only ever shows one page at a time. The list is
   paged; this now follows the page. Same discipline as /api/products/
   fob-prices: the client posts the ids it is holding and merges.

   WHAT LEFT THE PAYLOAD, AND WHERE IT WENT:
     · models (counts / codes / rosters) — ride with each list page.
     · supplier objects — one `suppliers` dictionary per response; the
       signal carries the id.
     · every other per-product field is unchanged, so the card is unchanged.

   COST SOURCE (owner's source-of-truth rule): the SUPPLIER LINK is the
   record; the variant's cost_price is the fallback. The profile's Price tab
   reads them in the same order — the GET version read the variant first,
   and the same product could show "Not set" on one screen and ¥6,554 on
   the other.

   Deliberately a SEPARATE endpoint, not extra weight on /api/products: the
   public /products catalogue must keep its slim, fast payload — only
   /product-data asks for signals.
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductCostAccess, requireProductDataAction } from "@/lib/server/product-access";
import { computeProductSignals } from "@/lib/server/product-signals";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  /* Work signals expose completeness + cost posture — Product Data only. */
  const denied = await requireProductDataAction(auth, "view");
  if (denied) return denied;
  const canSeeCosts = await hasProductCostAccess(auth);

  let ids: string[] = [];
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) {
      ids = body.ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    }
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const payload = await computeProductSignals(auth.tenant_id, ids, canSeeCosts);
  if (!payload) {
    return NextResponse.json({ error: "Failed to load signals" }, { status: 500 });
  }
  /* POST responses are not cached by the browser, and this one should not
     be: signals move at data-entry speed, and the page-level warm start
     (thumbnails in localStorage) already covers the repeat open. */
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
