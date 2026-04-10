/* ---------------------------------------------------------------------------
   Calendar events — Supabase CRUD.

   Backs the self-contained Koleex Calendar app. No external sync; every
   event belongs to an account and is rendered in that account's preferred
   timezone.

   Uses the untyped admin client (anon key) just like products-admin.ts.
   All access is gated at the UI layer by AdminAuth.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type {
  CalendarEventRow,
  CalendarEventInsert,
  CalendarEventUpdate,
} from "@/types/supabase";

const EVENTS = "koleex_calendar_events";

/* ============================================================================
   Fetch
   ============================================================================ */

/**
 * Fetch all events for an account within the [rangeStart, rangeEnd) window.
 *
 * Uses overlap semantics: event.start_at < rangeEnd AND event.end_at >= rangeStart.
 * That way an event that started yesterday and ends today is still visible
 * in today's view.
 */
export async function fetchEventsInRange(
  accountId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEventRow[]> {
  const { data, error } = await supabase
    .from(EVENTS)
    .select("*")
    .eq("account_id", accountId)
    .lt("start_at", rangeEnd.toISOString())
    .gte("end_at", rangeStart.toISOString())
    .order("start_at", { ascending: true });
  if (error) {
    console.error("[Calendar] fetchEventsInRange:", error.message);
    return [];
  }
  return (data as CalendarEventRow[]) || [];
}

/** Fetch every event on a single account (small datasets only). */
export async function fetchAllEventsForAccount(
  accountId: string,
): Promise<CalendarEventRow[]> {
  const { data, error } = await supabase
    .from(EVENTS)
    .select("*")
    .eq("account_id", accountId)
    .order("start_at", { ascending: true });
  if (error) {
    console.error("[Calendar] fetchAllEventsForAccount:", error.message);
    return [];
  }
  return (data as CalendarEventRow[]) || [];
}

export async function fetchEventById(id: string): Promise<CalendarEventRow | null> {
  const { data, error } = await supabase
    .from(EVENTS)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[Calendar] fetchEventById:", error.message);
    return null;
  }
  return (data as CalendarEventRow) || null;
}

/* ============================================================================
   Mutations
   ============================================================================ */

export async function createEvent(
  input: CalendarEventInsert,
): Promise<CalendarEventRow | null> {
  const { data, error } = await supabase
    .from(EVENTS)
    .insert(input)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[Calendar] createEvent:", error.message);
    return null;
  }
  return (data as CalendarEventRow) || null;
}

export async function updateEvent(
  id: string,
  patch: CalendarEventUpdate,
): Promise<CalendarEventRow | null> {
  const { data, error } = await supabase
    .from(EVENTS)
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[Calendar] updateEvent:", error.message);
    return null;
  }
  return (data as CalendarEventRow) || null;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const { error } = await supabase.from(EVENTS).delete().eq("id", id);
  if (error) {
    console.error("[Calendar] deleteEvent:", error.message);
    return false;
  }
  return true;
}
