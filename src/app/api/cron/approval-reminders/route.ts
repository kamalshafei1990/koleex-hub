import "server-only";
/* GET /api/cron/approval-reminders  (hourly)
   A request that has waited a day on its approver comes back to them, in
   their working hours; one that has waited three days reaches the Super
   Admins (lib/server/approval-reminders). */
import { NextResponse } from "next/server";
import { runApprovalReminders } from "@/lib/server/approval-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await runApprovalReminders();
  return NextResponse.json({ ok: true, ...r });
}
