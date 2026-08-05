import "server-only";

/* GET /api/fx/cny-usd — the CNY→USD rate used beside factory costs.

   Signed-in callers only: it is a tiny public number, but the endpoint also
   reveals whether this tenant has configured its own rate, and there is no
   reason for it to answer strangers.

   Cached at the edge for an hour with a long stale window. These are daily
   reference rates; a product grid must not pay a cross-border round trip to
   redraw a "≈ $" hint. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getCnyToUsd } from "@/lib/server/fx-live";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const quote = await getCnyToUsd(auth.tenant_id ?? null);
  return NextResponse.json(quote, {
    headers: {
      "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
