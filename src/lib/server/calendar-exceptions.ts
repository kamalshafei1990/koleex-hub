import "server-only";

/* ---------------------------------------------------------------------------
   calendar-exceptions — "this occurrence only" changes to a recurring event
   (koleex_calendar_event_exceptions, 2026-09-26 migration). Read by the feed,
   the search, the free/busy view and the reminder cron; written by
   /api/calendar/events/[id]/occurrences and the drag-to-reschedule path.

   Before the migration runs every read answers "no exceptions" and a write
   answers `unavailable`, so the rest of the Calendar keeps working.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { isMissingSchema } from "@/lib/server/calendar-access";
import type { CalendarEventException } from "@/lib/calendar-types";

const TABLE = "koleex_calendar_event_exceptions";
const COLS = "event_id, occurrence_start, kind, title, start_at, end_at, location, meeting_url";

/** The exceptions of these series, by series id. Never throws. */
export async function loadExceptions(eventIds: string[]): Promise<Map<string, CalendarEventException[]>> {
  const out = new Map<string, CalendarEventException[]>();
  const ids = Array.from(new Set(eventIds.filter(Boolean)));
  if (ids.length === 0) return out;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabaseServer.from(TABLE).select(COLS).in("event_id", ids.slice(i, i + 200));
    if (error) {
      if (!isMissingSchema(error, TABLE)) console.error("[calendar-exceptions] load:", error.message);
      return out;
    }
    for (const row of (data ?? []) as CalendarEventException[]) {
      /* Normalise the key to the ISO the recurrence math produces. */
      const ms = Date.parse(row.occurrence_start);
      if (!Number.isFinite(ms)) continue;
      const list = out.get(row.event_id) ?? [];
      list.push({ ...row, occurrence_start: new Date(ms).toISOString() });
      out.set(row.event_id, list);
    }
  }
  return out;
}

export type ExceptionWrite =
  | { ok: true }
  | { ok: false; unavailable: boolean };

/** Create or replace the exception of one occurrence. An override merges
 *  with an earlier override of the same occurrence. */
export async function saveException(row: CalendarEventException & { tenant_id: string | null }): Promise<ExceptionWrite> {
  const occurrence_start = new Date(Date.parse(row.occurrence_start)).toISOString();
  const { error } = await supabaseServer.from(TABLE).upsert(
    {
      event_id: row.event_id,
      tenant_id: row.tenant_id,
      occurrence_start,
      kind: row.kind,
      title: row.kind === "override" ? row.title ?? null : null,
      start_at: row.kind === "override" ? row.start_at ?? null : null,
      end_at: row.kind === "override" ? row.end_at ?? null : null,
      location: row.kind === "override" ? row.location ?? null : null,
      meeting_url: row.kind === "override" ? row.meeting_url ?? null : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,occurrence_start" },
  );
  if (!error) return { ok: true };
  const unavailable = isMissingSchema(error, TABLE);
  if (!unavailable) console.error("[calendar-exceptions] save:", error.message);
  return { ok: false, unavailable };
}

/** Every exception of a series — its occurrences moved, so the old keys no
 *  longer name anything. Never throws. */
export async function clearExceptions(eventId: string): Promise<void> {
  const { error } = await supabaseServer.from(TABLE).delete().eq("event_id", eventId);
  if (error && !isMissingSchema(error, TABLE)) console.error("[calendar-exceptions] clear:", error.message);
}
