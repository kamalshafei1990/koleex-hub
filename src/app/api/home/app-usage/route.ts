import "server-only";

/* ===========================================================================
   GET /api/home/app-usage?routes=/products,/product-data,…

   The caller's OWN page views of the last 30 days, counted per app route —
   read once per person, the first time Home fills their "My apps" row
   (lib/home/my-apps.ts). Never on an ordinary Home open: once the row is
   seeded, the preference says so and Home stops asking.

   Self-scoped: the account comes from the session, never from the request.
   `routes` is only the list of app routes to count against (the apps the
   caller can see, sent by Home, which already knows them); each is checked
   against a strict pattern and matched as a string — nothing from it reaches
   the query.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

export const dynamic = "force-dynamic";

const ROUTE_RE = /^\/[a-z0-9][a-z0-9/-]{0,63}$/;
const MAX_ROUTES = 80;
const PAGE = 1000;
const MAX_ROWS = 20_000;
const DAYS = 30;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const raw = new URL(req.url).searchParams.get("routes") ?? "";
  const routes = [...new Set(raw.split(",").map((r) => r.trim()).filter((r) => ROUTE_RE.test(r)))].slice(0, MAX_ROUTES);
  if (routes.length === 0) return NextResponse.json({ views: {} }, { headers: { "Cache-Control": "no-store" } });
  /* Longest route first, so /ai/knowledge wins over /ai for its own pages. */
  const byLength = [...routes].sort((a, b) => b.length - a.length);

  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const views: Record<string, number> = {};
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabaseServer
      .from("activity_events")
      .select("route")
      .eq("account_id", auth.account_id)
      .eq("event_type", "page_view")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[api/home/app-usage]", error.message);
      return NextResponse.json({ error: "Could not read usage." }, { status: 500 });
    }
    for (const row of data ?? []) {
      const path = typeof row.route === "string" ? row.route.split("?")[0] : "";
      if (!path) continue;
      const hit = byLength.find((r) => path === r || path.startsWith(r + "/"));
      if (hit) views[hit] = (views[hit] ?? 0) + 1;
    }
    if (!data || data.length < PAGE) break;
  }
  return NextResponse.json({ views }, { headers: { "Cache-Control": "no-store" } });
}
