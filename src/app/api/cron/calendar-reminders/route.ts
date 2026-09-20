import "server-only";

/* GET /api/cron/calendar-reminders (every 2 minutes, vercel.json)
   For each event with a reminder, the NEXT occurrence is computed (one-off =
   the event itself; a series = its next date) and, once now is within
   [start - reminder, start + 1h], the organizer and every guest who has not
   declined get an inbox row + web push. `reminded_at` stores the occurrence
   start last alerted for, so a series re-arms for its next period and never
   double-fires the same one; a reschedule resets it (calendar-access).

   Guarded by CRON_SECRET like the other crons (skipped when unset for local
   hand-runs). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { supersedeUnread } from "@/lib/server/inbox-lifecycle";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { nextOccurrenceStart, type CalendarRec } from "@/lib/calendar-recurrence";
import { eventAttendeeIds } from "@/lib/server/calendar-access";
import { accountTimezone, eventLink, formatWhen } from "@/lib/server/calendar-notify";

export const dynamic = "force-dynamic";

interface EvRow {
  id: string;
  tenant_id: string | null;
  account_id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
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

  /* Candidates: a reminder is set, and the event is either a series or a
     one-off that has not ended long ago. */
  const horizon = new Date(nowMs - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseServer
    .from("koleex_calendar_events")
    .select("id, tenant_id, account_id, title, start_at, end_at, all_day, reminder_minutes, reminded_at, recurrence, recurrence_until")
    .not("reminder_minutes", "is", null)
    .or(`recurrence.not.is.null,start_at.gte.${horizon}`)
    .limit(500);

  if (error) {
    console.error("[cron/calendar-reminders]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let fired = 0;
  const tzByAccount = new Map<string, string>();
  for (const ev of (data ?? []) as EvRow[]) {
    const mins = ev.reminder_minutes ?? 0;
    const occ = nextOccurrenceStart(ev.start_at, ev.recurrence, ev.recurrence_until, now);
    if (!occ) continue;
    const occMs = occ.getTime();
    if (nowMs < occMs - mins * 60_000) continue; // not time yet
    if (ev.reminded_at && new Date(ev.reminded_at).getTime() >= occMs) continue; // this occurrence is done
    if (nowMs > occMs + 60 * 60 * 1000) {
      /* Missed window — stamp it so a stale one-off stops being evaluated. */
      await supabaseServer.from("koleex_calendar_events").update({ reminded_at: occ.toISOString() }).eq("id", ev.id);
      continue;
    }

    const recipients = Array.from(new Set([ev.account_id, ...(await eventAttendeeIds(ev.id, { excludeDeclined: true }))]));

    let tz = tzByAccount.get(ev.account_id);
    if (!tz) { tz = await accountTimezone(ev.account_id); tzByAccount.set(ev.account_id, tz); }
    const durationMs = Math.max(0, Date.parse(ev.end_at) - Date.parse(ev.start_at));
    const when = formatWhen(occ.toISOString(), new Date(occMs + durationMs).toISOString(), ev.all_day, tz);
    const soon = mins > 0 ? ` (in ${mins} min)` : "";

    const meta = { type: "calendar_reminder", event_id: ev.id };
    await supersedeUnread({ recipients, meta });
    await supabaseServer.from("inbox_messages").insert(
      recipients.map((rid) => ({
        recipient_account_id: rid,
        sender_account_id: null,
        tenant_id: ev.tenant_id,
        category: "calendar",
        subject: `Starting soon: ${ev.title}`,
        body: `${when}${soon}.`,
        link: eventLink(ev.id),
        metadata: meta,
      })),
    );
    await emitPings(recipients.map((id) => ({ topic: rtTopic.inbox(id) })));
    await sendPushToAccounts(recipients, {
      title: ev.title,
      body: `Starts ${when}${soon}`,
      url: eventLink(ev.id),
      tag: `calendar-reminder-${ev.id}`,
      kind: "calendar_reminder",
    }).catch((e) => console.error("[cron/calendar-reminders] push:", e));

    await supabaseServer.from("koleex_calendar_events").update({ reminded_at: occ.toISOString() }).eq("id", ev.id);
    fired += 1;
  }

  return NextResponse.json({ ok: true, fired });
}
