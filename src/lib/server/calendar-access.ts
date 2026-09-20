import "server-only";

/* ---------------------------------------------------------------------------
   calendar-access — who may read or change an event, and what a client may
   write into one. Written once; the routes and the AI tools call it.

   The Calendar is a Type C (personal) module: an event belongs to ONE
   account. Its owner or a super admin may change it; its owner, a super
   admin or an invited attendee may read it. A role's Scope=All has
   deliberately no effect here.

   The tenant is part of every load, so a cross-tenant id reads as not-found
   and callers answer 404, never 403 — ids cannot be probed.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { CalendarEventType, CalendarRecurrence } from "@/types/supabase";
import { isCalendarEventType, isCalendarRecurrence } from "@/lib/calendar-enums";

export interface CalendarEventCore {
  id: string;
  account_id: string;
  tenant_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  event_type: CalendarEventType;
  is_private: boolean;
  reminder_minutes: number | null;
  recurrence: CalendarRecurrence;
  recurrence_until: string | null;
}

export interface CalendarActor {
  accountId: string;
  isSuperAdmin: boolean;
}

export const EVENT_CORE_COLUMNS =
  "id, account_id, tenant_id, title, description, location, start_at, end_at, all_day, event_type, is_private, reminder_minutes, recurrence, recurrence_until";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

/** One event, tenant-bounded. A non-uuid (the list mixes in virtual rows such
 *  as `todo:<id>`) is a not-found, not a Postgres error. */
export async function loadCalendarEvent(id: string, tenantId: string | null): Promise<CalendarEventCore | null> {
  if (!UUID_RE.test(id)) return null;
  let q = supabaseServer.from("koleex_calendar_events").select(EVENT_CORE_COLUMNS).eq("id", id);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  return (data as CalendarEventCore | null) ?? null;
}

export function isEventOwner(ev: Pick<CalendarEventCore, "account_id">, actor: CalendarActor): boolean {
  return actor.isSuperAdmin || ev.account_id === actor.accountId;
}

export async function isEventAttendee(eventId: string, accountId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("koleex_calendar_event_attendees")
    .select("id")
    .eq("event_id", eventId)
    .eq("account_id", accountId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Owner, super admin, or an invited attendee. */
export async function canReadEvent(ev: Pick<CalendarEventCore, "id" | "account_id">, actor: CalendarActor): Promise<boolean> {
  if (isEventOwner(ev, actor)) return true;
  return isEventAttendee(ev.id, actor.accountId);
}

/** The attendee account ids of an event; declined guests can be left out
 *  (a reminder is noise to someone who said no). */
export async function eventAttendeeIds(eventId: string, opts?: { excludeDeclined?: boolean }): Promise<string[]> {
  let q = supabaseServer.from("koleex_calendar_event_attendees").select("account_id").eq("event_id", eventId);
  if (opts?.excludeDeclined) q = q.neq("status", "declined");
  const { data } = await q;
  return ((data ?? []) as Array<{ account_id: string }>).map((a) => a.account_id);
}

/* ── Input sanitizing ─────────────────────────────────────────────────────
   The client used to be spread straight into the insert (`...body`), so it
   could set reminded_at, created_at or any column at all, and an unknown key
   or a bad enum surfaced as a 500. Only these keys are accepted, each in the
   shape the table's CHECKs allow. */

const WRITABLE_KEYS = [
  "title", "description", "location", "start_at", "end_at", "all_day",
  "event_type", "color", "is_private", "reminder_minutes", "recurrence", "recurrence_until",
] as const;

export type SanitizedEvent =
  | { ok: true; row: Record<string, unknown>; timeChanged: boolean }
  | { ok: false; error: string };

function optString(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

/** Validate a create/update body. `existing` supplies the untouched half of
 *  the time window on an update so the order check can still run. */
export function sanitizeEventInput(
  body: Record<string, unknown>,
  mode: "create" | "update",
  existing?: Pick<CalendarEventCore, "start_at" | "end_at">,
): SanitizedEvent {
  const row: Record<string, unknown> = {};
  for (const k of WRITABLE_KEYS) if (k in body) row[k] = body[k];

  if ("title" in row || mode === "create") {
    const title = typeof row.title === "string" ? row.title.trim().slice(0, 200) : "";
    if (!title) return { ok: false, error: "title is required" };
    row.title = title;
  }
  for (const k of ["description", "location"] as const) {
    if (k in row) {
      const v = optString(row[k], k === "description" ? 4000 : 300);
      if (v === undefined) return { ok: false, error: `${k} must be text` };
      row[k] = v;
    }
  }
  for (const k of ["start_at", "end_at"] as const) {
    if (k in row || mode === "create") {
      const ms = typeof row[k] === "string" ? Date.parse(row[k] as string) : NaN;
      if (!Number.isFinite(ms)) return { ok: false, error: `${k} must be an ISO datetime` };
      row[k] = new Date(ms).toISOString();
    }
  }
  const start = (row.start_at as string | undefined) ?? existing?.start_at;
  const end = (row.end_at as string | undefined) ?? existing?.end_at;
  if (start && end && Date.parse(end) < Date.parse(start)) {
    return { ok: false, error: "end_at must not be before start_at" };
  }
  for (const k of ["all_day", "is_private"] as const) {
    if (k in row && typeof row[k] !== "boolean") return { ok: false, error: `${k} must be a boolean` };
  }
  if ("event_type" in row && !isCalendarEventType(row.event_type)) {
    return { ok: false, error: "invalid event_type" };
  }
  if ("color" in row) {
    const v = optString(row.color, 32);
    if (v === undefined) return { ok: false, error: "color must be text" };
    row.color = v;
  }
  if ("reminder_minutes" in row) {
    const v = row.reminder_minutes;
    if (v !== null && !(Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10080)) {
      return { ok: false, error: "reminder_minutes must be a whole number of minutes (0..10080) or null" };
    }
  }
  if ("recurrence" in row) {
    const v = row.recurrence;
    if (v !== null && !isCalendarRecurrence(v)) return { ok: false, error: "invalid recurrence" };
    if (v === null) row.recurrence_until = null; /* a series that stops has no end date */
  }
  if ("recurrence_until" in row && row.recurrence_until !== null) {
    const v = row.recurrence_until;
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v))) {
      return { ok: false, error: "recurrence_until must be YYYY-MM-DD or null" };
    }
  }

  const timeChanged =
    (!!row.start_at && row.start_at !== existing?.start_at) ||
    (!!row.end_at && row.end_at !== existing?.end_at);
  /* A rescheduled event re-arms its reminder: the stamp the cron left for
     the old time must not silence the new one. */
  if (mode === "update" && timeChanged) row.reminded_at = null;

  return { ok: true, row, timeChanged };
}
