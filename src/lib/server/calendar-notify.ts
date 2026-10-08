import "server-only";

/* ---------------------------------------------------------------------------
   calendar-notify — every notification the Calendar sends, written once.

   Before this file the invite lived in the attendees route and the reminder
   in the cron, each with its own inbox insert: no tenant_id, no realtime
   ping, a `/calendar` link that opened the month with nothing selected, and
   a time rendered with toLocaleString() in the FUNCTION's locale and zone
   (a UTC "9/20/2026, 1:00:00 PM"). A rescheduled or cancelled meeting told
   nobody, and a guest had no way to answer.

   One delivery path: inbox row with tenant_id → ping the recipient's inbox
   topic → web push with a `kind` the Settings switches recognise. Times are
   written D/M/Y in the ORGANIZER's calendar timezone (the one the event was
   made in); the link opens the event itself.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { clearUnreadByMeta, supersedeUnread } from "@/lib/server/inbox-lifecycle";
import { prepareTpl, type NotifTpl } from "@/lib/notification-templates";
import type { CalendarAttendeeStatus } from "@/lib/calendar-enums";
import { allDayKeys, safeTimeZone } from "@/lib/calendar-tz";

type EventLike = {
  id: string;
  tenant_id?: string | null;
  account_id: string;
  title: string | null;
  start_at: string;
  end_at?: string | null;
  all_day?: boolean | null;
  location?: string | null;
  meeting_url?: string | null;
};

const DEFAULT_TZ = "Asia/Dubai";

export const eventLink = (id: string) => `/calendar?event=${id}`;

type PrefsRow = { id?: string; preferences?: { calendar?: { timezone?: unknown } } | null };
const tzOf = (row: PrefsRow | null | undefined): string => {
  const tz = row?.preferences?.calendar?.timezone;
  return typeof tz === "string" && tz && safeTimeZone(tz) === tz ? tz : DEFAULT_TZ;
};

/** The organizer's calendar timezone (Settings → Calendar), or the Hub's. */
export async function accountTimezone(accountId: string): Promise<string> {
  const { data } = await supabaseServer.from("accounts").select("preferences").eq("id", accountId).maybeSingle();
  return tzOf(data as PrefsRow | null);
}

/** Several accounts' calendar timezones in one round trip. Every id asked
 *  for is in the answer (the Hub's zone when the account has none). */
export async function accountTimezones(accountIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(accountIds.filter(Boolean)));
  const out = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabaseServer.from("accounts").select("id, preferences").in("id", ids);
    for (const row of (data ?? []) as PrefsRow[]) if (row.id) out.set(row.id, tzOf(row));
  }
  for (const id of ids) if (!out.has(id)) out.set(id, DEFAULT_TZ);
  return out;
}

/** formatWhen in two parts, for a template: the dates/times, and
 *  `allDay: "all_day"` for an all-day event — its "(all day)" is the
 *  reader's own word (enum.calendarSpan), not a fixed English suffix. */
export function whenParts(
  startISO: string, endISO: string | null | undefined, allDay: boolean | null | undefined, tz: string,
): { when: string; allDay: "all_day" | null } {
  const s = new Date(startISO);
  const e = endISO ? new Date(endISO) : null;
  const zone = safeTimeZone(tz) === tz ? tz : DEFAULT_TZ;
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "2-digit", month: "2-digit", year: "numeric" });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (allDay) {
    /* An all-day event is a run of dates in the organizer's zone. */
    const k = allDayKeys(startISO, endISO || startISO, zone);
    const dmy = (key: string) => key.split("-").reverse().join("/");
    return { when: k.start === k.end ? dmy(k.start) : `${dmy(k.start)} → ${dmy(k.end)}`, allDay: "all_day" };
  }
  if (!e || Number.isNaN(e.getTime())) return { when: `${day.format(s)} ${time.format(s)}`, allDay: null };
  const sameDay = day.format(s) === day.format(e);
  return {
    when: sameDay
      ? `${day.format(s)} ${time.format(s)}–${time.format(e)}`
      : `${day.format(s)} ${time.format(s)} → ${day.format(e)} ${time.format(e)}`,
    allDay: null,
  };
}

/** "20/09/2026 14:00–15:00", "20/09/2026 (all day)", or a two-day span. */
export function formatWhen(startISO: string, endISO: string | null | undefined, allDay: boolean | null | undefined, tz: string): string {
  const w = whenParts(startISO, endISO, allDay, tz);
  return w.allDay ? `${w.when} (all day)` : w.when;
}

async function deliver(opts: {
  ev: EventLike;
  recipients: string[];
  actorId: string | null;
  type: string;
  /** What was said — rendered in each reader's language (notification-templates). */
  tpl: NotifTpl;
  pushTitle?: string;
  tag?: string;
}): Promise<void> {
  const to = Array.from(new Set(opts.recipients.filter(Boolean))).filter((id) => id !== opts.actorId);
  if (to.length === 0) return;
  const text = prepareTpl(opts.tpl);
  const body = text.body ?? "";
  try {
    await supabaseServer.from("inbox_messages").insert(
      to.map((recipient_account_id) => ({
        recipient_account_id,
        sender_account_id: opts.actorId,
        tenant_id: opts.ev.tenant_id ?? null,
        category: "calendar",
        subject: text.subject,
        body,
        link: eventLink(opts.ev.id),
        metadata: { type: opts.type, event_id: opts.ev.id, ...(text.tpl ? { tpl: text.tpl } : {}) },
      })),
    );
    await emitPings(to.map((id) => ({ topic: rtTopic.inbox(id) })));
    await sendPushToAccounts(
      to,
      {
        title: opts.pushTitle ?? text.subject,
        body,
        url: eventLink(opts.ev.id),
        tag: opts.tag ?? `calendar-${opts.ev.id}`,
        kind: opts.type,
        tpl: text.tpl,
      },
      { actorAccountId: opts.actorId },
    );
  } catch (e) {
    console.error(`[calendar-notify] ${opts.type}:`, e instanceof Error ? e.message : e);
  }
}

