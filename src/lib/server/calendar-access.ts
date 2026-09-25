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
  color: string | null;
  /** Absent until the 2026-09-26 migration adds the column. */
  meeting_url?: string | null;
}

export interface CalendarActor {
  accountId: string;
  isSuperAdmin: boolean;
}

const EVENT_CORE_COLUMNS =
  "id, account_id, tenant_id, title, description, location, start_at, end_at, all_day, event_type, is_private, reminder_minutes, recurrence, recurrence_until, color";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

/** A PostgREST error that says a column (or table) this code expects is not
 *  there yet — the 2026-09-26 migration has not run. */
export function isMissingSchema(error: { message?: string; code?: string } | null | undefined, name: string): boolean {
  if (!error) return false;
  const m = error.message ?? "";
  return m.includes(name) && /does not exist|could not find|schema cache/i.test(m);
}

/** One event, tenant-bounded. A non-uuid (the list mixes in virtual rows such
 *  as `todo:<id>`) is a not-found, not a Postgres error. The meeting link is
 *  read when the column exists. */
export async function loadCalendarEvent(id: string, tenantId: string | null): Promise<CalendarEventCore | null> {
  if (!UUID_RE.test(id)) return null;
  const run = (cols: string) => {
    let q = supabaseServer.from("koleex_calendar_events").select(cols).eq("id", id);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    return q.maybeSingle();
  };
  let { data, error } = await run(`${EVENT_CORE_COLUMNS}, meeting_url`);
  if (isMissingSchema(error, "meeting_url")) ({ data, error } = await run(EVENT_CORE_COLUMNS));
  return (data as unknown as CalendarEventCore | null) ?? null;
}

/** Insert / update an event row. Before the migration adds meeting_url the
 *  write is retried without it, so the rest of the event still saves. */
export async function insertEventRow(row: Record<string, unknown>) {
  const run = (r: Record<string, unknown>) => supabaseServer.from("koleex_calendar_events").insert(r).select("*").maybeSingle();
  let res = await run(row);
  if ("meeting_url" in row && isMissingSchema(res.error, "meeting_url")) {
    const { meeting_url: _m, ...rest } = row;
    void _m;
    res = await run(rest);
  }
  return res;
}

export async function updateEventRow(id: string, row: Record<string, unknown>) {
  const run = (r: Record<string, unknown>) => supabaseServer.from("koleex_calendar_events").update(r).eq("id", id).select("*").maybeSingle();
  let res = await run(row);
  if ("meeting_url" in row && isMissingSchema(res.error, "meeting_url")) {
    const { meeting_url: _m, ...rest } = row;
    void _m;
    res = Object.keys(rest).length ? await run(rest) : await supabaseServer.from("koleex_calendar_events").select("*").eq("id", id).maybeSingle();
  }
  return res;
}

export function isEventOwner(ev: Pick<CalendarEventCore, "account_id">, actor: CalendarActor): boolean {
  return actor.isSuperAdmin || ev.account_id === actor.accountId;
}

async function isEventAttendee(eventId: string, accountId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("koleex_calendar_event_attendees")
    .select("id")
    .eq("event_id", eventId)
    .eq("account_id", accountId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Who is reading, as far as the private-record rule cares. */
export interface CalendarReader {
  account_id: string;
  role_id: string | null;
  is_super_admin: boolean;
  can_view_private: boolean;
}

/** Break-glass: a private record read on someone else's calendar is logged.
 *  Fire-and-forget — the log must never fail the read. */
export function logPrivateCalendarReads(reader: CalendarReader, eventIds: string[]): void {
  if (eventIds.length === 0) return;
  void supabaseServer.from("koleex_private_access_log").insert(
    eventIds.map((id) => ({
      account_id: reader.account_id,
      role_id: reader.role_id,
      module_name: "Calendar",
      record_type: "koleex_calendar_events",
      record_id: id,
      access_reason: null,
    })),
  ).then(({ error }) => { if (error) console.error("[calendar-access] private log:", error.message); });
}

/** The same rule as the calendar list: the owner and an invited guest read
 *  the event; a super admin reads someone else's event unless it is private,
 *  and a private one only with can_view_private (break-glass, logged). */
export async function canReadEvent(ev: Pick<CalendarEventCore, "id" | "account_id" | "is_private">, reader: CalendarReader): Promise<boolean> {
  if (ev.account_id === reader.account_id) return true;
  if (await isEventAttendee(ev.id, reader.account_id)) return true;
  if (!reader.is_super_admin) return false;
  if (!ev.is_private) return true;
  if (!reader.can_view_private) return false;
  logPrivateCalendarReads(reader, [ev.id]);
  return true;
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
  "meeting_url",
] as const;

export type SanitizedEvent =
  | { ok: true; row: Record<string, unknown>; timeChanged: boolean; locationChanged: boolean; meetingUrlChanged: boolean; seriesChanged: boolean }
  | { ok: false; error: string };

/** A meeting link: https only, at most 500 characters. `undefined` = not a
 *  usable link (the caller answers 400); null = cleared. */
export function cleanMeetingUrl(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return null;
  if (s.length > 500) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || !u.hostname) return undefined;
    return u.toString().length <= 500 ? s : undefined;
  } catch {
    return undefined;
  }
}

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
  existing?: Pick<CalendarEventCore, "start_at" | "end_at"> & Partial<Pick<CalendarEventCore, "color" | "location" | "meeting_url" | "recurrence" | "recurrence_until">>,
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
    /* #RRGGBB only — the views append an alpha pair to it. A colour stored
       before this rule is kept when an edit sends it back unchanged. */
    if (v !== null && !/^#[0-9a-fA-F]{6}$/.test(v) && v !== existing?.color) {
      return { ok: false, error: "color must be #RRGGBB" };
    }
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

  if ("meeting_url" in row) {
    const v = cleanMeetingUrl(row.meeting_url);
    if (v === undefined) return { ok: false, error: "meeting_url must be an https link (max 500 characters)" };
    row.meeting_url = v;
  }

  const timeChanged =
    (!!row.start_at && row.start_at !== existing?.start_at) ||
    (!!row.end_at && row.end_at !== existing?.end_at);
  /* A rescheduled event re-arms its reminder: the stamp the cron left for
     the old time must not silence the new one. */
  if (mode === "update" && timeChanged) row.reminded_at = null;
  const locationChanged = mode === "update" && "location" in row && (row.location ?? null) !== (existing?.location ?? null);
  const meetingUrlChanged = mode === "update" && "meeting_url" in row && (row.meeting_url ?? null) !== (existing?.meeting_url ?? null);
  /* The occurrences of a series move when its start or its rule changes:
     "this occurrence only" changes keyed on the old times no longer apply. */
  const seriesChanged = mode === "update" && (
    (!!row.start_at && row.start_at !== existing?.start_at) ||
    ("recurrence" in row && (row.recurrence ?? null) !== (existing?.recurrence ?? null))
  );

  return { ok: true, row, timeChanged, locationChanged, meetingUrlChanged, seriesChanged };
}

/** A search term made safe for an ILIKE inside a PostgREST `.or()`: the LIKE
 *  metacharacters match literally, and `,` `(` `)` `"` — which would split
 *  or re-shape the expression — become the single-char wildcard. */
export function orLikeTerm(raw: string): string {
  const escaped = raw.replace(/[%_\\]/g, "\\$&").replace(/[,()"]/g, "_");
  return `%${escaped}%`;
}
