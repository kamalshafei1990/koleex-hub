/* ---------------------------------------------------------------------------
   Calendar events — the browser's client for /api/calendar/events.

   THE BROWSER DOES NOT TOUCH THE DATABASE HERE. Every function calls the
   API. Reads that a screen must be able to tell apart from "nothing there"
   (the window, the guest list) say whether they worked; the rest return the
   empty answer on failure. Scope, tenant and the private-record rules are
   applied by the route from the session.
   --------------------------------------------------------------------------- */

import type {
  CalendarAttendeeStatus,
  CalendarEventRow,
  CalendarEventInsert,
  CalendarEventUpdate,
} from "@/types/supabase";
import type { BusyBlock, CalendarFeedEvent, CalendarSearchHit } from "@/lib/calendar-types";

export interface CalendarAttendee {
  account_id: string;
  status: CalendarAttendeeStatus;
  /** null when the account has no name — the screen words the fallback. */
  name: string | null;
}

/** A single event as GET /api/calendar/events/[id] returns it. */
export type CalendarEventDetail = CalendarEventRow & { invited?: boolean; start_date?: string; end_date?: string; meeting_url?: string | null };

/** What the editor writes: the row plus the meeting link. */
export type CalendarEventWrite = CalendarEventInsert & { meeting_url?: string | null };

function logUnlessDenied(what: string, status: number, quiet: number[] = [401, 403]) {
  if (!quiet.includes(status)) console.error(`[Calendar] ${what}:`, status);
}

/** Events for an account within [rangeStart, rangeEnd) — its own, the
 *  occurrences of its series, the events it is invited to, and the mirrors.
 *  `ok: false` is a failed load, never an empty month. */
export async function fetchEventsInRange(
  accountId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{ ok: boolean; events: CalendarFeedEvent[] }> {
  const params = new URLSearchParams({
    accountId,
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
  });
  try {
    const res = await fetch("/api/calendar/events?" + params.toString(), { credentials: "include" });
    if (!res.ok) { logUnlessDenied("fetchEventsInRange", res.status); return { ok: false, events: [] }; }
    const json = (await res.json()) as { events?: CalendarFeedEvent[] };
    return { ok: true, events: json.events ?? [] };
  } catch (e) {
    console.error("[Calendar] fetchEventsInRange failed:", e);
    return { ok: false, events: [] };
  }
}

/** One real event by id; `invited` is set when the caller is a guest. */
export async function fetchEventById(id: string): Promise<CalendarEventDetail | null> {
  try {
    const res = await fetch("/api/calendar/events/" + id, { credentials: "include" });
    if (!res.ok) { logUnlessDenied("fetchEventById", res.status, [401, 403, 404]); return null; }
    const json = (await res.json()) as { event: CalendarEventDetail | null };
    return json.event;
  } catch (e) {
    console.error("[Calendar] fetchEventById failed:", e);
    return null;
  }
}

/* ── Mutations ── */

export async function createEvent(input: CalendarEventWrite): Promise<CalendarEventRow | null> {
  try {
    const res = await fetch("/api/calendar/events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) return ((await res.json()) as { event: CalendarEventRow | null }).event;
    logUnlessDenied("createEvent", res.status);
    return null;
  } catch (e) {
    console.error("[Calendar] createEvent failed:", e);
    return null;
  }
}

export async function updateEvent(id: string, patch: CalendarEventUpdate & { meeting_url?: string | null }): Promise<CalendarEventRow | null> {
  try {
    const res = await fetch("/api/calendar/events/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) return ((await res.json()) as { event: CalendarEventRow | null }).event;
    logUnlessDenied("updateEvent", res.status, [401, 403, 404]);
    return null;
  } catch (e) {
    console.error("[Calendar] updateEvent failed:", e);
    return null;
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/calendar/events/" + id, { method: "DELETE", credentials: "include" });
    if (res.ok) return true;
    logUnlessDenied("deleteEvent", res.status, [401, 403, 404]);
    return false;
  } catch (e) {
    console.error("[Calendar] deleteEvent failed:", e);
    return false;
  }
}

/* ── Guests ── */

/** The guest list, or null when it could not be read — a caller must not
 *  mistake a failed read for "no guests" and save that back. */
export async function fetchAttendees(eventId: string): Promise<CalendarAttendee[] | null> {
  try {
    const res = await fetch(`/api/calendar/events/${eventId}/attendees`, { credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as { attendees?: CalendarAttendee[] };
    return json.attendees ?? [];
  } catch {
    return null;
  }
}

/** Replace the guest list. The organizer is stripped server-side; the newly
 *  added are invited, the removed have their invitation withdrawn. */
export async function saveAttendees(eventId: string, accountIds: string[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/calendar/events/${eventId}/attendees`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountIds }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Answer my own invitation. */
export async function respondToInvite(eventId: string, status: "accepted" | "declined"): Promise<boolean> {
  try {
    const res = await fetch(`/api/calendar/events/${eventId}/attendees`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── One occurrence of a series ── */

export interface OccurrenceChange {
  title?: string;
  start_at?: string;
  end_at?: string;
  location?: string | null;
  meeting_url?: string | null;
}

/** Change or delete ONE occurrence of a recurring event ("This event").
 *  `occurrenceStart` is the occurrence's ORIGINAL start (the feed's
 *  occurrence_start). `unavailable` = the server cannot store single
 *  occurrences yet (migration not applied). */
export async function changeOccurrence(
  eventId: string,
  occurrenceStart: string,
  change: { action: "skip" } | ({ action: "override" } & OccurrenceChange),
): Promise<{ ok: boolean; unavailable?: boolean }> {
  try {
    const res = await fetch(`/api/calendar/events/${eventId}/occurrences`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occurrence_start: occurrenceStart, ...change }),
    });
    if (res.ok) return { ok: true };
    logUnlessDenied("changeOccurrence", res.status, [401, 403, 404, 503]);
    return { ok: false, unavailable: res.status === 503 };
  } catch (e) {
    console.error("[Calendar] changeOccurrence failed:", e);
    return { ok: false };
  }
}

/* ── Free/busy and search ── */

/** Busy intervals of colleagues in [from, to) — never event details beyond
 *  a title the caller may already read. null = the read failed. */
export async function fetchFreeBusy(accountIds: string[], from: Date, to: Date, signal?: AbortSignal): Promise<Record<string, BusyBlock[]> | null> {
  if (accountIds.length === 0) return {};
  const params = new URLSearchParams({ accounts: accountIds.join(","), from: from.toISOString(), to: to.toISOString() });
  try {
    const res = await fetch("/api/calendar/freebusy?" + params.toString(), { credentials: "include", signal });
    if (!res.ok) return null;
    return ((await res.json()) as { busy?: Record<string, BusyBlock[]> }).busy ?? {};
  } catch {
    return null;
  }
}

/** The viewer's own and invited events matching `q`, ±3 months. null = failed. */
export async function searchEvents(q: string, signal?: AbortSignal): Promise<CalendarSearchHit[] | null> {
  try {
    const res = await fetch("/api/calendar/search?q=" + encodeURIComponent(q), { credentials: "include", signal });
    if (!res.ok) return null;
    return ((await res.json()) as { hits?: CalendarSearchHit[] }).hits ?? [];
  } catch (e) {
    if ((e as { name?: string })?.name !== "AbortError") console.error("[Calendar] searchEvents failed:", e);
    return null;
  }
}
