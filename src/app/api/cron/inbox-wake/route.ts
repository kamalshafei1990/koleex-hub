import "server-only";
/* GET /api/cron/inbox-wake  (every 5 minutes)
   Snoozed notifications whose time has come go back to the top of their
   reader's bell as new, with their push (lib/server/inbox-snooze). */
import { NextResponse } from "next/server";
import { wakeSnoozed } from "@/lib/server/inbox-snooze";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await wakeSnoozed();
  return NextResponse.json({ ok: true, ...r });
}
