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
import type { CalendarFeedEvent } from "@/lib/calendar-types";

export interface CalendarAttendee {
  account_id: string;
  status: CalendarAttendeeStatus;
  /** null when the account has no name — the screen words the fallback. */
  name: string | null;
}

/** A single event as GET /api/calendar/events/[id] returns it. */
export type CalendarEventDetail = CalendarEventRow & { invited?: boolean; start_date?: string; end_date?: string };

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

export async function createEvent(input: CalendarEventInsert): Promise<CalendarEventRow | null> {
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

export async function updateEvent(id: string, patch: CalendarEventUpdate): Promise<CalendarEventRow | null> {
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
