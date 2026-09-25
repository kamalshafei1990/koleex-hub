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

/** "20/09/2026 14:00–15:00", "20/09/2026 (all day)", or a two-day span. */
export function formatWhen(startISO: string, endISO: string | null | undefined, allDay: boolean | null | undefined, tz: string): string {
  const s = new Date(startISO);
  const e = endISO ? new Date(endISO) : null;
  const zone = safeTimeZone(tz) === tz ? tz : DEFAULT_TZ;
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "2-digit", month: "2-digit", year: "numeric" });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (allDay) {
    /* An all-day event is a run of dates in the organizer's zone. */
    const k = allDayKeys(startISO, endISO || startISO, zone);
    const dmy = (key: string) => key.split("-").reverse().join("/");
    return k.start === k.end ? `${dmy(k.start)} (all day)` : `${dmy(k.start)} → ${dmy(k.end)} (all day)`;
  }
  if (!e || Number.isNaN(e.getTime())) return `${day.format(s)} ${time.format(s)}`;
  const sameDay = day.format(s) === day.format(e);
  return sameDay
    ? `${day.format(s)} ${time.format(s)}–${time.format(e)}`
    : `${day.format(s)} ${time.format(s)} → ${day.format(e)} ${time.format(e)}`;
}

async function deliver(opts: {
  ev: EventLike;
  recipients: string[];
  actorId: string | null;
  type: string;
  subject: string;
  body: string;
  pushTitle?: string;
  tag?: string;
}): Promise<void> {
  const to = Array.from(new Set(opts.recipients.filter(Boolean))).filter((id) => id !== opts.actorId);
  if (to.length === 0) return;
  try {
    await supabaseServer.from("inbox_messages").insert(
      to.map((recipient_account_id) => ({
        recipient_account_id,
        sender_account_id: opts.actorId,
        tenant_id: opts.ev.tenant_id ?? null,
        category: "calendar",
        subject: opts.subject,
        body: opts.body,
        link: eventLink(opts.ev.id),
        metadata: { type: opts.type, event_id: opts.ev.id },
      })),
    );
    await emitPings(to.map((id) => ({ topic: rtTopic.inbox(id) })));
    await sendPushToAccounts(
      to,
      {
        title: opts.pushTitle ?? opts.subject,
        body: opts.body,
        url: eventLink(opts.ev.id),
        tag: opts.tag ?? `calendar-${opts.ev.id}`,
        kind: opts.type,
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
  const when = formatWhen(ev.start_at, ev.end_at, ev.all_day, await accountTimezone(ev.account_id));
  await deliver({
    ev, recipients, actorId,
    type: "calendar_invite",
    subject: `Invitation: ${ev.title ?? "Event"}`,
    body: `You are invited — ${when}${ev.location ? ` · ${ev.location}` : ""}. Open it to accept or decline.`,
    tag: `calendar-invite-${ev.id}`,
  });
}

/** The organizer moved, relocated or cancelled the event → every guest
 *  hears, once per event: an older unread notice about the same event is
 *  superseded. `rescheduled` = the time changed (the place may have too);
 *  `moved` = only the place changed.
 *
 *  The inbox and push have no per-recipient language yet, so these stay in
 *  English — the Hub's shared notification language. */
export async function notifyEventChanged(
  ev: EventLike,
  recipients: string[],
  actorId: string | null,
  kind: "rescheduled" | "moved" | "cancelled",
): Promise<void> {
  if (recipients.length === 0) return;
  const title = ev.title ?? "Event";
  const type = kind === "cancelled" ? "calendar_cancelled" : "calendar_rescheduled";
  await supersedeUnread({ recipients, meta: { event_id: ev.id } });
  if (kind === "cancelled") {
    await deliver({ ev, recipients, actorId, type, subject: `Cancelled: ${title}`, body: `"${title}" has been cancelled by the organizer.` });
    return;
  }
  const when = formatWhen(ev.start_at, ev.end_at, ev.all_day, await accountTimezone(ev.account_id));
  const where = ev.location ? ` · ${ev.location}` : "";
  if (kind === "moved") {
    await deliver({
      ev, recipients, actorId, type,
      subject: `New location: ${title}`,
      body: ev.location ? `"${title}" (${when}) is now at ${ev.location}.` : `"${title}" (${when}) no longer has a location.`,
    });
    return;
  }
  await deliver({ ev, recipients, actorId, type, subject: `Rescheduled: ${title}`, body: `"${title}" is now ${when}${where}.` });
}

/** A guest answered → the organizer hears. */
export async function notifyRsvp(ev: EventLike, responderId: string, responderName: string, status: CalendarAttendeeStatus): Promise<void> {
  if (status === "invited") return;
  const verb = status === "accepted" ? "accepted" : "declined";
  await deliver({
    ev, recipients: [ev.account_id], actorId: responderId,
    type: `calendar_rsvp_${verb}`,
    subject: `${responderName} ${verb}: ${ev.title ?? "Event"}`,
    body: `${responderName} ${verb} the invitation to "${ev.title ?? "Event"}".`,
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
