import "server-only";

/* GET /api/cron/calendar-reminders (every 2 minutes, vercel.json)
   For each event with a reminder, the NEXT occurrence is computed (one-off =
   the event itself; a series = its next date, on the organizer's clock) and,
   once now is within [start - reminder, start + 1h], the organizer and every
   guest who has not declined get an inbox row + web push. `reminded_at`
   stores the occurrence start last alerted for, so a series re-arms for its
   next period and never double-fires the same one; a reschedule resets it
   (calendar-access).

   No double sends: before anything is sent the occurrence is CLAIMED with a
   conditional update (reminded_at is null or older than this occurrence);
   only the run whose update returned the row sends. Two overlapping runs, or
   a run retried by the platform, cannot both win the same claim.

   Candidates are bounded: a series still running (no end, or an end date not
   yet past), or a one-off starting between two days ago and a week ahead
   (the longest reminder is a week). Earliest first, so a backlog is worked
   through in order.

   A series' "this occurrence only" changes are honoured
   (lib/calendar-recurrence nextEffectiveOccurrence): a deleted occurrence
   is never reminded, a moved one is reminded at its new time, with its own
   title and meeting link. The link, when there is one, is in the text.

   Guarded by CRON_SECRET, and CLOSED when it is unset: this route sends
   notifications to real people and must never be callable anonymously. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { prepareTpl, type NotifTpl, type TplParams } from "@/lib/notification-templates";
import { supersedeUnread } from "@/lib/server/inbox-lifecycle";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { nextEffectiveOccurrence, type CalendarRec } from "@/lib/calendar-recurrence";
import { accountTimezones, eventLink, formatWhen, whenParts } from "@/lib/server/calendar-notify";
import { isMissingSchema } from "@/lib/server/calendar-access";
import { loadExceptions } from "@/lib/server/calendar-exceptions";

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
  meeting_url?: string | null;
}

const MIN = 60_000;
const EVENTS = "koleex_calendar_events";

/** "in 5 min", "in 1 h 30 min", "in 2 days", "starting now" — from what is
 *  actually left, not from the configured lead (a late run would otherwise
 *  say "in 15 min" about a meeting starting in 3). `lead` is the English
 *  words (the push); `tpl` the inbox row's template, one per wording, so
 *  each reader gets it in their own language. */
function timeLeft(ms: number, p: TplParams): { lead: string; tpl: NotifTpl } {
  const mins = Math.round(ms / MIN);
  if (mins <= 0) return { lead: "starting now", tpl: { k: "calendar_reminder.now", p } };
  if (mins < 60) return { lead: `in ${mins} min`, tpl: { k: "calendar_reminder.min", p: { ...p, min: mins } } };
  if (mins < 48 * 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m
      ? { lead: `in ${h} h ${m} min`, tpl: { k: "calendar_reminder.hours_min", p: { ...p, h, min: m } } }
      : { lead: `in ${h} h`, tpl: { k: "calendar_reminder.hours", p: { ...p, h } } };
  }
  const days = Math.round(mins / 1440);
  return { lead: `in ${days} days`, tpl: { k: "calendar_reminder.days", p: { ...p, days } } };
}

