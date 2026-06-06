import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/qa/reports/similar?route=…&title=…
   Returns up to 5 recent open reports on the same route whose titles look
   similar to the candidate title. Used by the Report modal to suggest
   possible duplicates before the reporter submits.

   Cheap heuristic: same tenant, same route, NOT in resolved statuses, filed
   in the last 30 days. Result is ranked client-side by token overlap.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { RESOLVED_STATUSES } from "@/lib/qa/types";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const route = (url.searchParams.get("route") ?? "").trim();
  const title = (url.searchParams.get("title") ?? "").trim();
  if (!route || title.length < 6) {
    return NextResponse.json({ candidates: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseServer
    .from("qa_issue_reports")
    .select("id, title, status, created_at, route")
    .eq("tenant_id", auth.tenant_id)
    .eq("route", route)
    .not("status", "in", `(${RESOLVED_STATUSES.map((s) => `"${s}"`).join(",")})`)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[api/qa/reports/similar]", error.message);
    return NextResponse.json({ candidates: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  // Token overlap ranking (cheap, no extra deps). Lowercase tokens ≥4 chars,
  // strip common boilerplate words. Score = shared / max(query, candidate).
  const stop = new Set(["the", "and", "for", "with", "from", "this", "that", "into", "issue", "bug", "page"]);
  const tokenize = (s: string) =>
    new Set(
      s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !stop.has(t)),
    );
  const want = tokenize(title);

  const ranked = (data ?? [])
    .map((r) => {
      const t = tokenize(r.title as string);
      let shared = 0;
      for (const w of want) if (t.has(w)) shared++;
      const denom = Math.max(want.size, t.size, 1);
      return { ...r, score: shared / denom };
    })
    .filter((r) => r.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return NextResponse.json({ candidates: ranked }, { headers: { "Cache-Control": "private, no-store" } });
}
