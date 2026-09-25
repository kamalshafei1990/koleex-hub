import "server-only";

/* GET /api/cron/discuss-pending-sweep  (daily)
   Orphaned Discuss uploads: a file uploaded for a send that never reached the
   server (the "Not sent" bubble was abandoned, the device was wiped, the
   client-side discard call never landed) is referenced by no message and
   would sit in the private discuss-media / discuss-voice buckets forever.
   Every discuss_pending_uploads row older than 8 days (outbox TTL 7 days +
   a day of slack) is settled here: an unreferenced path loses its storage
   object, and the row is deleted either way — see sweepDiscussPendingUploads
   in src/lib/discuss-pending-uploads.ts.

   Guarded by CRON_SECRET, CLOSED when it is unset (like calendar-reminders /
   project-task-reminders): this route deletes stored files and must never be
   callable anonymously. The answer carries counts only. */

import { NextResponse } from "next/server";
import { sweepDiscussPendingUploads } from "@/lib/discuss-pending-uploads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const res = await sweepDiscussPendingUploads({ deadlineMs: 45_000 });
  return NextResponse.json(res, {
    status: res.ok ? 200 : 500,
    headers: { "Cache-Control": "no-store" },
  });
}
