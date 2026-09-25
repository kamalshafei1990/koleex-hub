import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/work-reports/[id]/carry?date=YYYY-MM-DD — the suggestions from
   the author's earlier reports AND their own work in the apps (appFeed) for
   a DRAFT, and its numbers blocks (blockData, Phase 4B), recomputed for
   another day, week or month while the author moves it (the first ones
   arrive with the report itself, so the composer paints
   complete). Author of a draft only; anyone else gets the same 404 as for a
   report they cannot read.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { loadForViewer, requireReportsUser } from "@/lib/server/reports/core";
import { loadCarry } from "@/lib/server/reports/carry";
import { loadAppFeed } from "@/lib/server/reports/app-feed";
import { loadReportData } from "@/lib/server/reports/report-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id } = await params;
  const loaded = await loadForViewer(id, auth);
  if (!loaded || loaded.access !== "author") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (loaded.row.status !== "draft") return NextResponse.json({ error: "not_draft" }, { status: 409 });
  const date = new URL(req.url).searchParams.get("date");
  const [carry, appFeed, blockData] = await Promise.all([loadCarry(loaded.row, auth, date), loadAppFeed(loaded.row, auth, date), loadReportData(loaded.row, auth, date)]);
  return NextResponse.json({ carry, appFeed, blockData }, { headers: { "Cache-Control": "private, no-store" } });
}