/** "Invitation: …" to newly added guests. */
export async function notifyInvited(ev: EventLike, recipients: string[], actorId: string | null): Promise<void> {
  if (recipients.length === 0) return;
  const w = whenParts(ev.start_at, ev.end_at, ev.all_day, await accountTimezone(ev.account_id));
  await deliver({
    ev, recipients, actorId,
    type: "calendar_invite",
    tpl: {
      k: "calendar_invite",
      p: { title: ev.title ?? "Event", when: w.when, allDay: w.allDay, where: ev.location || null, url: ev.meeting_url || null },
    },
    tag: `calendar-invite-${ev.id}`,
  });
}

/** The organizer moved, relocated, re-linked or cancelled the event →
 *  every guest hears, once per event: an older unread notice about the same
 *  event is superseded. `rescheduled` = the time changed (the place or link
 *  may have too); `moved` = only the place changed; `link` = only the
 *  meeting link changed.
 *
 *  `occurrence` (the ORIGINAL start of one occurrence of a series) says the
 *  change is to that occurrence only — `ev` then carries its new time — and
 *  the notice says the rest of the series stays as it was (the `.occurrence`
 *  templates: its date, and "the rest of the series is unchanged").
 *
 *  Stored in English and rendered in each reader's language from the
 *  template; the push stays English. */
export async function notifyEventChanged(
  ev: EventLike,
  recipients: string[],
  actorId: string | null,
  kind: "rescheduled" | "moved" | "link" | "cancelled",
  opts: { occurrence?: string } = {},
): Promise<void> {
  if (recipients.length === 0) return;
  const title = ev.title ?? "Event";
  const type = kind === "cancelled" ? "calendar_cancelled" : "calendar_rescheduled";
  const tz = await accountTimezone(ev.account_id);
  await supersedeUnread({ recipients, meta: { event_id: ev.id } });
  /* One occurrence of a series: its date (D/M/Y) picks the `.occurrence` template. */
  const day = opts.occurrence ? formatWhen(opts.occurrence, null, ev.all_day, tz).split(" ")[0] : null;
  if (kind === "cancelled") {
    await deliver({
      ev, recipients, actorId, type,
      tpl: day ? { k: "calendar_cancelled.occurrence", p: { title, day } } : { k: "calendar_cancelled", p: { title } },
    });
    return;
  }
  const w = whenParts(ev.start_at, ev.end_at, ev.all_day, tz);
  const p = { title, day, when: w.when, allDay: w.allDay, where: ev.location || null, url: ev.meeting_url || null };
  if (kind === "link") {
    await deliver({
      ev, recipients, actorId, type,
      tpl: ev.meeting_url
        ? day ? { k: "calendar_rescheduled.link.occurrence", p } : { k: "calendar_rescheduled.link", p }
        : day ? { k: "calendar_rescheduled.link_removed.occurrence", p } : { k: "calendar_rescheduled.link_removed", p },
    });
    return;
  }
  if (kind === "moved") {
    await deliver({
      ev, recipients, actorId, type,
      tpl: ev.location
        ? day ? { k: "calendar_rescheduled.location.occurrence", p } : { k: "calendar_rescheduled.location", p }
        : day ? { k: "calendar_rescheduled.location_removed.occurrence", p } : { k: "calendar_rescheduled.location_removed", p },
    });
    return;
  }
  await deliver({
    ev, recipients, actorId, type,
    tpl: day ? { k: "calendar_rescheduled.occurrence", p } : { k: "calendar_rescheduled", p },
  });
}

/* One template per answer, so each key is written out (not built from the verb). */
const RSVP_TPL = {
  accepted: { k: "calendar_rsvp_accepted" },
  declined: { k: "calendar_rsvp_declined" },
} as const;

/** A guest answered → the organizer hears. */
export async function notifyRsvp(ev: EventLike, responderId: string, responderName: string, status: CalendarAttendeeStatus): Promise<void> {
  if (status === "invited") return;
  const verb = status === "accepted" ? "accepted" : "declined";
  await deliver({
    ev, recipients: [ev.account_id], actorId: responderId,
    type: `calendar_rsvp_${verb}`,
    tpl: { k: RSVP_TPL[verb].k, p: { actor: responderName, title: ev.title ?? "Event" } },
    tag: `calendar-rsvp-${ev.id}-${responderId}`,
  });
}

/** Guests removed from the list: their unread invite is no longer true. */
export async function withdrawInvites(eventId: string, recipients: string[]): Promise<void> {
  if (recipients.length === 0) return;
  await supersedeUnread({ recipients, meta: { event_id: eventId } });
}

/** The event is gone — every unread notification about it is finished
 *  business (invites, reminders, RSVPs), for every recipient. */
export async function clearEventNotifications(eventId: string): Promise<void> {
  await clearUnreadByMeta({ event_id: eventId });
}