/** Stamp the occurrence as handled — only if no other run has. */
async function claim(id: string, occISO: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from(EVENTS)
    .update({ reminded_at: occISO })
    .eq("id", id)
    .or(`reminded_at.is.null,reminded_at.lt.${occISO}`)
    .select("id");
  if (error) {
    console.error("[cron/calendar-reminders] claim:", error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const now = new Date();
  const nowMs = now.getTime();
  const horizon = new Date(nowMs - 2 * 24 * 60 * MIN).toISOString();
  const ahead = new Date(nowMs + 8 * 24 * 60 * MIN).toISOString();
  const today = now.toISOString().slice(0, 10);

  const COLS = "id, tenant_id, account_id, title, start_at, end_at, all_day, reminder_minutes, reminded_at, recurrence, recurrence_until";
  const load = (cols: string) => supabaseServer
    .from(EVENTS)
    .select(cols)
    .not("reminder_minutes", "is", null)
    .or(`recurrence.not.is.null,and(start_at.gte.${horizon},start_at.lte.${ahead})`)
    .or(`recurrence_until.is.null,recurrence_until.gte.${today}`)
    .order("start_at", { ascending: true })
    .limit(500);
  /* The meeting link is read once the 2026-09-26 migration has added it. */
  let { data, error } = await load(`${COLS}, meeting_url`);
  if (isMissingSchema(error, "meeting_url")) ({ data, error } = await load(COLS));

  if (error) {
    console.error("[cron/calendar-reminders]", error.message);
    return NextResponse.json({ error: "Failed to load reminders" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as EvRow[];
  /* One round trip for every organizer's zone (a series' next date is on
     its organizer's clock), one for every series' exceptions. */
  const [tzByAccount, exceptions] = await Promise.all([
    accountTimezones(rows.map((r) => r.account_id)),
    loadExceptions(rows.filter((r) => r.recurrence).map((r) => r.id)),
  ]);

  type Due = { ev: EvRow; occ: Date; end: Date; tz: string };
  const due: Due[] = [];
  const missed: Array<{ ev: EvRow; occ: Date }> = [];
  for (const row of rows) {
    const tz = tzByAccount.get(row.account_id) ?? "UTC";
    const next = nextEffectiveOccurrence(row.start_at, row.end_at, row.recurrence, row.recurrence_until, now, exceptions.get(row.id), tz);
    if (!next) continue;
    const occ = next.start;
    const occMs = occ.getTime();
    if (nowMs < occMs - (row.reminder_minutes ?? 0) * MIN) continue; // not time yet
    if (row.reminded_at && Date.parse(row.reminded_at) >= occMs) continue; // this occurrence is done
    /* This occurrence's own title / link, when it was changed on its own
       ('' = its link was cleared). */
    const ov = next.override;
    const ev: EvRow = ov ? { ...row, title: ov.title || row.title, meeting_url: ov.meeting_url != null ? ov.meeting_url || null : row.meeting_url ?? null } : row;
    if (nowMs > occMs + 60 * MIN) missed.push({ ev, occ });
    else due.push({ ev, occ, end: next.end, tz });
  }

  /* Missed window — stamp it so a stale one-off stops being evaluated. */
  await Promise.all(missed.map(({ ev, occ }) => claim(ev.id, occ.toISOString())));

  /* Guests of every due event in one read. */
  const guestsByEvent = new Map<string, string[]>();
  if (due.length) {
    const { data: att } = await supabaseServer
      .from("koleex_calendar_event_attendees")
      .select("event_id, account_id")
      .in("event_id", due.map((d) => d.ev.id))
      .neq("status", "declined");
    for (const a of (att ?? []) as Array<{ event_id: string; account_id: string }>) {
      const list = guestsByEvent.get(a.event_id) ?? [];
      list.push(a.account_id);
      guestsByEvent.set(a.event_id, list);
    }
  }

  let fired = 0;
  for (const { ev, occ, end, tz } of due) {
    const occISO = occ.toISOString();
    if (!(await claim(ev.id, occISO))) continue; // another run has it

    const recipients = Array.from(new Set([ev.account_id, ...(guestsByEvent.get(ev.id) ?? [])]));
    const when = formatWhen(occISO, end.toISOString(), ev.all_day, tz);
    const w = whenParts(occISO, end.toISOString(), ev.all_day, tz);
    const { lead, tpl } = timeLeft(occ.getTime() - Date.now(), {
      title: ev.title, when: w.when, allDay: w.allDay, url: ev.meeting_url || null,
    });
    const text = prepareTpl(tpl);
    const join = ev.meeting_url ? ` Join: ${ev.meeting_url}` : "";

    const meta = { type: "calendar_reminder", event_id: ev.id };
    try {
      await supersedeUnread({ recipients, meta });
      await supabaseServer.from("inbox_messages").insert(
        recipients.map((rid) => ({
          recipient_account_id: rid,
          sender_account_id: null,
          tenant_id: ev.tenant_id,
          category: "calendar",
          subject: text.subject,
          body: text.body ?? `${when} (${lead}).${join}`,
          link: eventLink(ev.id),
          metadata: { ...meta, ...(text.tpl ? { tpl: text.tpl } : {}) },
        })),
      );
      await emitPings(recipients.map((id) => ({ topic: rtTopic.inbox(id) })));
      await sendPushToAccounts(recipients, {
        title: ev.title,
        body: `${when} (${lead})${join ? ` ·${join}` : ""}`,
        url: eventLink(ev.id),
        tag: `calendar-reminder-${ev.id}`,
        kind: "calendar_reminder",
        /* A reader in another language gets the row's own template. */
        tpl: text.tpl,
      }).catch((e) => console.error("[cron/calendar-reminders] push:", e));
      fired += 1;
    } catch (e) {
      /* The claim stands: a half-sent reminder is not resent every two
         minutes for the next hour. */
      console.error("[cron/calendar-reminders] send:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, fired, missed: missed.length });
}
