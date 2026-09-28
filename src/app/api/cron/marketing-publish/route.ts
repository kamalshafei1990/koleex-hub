import "server-only";

/* GET /api/cron/marketing-publish — every 5 minutes (vercel.json), between
   the other crons' minutes: publishes the scheduled posts whose time has
   come, carries on posts still publishing, refreshes Feed accounts not
   refreshed for 3 hours, and brings in new comments on recent posts every
   15 minutes (lib/server/marketing/cron).

   Guarded by CRON_SECRET, and CLOSED when it is unset (like the reminder
   crons): this route publishes to Koleex's public pages and must never be
   callable anonymously. Idempotent under overlap — posts and accounts are
   claimed before anything is sent. */

import { NextResponse } from "next/server";
import { runMarketingCron } from "@/lib/server/marketing/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runMarketingCron({ budgetMs: 50_000 });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[cron/marketing-publish]", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
