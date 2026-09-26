import "server-only";

/* ---------------------------------------------------------------------------
   notification-pause — the pause a reader takes from the bell.

   Stored as preferences.notifications.pause_until (ISO) and read wherever
   quiet hours are read (lib/notification-activity hushedNow): the push
   sender, and the bell's sound, cards and desktop notifications.

   "While I'm in a meeting" asks the Calendar: the end of the meeting the
   reader is in right now — one they organise, or were invited to and did
   not decline, timed (an all-day event is not a meeting), a series'
   occurrence included with its exceptions applied. No meeting now: an hour.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { mergeAccountPrefs } from "@/lib/server/ai/security/account-prefs";
import { expandWithExceptions, type CalendarRec } from "@/lib/calendar-recurrence";
import { accountTimezones } from "@/lib/server/calendar-notify";
import { loadExceptions } from "@/lib/server/calendar-exceptions";
import { PAUSE_MAX_MS } from "@/lib/notification-activity";

const EVENTS = "koleex_calendar_events";
const ATTENDEES = "koleex_calendar_event_attendees";
const HOUR = 3_600_000;
/** A meeting pause never outlasts this, whatever the calendar says. */
const MEETING_MAX_MS = 12 * HOUR;

type EvRow = {
  id: string;
  account_id: string;
  start_at: string;
  end_at: string;
  all_day: boolean | null;
  recurrence: CalendarRec;
  recurrence_until: string | null;
};

/** When the meeting the account is in right now ends (the latest, if two
 *  overlap), or null. Never throws: a failed read is "no meeting". */
export async function currentMeetingEnd(accountId: string, now: Date = new Date()): Promise<Date | null> {
  try {
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const today = nowIso.slice(0, 10);
    const { data: att } = await supabaseServer
      .from(ATTENDEES)
      .select("event_id")
      .eq("account_id", accountId)
      .neq("status", "declined")
      .limit(1000);
    const invited = [...new Set(((att ?? []) as Array<{ event_id: string }>).map((a) => a.event_id))];

    const cols = "id, account_id, start_at, end_at, all_day, recurrence, recurrence_until";
    /* A one-off happening now, or any live series (expanded below). */
    const live = () => supabaseServer
      .from(EVENTS)
      .select(cols)
      .or("all_day.is.null,all_day.eq.false")
      .or(`recurrence.not.is.null,and(start_at.lte.${nowIso},end_at.gt.${nowIso})`)
      .or(`recurrence_until.is.null,recurrence_until.gte.${today}`)
      .limit(300);
    const reads = [live().eq("account_id", accountId)];
    for (let i = 0; i < invited.length; i += 100) reads.push(live().in("id", invited.slice(i, i + 100)));
    const results = await Promise.all(reads);
    const events = new Map<string, EvRow>();
    for (const r of results) for (const e of (r.data ?? []) as unknown as EvRow[]) events.set(e.id, e);
    if (events.size === 0) return null;

    const series = [...events.values()].filter((e) => e.recurrence);
    const [tzOf, exceptions] = await Promise.all([
      accountTimezones(series.map((e) => e.account_id)),
      loadExceptions(series.map((e) => e.id)),
    ]);

    let end = 0;
    for (const e of events.values()) {
      if (!e.recurrence) {
        const s = Date.parse(e.start_at), f = Date.parse(e.end_at);
        if (s <= nowMs && f > nowMs) end = Math.max(end, f);
        continue;
      }
      const occ = expandWithExceptions(
        e.start_at, e.end_at, e.recurrence, e.recurrence_until,
        new Date(nowMs - 24 * HOUR), new Date(nowMs + 60_000),
        exceptions.get(e.id), 64, tzOf.get(e.account_id) ?? "UTC",
      );
      for (const o of occ) {
        if (o.start.getTime() <= nowMs && o.end.getTime() > nowMs) end = Math.max(end, o.end.getTime());
      }
    }
    return end > nowMs ? new Date(Math.min(end, nowMs + MEETING_MAX_MS)) : null;
  } catch (e) {
    console.error("[notification-pause] meeting:", e instanceof Error ? e.message : e);
    return null;
  }
}

export type PauseRequest = { until?: string | null; meeting?: boolean };
export type PauseResult =
  | { ok: true; until: string | null; meeting: boolean }
  | { ok: false; status: number; error: string };

/** Start (or end) the account's pause. The notifications slice is written
 *  whole, as Settings writes it — merged onto the stored one here. */
export async function setPause(accountId: string, req: PauseRequest, now: Date = new Date()): Promise<PauseResult> {
  const nowMs = now.getTime();
  let until: Date | null = null;
  let meeting = false;
  if (req.meeting) {
    const end = await currentMeetingEnd(accountId, now);
    meeting = !!end;
    until = end ?? new Date(nowMs + HOUR);
  } else if (typeof req.until === "string") {
    const ms = Date.parse(req.until);
    if (!Number.isFinite(ms) || ms <= nowMs + 60_000 || ms > nowMs + PAUSE_MAX_MS) {
      return { ok: false, status: 400, error: "until must be between one minute and seven days from now" };
    }
    until = new Date(ms);
  } else if (req.until !== null) {
    return { ok: false, status: 400, error: "until or meeting required" };
  }

  const { data, error } = await supabaseServer.from("accounts").select("preferences").eq("id", accountId).maybeSingle();
  if (error || !data) return { ok: false, status: 500, error: "Could not read preferences." };
  const stored = ((data as { preferences?: { notifications?: Record<string, unknown> } | null }).preferences?.notifications ?? {}) as Record<string, unknown>;
  const iso = until ? until.toISOString() : null;
  const merged = await mergeAccountPrefs(accountId, { notifications: { ...stored, pause_until: iso } });
  if (merged === null) return { ok: false, status: 500, error: "Could not save preferences." };
  return { ok: true, until: iso, meeting };
}
