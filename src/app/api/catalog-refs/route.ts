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

/* MEMOISED, for the same reason /api/visual-bindings is (see that route).

   Measured on prod 2026-08-11: this is the heaviest call on a Product Data
   open — 3174ms and 36 KB on the wire — and both halves of it are reference
   data that is byte-identical for every user and changes only when someone
   edits the classification tree. Rebuilding it per request buys nothing.

   It stays `private` because the route sits behind requireAuth, so the CDN
   must not hold it; the memo lives inside the function instead, which keeps
   the auth check on every request and skips only the work. The TTL is short
   because taxonomy edits land through other routes that cannot invalidate
   this one — 5 minutes is the same freshness the individual endpoints
   already advertised via stale-while-revalidate. */
interface RefsMemo { at: number; body: { taxonomy: unknown; icons: unknown } }
const gr = globalThis as typeof globalThis & { __kxCatalogRefs?: RefsMemo | null };
const REFS_TTL_MS = 5 * 60_000;

const REFS_HEADERS = { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" };

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const memo = gr.__kxCatalogRefs;
  if (memo && Date.now() - memo.at < REFS_TTL_MS) {
    return NextResponse.json(memo.body, { headers: REFS_HEADERS });
  }

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

  const body = { taxonomy, icons };
  /* Only memoise a COMPLETE answer. If either half failed it returned null,
     and caching that would pin the failure for five minutes. */
  if (taxonomy && icons) gr.__kxCatalogRefs = { at: Date.now(), body };

  /* Matches the TTL the individual routes already advertise, so nothing
     becomes staler than it was before the batch existed. */
  return NextResponse.json(body, { headers: REFS_HEADERS });
}
