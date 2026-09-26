import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/inbox/pause — pause notifications from the bell, or resume.

   Body: { until: ISO }     pause until then (1 minute … 7 days ahead)
         { meeting: true }  until the meeting the caller is in ends (else 1h)
         { until: null }    resume

   Always the caller's own preferences (the session's account). Answers the
   moment the pause ends, and whether a meeting set it.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { setPause, type PauseRequest } from "@/lib/server/notification-pause";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: PauseRequest;
  try { body = (await req.json()) as PauseRequest; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const r = await setPause(auth.account_id, {
    until: body.until === null ? null : typeof body.until === "string" ? body.until : undefined,
    meeting: body.meeting === true,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, until: r.until, meeting: r.meeting });
}
