import "server-only";

/* ---------------------------------------------------------------------------
   calendar-exceptions — "this occurrence only" changes to a recurring event
   (koleex_calendar_event_exceptions, 2026-09-26 migration). Read by the feed,
   the search, the free/busy view and the reminder cron; written by
   /api/calendar/events/[id]/occurrences and the drag-to-reschedule path.

   Before the migration runs every read answers "no exceptions" and a write
   answers `unavailable`, so the rest of the Calendar keeps working.

   The 2026-09-27 migration adds a per-occurrence `description` and lets
   `meeting_url` be '' ("no link for this occurrence"; NULL = as the series).
   Before it runs, the reads skip `description` and a write that needs either
   is retried without it and answers `degraded` — the rest of the change is
   kept.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { isMissingSchema } from "@/lib/server/calendar-access";
import type { CalendarEventException } from "@/lib/calendar-types";

const TABLE = "koleex_calendar_event_exceptions";
const COLS = "event_id, occurrence_start, kind, title, start_at, end_at, location, meeting_url";
const COLS_V2 = `${COLS}, description`;

/** A CHECK violation on the 2026-09-26 meeting_url rule (it refused ''). */
function isLinkCheck(error: { message?: string; code?: string } | null | undefined): boolean {
  return !!error && (error.code === "23514" || /check constraint/i.test(error.message ?? "")) && /meeting_url/i.test(error.message ?? "");
}

/** The exceptions of these series, by series id. Never throws. */
export async function loadExceptions(eventIds: string[]): Promise<Map<string, CalendarEventException[]>> {
  const out = new Map<string, CalendarEventException[]>();
  const ids = Array.from(new Set(eventIds.filter(Boolean)));
  if (ids.length === 0) return out;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const run = (cols: string) => supabaseServer.from(TABLE).select(cols).in("event_id", chunk);
    let { data, error } = await run(COLS_V2);
    if (isMissingSchema(error, "description")) ({ data, error } = await run(COLS));
    if (error) {
      if (!isMissingSchema(error, TABLE)) console.error("[calendar-exceptions] load:", error.message);
      return out;
    }
    for (const row of (data ?? []) as unknown as CalendarEventException[]) {
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
  /** degraded: saved, but without a cleared link or the notes (the
   *  2026-09-27 migration has not run). */
  | { ok: true; degraded?: boolean }
  | { ok: false; unavailable: boolean };

/** Create or replace the exception of one occurrence. An override merges
 *  with an earlier override of the same occurrence. */
export async function saveException(row: CalendarEventException & { tenant_id: string | null }): Promise<ExceptionWrite> {
  const occurrence_start = new Date(Date.parse(row.occurrence_start)).toISOString();
  const override = row.kind === "override";
  const record: Record<string, unknown> = {
    event_id: row.event_id,
    tenant_id: row.tenant_id,
    occurrence_start,
    kind: row.kind,
    title: override ? row.title ?? null : null,
    start_at: override ? row.start_at ?? null : null,
    end_at: override ? row.end_at ?? null : null,
    location: override ? row.location ?? null : null,
    meeting_url: override ? row.meeting_url ?? null : null,
    updated_at: new Date().toISOString(),
  };
  /* Written every time (NULL = as the series), so an occurrence whose notes
     went back to the series' loses its own. Before the 2026-09-27 migration
     the column is missing and the write is retried without it. */
  record.description = override ? row.description ?? null : null;
  const write = (r: Record<string, unknown>) =>
    supabaseServer.from(TABLE).upsert(r, { onConflict: "event_id,occurrence_start" });

  let current = record;
  let degraded = false;
  let { error } = await write(current);
  if (error && isMissingSchema(error, "description")) {
    const { description: _d, ...rest } = current;
    void _d;
    current = rest;
    ({ error } = await write(current));
    if (row.description != null) degraded = true;
  }
  /* Before the same migration '' ("no link for this occurrence") breaks the
     https CHECK: keep the rest of the change; the occurrence keeps the
     series' link. */
  if (error && current.meeting_url === "" && isLinkCheck(error)) {
    current = { ...current, meeting_url: null };
    ({ error } = await write(current));
    degraded = true;
  }
  if (!error) return degraded ? { ok: true, degraded: true } : { ok: true };
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
