import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

import { GET as bootstrapGET } from "../me/bootstrap/route";
import { GET as permissionsGET } from "../me/permissions/route";
import { GET as workGET } from "../me/work/route";
import { GET as fxGET } from "../fx/cny-usd/route";
import { GET as bindingsGET } from "../visual-bindings/route";
import { GET as platformGET } from "../platform-settings/route";

/* ---------------------------------------------------------------------------
   /api/shell — ONE round trip for the payloads every screen needs.

   WHY THIS EXISTS (measured on the owner's own connection, 2026-08-08):
   a single API call to this deployment costs ~0.33 s once the TLS connection
   is warm — but /product-data opened SEVEN shell calls plus its own data, and
   the 14 concurrent requests took 6.95 s, not 0.5 s. On a lossy cross-border
   link concurrent HTTP/2 streams block each other: every lost packet stalls
   the whole connection, so N parallel requests behave far worse than N × the
   single-request cost. Fewer requests is the lever, not a faster server —
   the same test put Google's warm-connection TTFB at 0.19 s against our
   0.33 s, so per-request we were never the problem.

   HOW: this route calls the EXISTING handlers rather than re-implementing
   them. No duplicated auth, no duplicated shaping, and no way for the
   aggregate to drift from the individual endpoints (which stay in place —
   they are still the source of truth and the fallback).

   Each section is independent: one failing handler yields null for its own
   key instead of failing the batch, so a partial answer still saves the
   round trips that did work.

   inbox/feed is deliberately NOT here: its callers pass query params, so a
   single batched shape could not serve them and it would burn server time
   for a payload nobody reads.
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

type Section = readonly [string, () => Promise<Response>];

async function collect([key, run]: Section): Promise<[string, unknown]> {
  try {
    const res = await run();
    if (!res.ok) return [key, null];
    return [key, await res.json()];
  } catch {
    /* A section that throws must not take the batch down with it. */
    return [key, null];
  }
}

export async function GET() {
  /* Auth once, here, so an unauthenticated caller costs one 401 instead of
     seven. The inner handlers still check for themselves. */
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const sections: Section[] = [
    ["bootstrap", () => bootstrapGET()],
    ["permissions", () => permissionsGET()],
    ["work", () => workGET()],
    ["fx", () => fxGET()],
    ["bindings", () => bindingsGET()],
    ["platform", () => platformGET()],
  ];

  const entries = await Promise.all(sections.map(collect));
  const body = Object.fromEntries(entries) as Record<string, unknown>;

  return NextResponse.json(body, {
    /* Short private cache: a second screen opened moments later reuses this
       instead of re-running six queries. Anything that must be fresher
       (badge counts after an action) invalidates through its own endpoint. */
    headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" },
  });
}
