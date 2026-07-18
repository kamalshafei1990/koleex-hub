import "server-only";

/* GET /api/cron/calendar-reminders
   Fires calendar event reminders. For each event with reminder_minutes set,
   computes the NEXT occurrence (one-off = the event itself; recurring = the
   next date in the series) and, once now is within [occStart - reminder, now],
   pings the organizer + all attendees via inbox + web-push. `reminded_at`
   stores the occurrence-start we last alerted for, so a recurring event
   re-arms cleanly for its next occurrence and never double-fires the same one.

   Guarded by CRON_SECRET like the other crons (skipped when unset for local
   hand-runs). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { nextOccurrenceStart, type CalendarRec } from "@/lib/calendar-recurrence";

export const dynamic = "force-dynamic";

interface EvRow {
  id: string;
  account_id: string;
  title: string;
  start_at: string;
  reminder_minutes: number | null;
  reminded_at: string | null;
  recurrence: CalendarRec;
  recurrence_until: string | null;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const now = new Date();
  const nowMs = now.getTime();

  // Candidate events: reminder set. Bound the scan — one-off events far in the
  // past can't have an upcoming occurrence, so ignore anything that already
  // ended long ago AND isn't recurring.
  const horizon = new Date(nowMs - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseServer
    .from("koleex_calendar_events")
    .select("id, account_id, title, start_at, reminder_minutes, reminded_at, recurrence, recurrence_until")
    .not("reminder_minutes", "is", null)
    .or(`recurrence.not.is.null,start_at.gte.${horizon}`)
    .limit(500);

  if (error) {
    console.error("[cron/calendar-reminders]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let fired = 0;
  for (const ev of (data ?? []) as EvRow[]) {
    const mins = ev.reminder_minutes ?? 0;
    const occ = nextOccurrenceStart(ev.start_at, ev.recurrence, ev.recurrence_until, now);
    if (!occ) continue;
    const occMs = occ.getTime();
    const alertAt = occMs - mins * 60_000;
    if (nowMs < alertAt) continue; // not time yet
    // Already alerted for this occurrence?
    if (ev.reminded_at && new Date(ev.reminded_at).getTime() >= occMs) continue;
    // Don't alert for an occurrence already well past its start (missed window).
    if (nowMs > occMs + 60 * 60 * 1000) {
      // still stamp so we don't keep evaluating a stale one-off
      await supabaseServer.from("koleex_calendar_events").update({ reminded_at: occ.toISOString() }).eq("id", ev.id);
      continue;
    }

    const { data: att } = await supabaseServer
      .from("koleex_calendar_event_attendees")
      .select("account_id")
      .eq("event_id", ev.id)
      .neq("status", "declined");
    const recipients = Array.from(
      new Set([ev.account_id, ...(att ?? []).map((a) => (a as { account_id: string }).account_id)].filter(Boolean)),
    );

    const whenStr = occ.toLocaleString();
    await supabaseServer.from("inbox_messages").insert(
      recipients.map((rid) => ({
        recipient_account_id: rid,
        sender_account_id: null,
        category: "calendar",
        subject: `⏰ ${ev.title}`,
        body: `Starts ${whenStr}${mins ? ` (in ${mins} min)` : ""}.`,
        link: `/calendar`,
        metadata: { type: "calendar_reminder", event_id: ev.id },
      })),
    );
    await sendPushToAccounts(recipients, {
      title: `⏰ ${ev.title}`,
      body: `Starts ${whenStr}`,
      url: "/calendar",
      tag: `calendar-reminder-${ev.id}`,
    }).catch((e) => console.error("[cron/calendar-reminders] push:", e));

    await supabaseServer
      .from("koleex_calendar_events")
      .update({ reminded_at: occ.toISOString() })
      .eq("id", ev.id);
    fired += 1;
  }

  return NextResponse.json({ ok: true, fired });
}
