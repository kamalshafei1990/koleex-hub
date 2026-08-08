import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

import { GET as taxonomyGET } from "../taxonomy/[kind]/route";
import { GET as iconsGET } from "../classification-icons/route";

/* ---------------------------------------------------------------------------
   /api/catalog-refs — the reference data every catalogue screen needs, in ONE
   round trip: the divisions/categories/subcategories taxonomy and the
   classification icon set.

   WHY SEPARATE FROM /api/shell: taxonomy is a 128 KB payload that only the
   catalogue screens read. Folding it into the shell batch would make every
   other screen in the Hub pay for it.

   WHY IT MATTERS HERE: measured against production, /api/taxonomy/all takes
   1.8–2.8 s wall-clock while its three database queries run in 0.3 ms — the
   time is the round trip to the function region, not the work. Requests are
   therefore the unit of cost, and merging two of them saves one full trip on
   every catalogue open.

   Same construction as /api/shell: call the EXISTING handlers so there is no
   duplicated logic to drift, and let a failing section return null rather
   than sink the batch (the caller then falls back to its own endpoint).
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const origin = new URL(req.url).origin;

  const read = async (run: () => Promise<Response>) => {
    try {
      const res = await run();
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  };

  const [taxonomy, icons] = await Promise.all([
    read(() =>
      taxonomyGET(
        new Request(`${origin}/api/taxonomy/all`, { headers: req.headers }),
        { params: Promise.resolve({ kind: "all" }) },
      ),
    ),
    read(() => iconsGET()),
  ]);

  return NextResponse.json(
    { taxonomy, icons },
    /* Matches the TTL the individual routes already advertise, so nothing
       becomes staler than it was before the batch existed. */
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  );
}
