import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/work-reports/compliance?week=YYYY-MM-DD — the compliance board
   (Phase 3A): for one ISO week (the one the day falls in, this week by
   default), who in the viewer's scope was expected to send which report and
   what happened — sent on time, late, missing, due, on leave, off.

   Scope: a super admin and HR·view see everyone; a manager their own people
   at every level; anyone else an empty board. Whether a report was sent,
   never its text (src/lib/server/reports/obligations.ts).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { requireReportsUser } from "@/lib/server/reports/core";
import { loadBoard } from "@/lib/server/reports/obligations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const raw = new URL(req.url).searchParams.get("week");
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
  const board = await loadBoard(auth, day);
  return NextResponse.json(board, { headers: { "Cache-Control": "private, no-store" } });
}
