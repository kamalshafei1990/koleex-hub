/* ---------------------------------------------------------------------------
   Calendar events — the browser's client for /api/calendar/events.

   Backs the self-contained Koleex Calendar app. No external sync; every
   event belongs to an account and is rendered in that account's preferred
   timezone.

   THE BROWSER DOES NOT TOUCH THE DATABASE HERE. Every function calls the API
   and returns the empty answer on failure. Until 2026-08-09 each one called
   the API and then, on any non-401/403 outcome, FELL BACK to querying
   Supabase directly with the anon key — re-implementing the permission rules
   in the browser as it went. That was worse than slow:

     · a 500 from the API silently downgraded the caller to the browser path,
       so the weakest code ran exactly when something was already wrong;
     · the Type C rule (only a Super Admin may read another account's
       calendar) was enforced twice, in two languages, and only the server
       copy is authoritative;
     · every read was a direct cross-border round trip from the browser to
       ap-northeast-1, where the same query from the function costs ~56 ms.

   `fetchAllEventsForAccount` went with it — nothing called it.
   --------------------------------------------------------------------------- */

import type {
  CalendarEventRow,
  CalendarEventInsert,
  CalendarEventUpdate,
} from "@/types/supabase";

/* ============================================================================
   Fetch
   ============================================================================ */

/**
 * Fetch all events for an account within the [rangeStart, rangeEnd) window.
 *
 * Uses overlap semantics: event.start_at < rangeEnd AND event.end_at >= rangeStart.
 * That way an event that started yesterday and ends today is still visible
 * in today's view.
 *
 * Scope, tenant and the private-record rules are applied by the route from the
 * session. The old `ctx` parameter is gone: the browser handing the server a
 * ScopeContext it assembled itself is a suggestion, not a rule, and the route
 * ignored it anyway.
 */
export async function fetchEventsInRange(
  accountId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEventRow[]> {
  const params = new URLSearchParams({
    accountId,
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
  });
  try {
    const res = await fetch("/api/calendar/events?" + params.toString(), {
      credentials: "include",
    });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) {
        console.error("[Calendar] fetchEventsInRange:", res.status);
      }
      return [];
    }
    const json = (await res.json()) as { events: CalendarEventRow[] };
    return json.events;
  } catch (e) {
    console.error("[Calendar] fetchEventsInRange failed:", e);
    return [];
  }
}

export async function fetchEventById(id: string): Promise<CalendarEventRow | null> {
  try {
    const res = await fetch("/api/calendar/events/" + id, { credentials: "include" });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
        console.error("[Calendar] fetchEventById:", res.status);
      }
      return null;
    }
    const json = (await res.json()) as { event: CalendarEventRow | null };
    return json.event;
  } catch (e) {
    console.error("[Calendar] fetchEventById failed:", e);
    return null;
  }
}

/* ============================================================================
   Mutations
   ============================================================================ */

export async function createEvent(
  input: CalendarEventInsert,
): Promise<CalendarEventRow | null> {
  try {
    const res = await fetch("/api/calendar/events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = (await res.json()) as { event: CalendarEventRow | null };
      return json.event;
    }
    if (res.status !== 401 && res.status !== 403) {
      console.error("[Calendar] createEvent:", res.status);
    }
    return null;
  } catch (e) {
    console.error("[Calendar] createEvent failed:", e);
    return null;
  }
}

export async function updateEvent(
  id: string,
  patch: CalendarEventUpdate,
): Promise<CalendarEventRow | null> {
  try {
    const res = await fetch("/api/calendar/events/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const json = (await res.json()) as { event: CalendarEventRow | null };
      return json.event;
    }
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
      console.error("[Calendar] updateEvent:", res.status);
    }
    return null;
  } catch (e) {
    console.error("[Calendar] updateEvent failed:", e);
    return null;
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/calendar/events/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) {
      console.error("[Calendar] deleteEvent:", res.status);
    }
    return false;
  } catch (e) {
    console.error("[Calendar] deleteEvent failed:", e);
    return false;
  }
}
