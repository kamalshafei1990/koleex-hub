import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

import { GET as preferencesGET } from "../me/preferences/route";
import { GET as workflowsGET } from "../workflows/status/route";
import { GET as financeSetupGET } from "../finance/setup/status/route";

/* ---------------------------------------------------------------------------
   /api/home-refs — the three payloads the Home screen asks for on mount, in
   ONE round trip. Third batch in the same family as /api/shell (every screen)
   and /api/catalog-refs (catalogue screens); this one is Home-only for the
   same reason catalog-refs is separate — nothing else reads these, so nothing
   else should pay for them.

   Measured on production before this route existed: /home opened 12 API calls
   spanning 2.5 s. These three were three of them, and RoleHome already
   requests all three together in one Promise.all, so they are exactly the
   case a batch is for.

   Same construction as the other two: call the EXISTING handlers, so auth and
   shaping cannot drift, and let a failing section return null for its own key
   instead of sinking the batch — the client then falls back to that section's
   own endpoint.

   /api/operations/snapshot is deliberately NOT here. NotificationBell fetches
   it directly (not through cachedGet) because the badge count has to be
   fresh, and folding a live counter into a cached batch would make the bell
   lie.
   --------------------------------------------------------------------------- */

export const dynamic = "force-dynamic";

type Section = readonly [string, () => Promise<Response>];

async function collect([key, run]: Section): Promise<[string, unknown]> {
  try {
    const res = await run();
    if (!res.ok) return [key, null];
    return [key, await res.json()];
  } catch {
    return [key, null];
  }
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const sections: Section[] = [
    ["preferences", () => preferencesGET()],
    ["workflows", () => workflowsGET()],
    ["financeSetup", () => financeSetupGET()],
  ];

  const entries = await Promise.all(sections.map(collect));

  return NextResponse.json(Object.fromEntries(entries), {
    /* The shortest TTL of the three (workflows/status, 30s) governs, so
       nothing here is cached longer than it was on its own. */
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}
