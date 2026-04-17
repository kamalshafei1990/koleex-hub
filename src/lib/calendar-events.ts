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
import {
  buildScopeFilter,
  orClauseForScope,
  privacyClause,
  logPrivateAccess,
  type ScopeContext,
} from "./scope";

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
 *
 * Scope-aware: when ctx is provided, the fetch applies the user's Calendar
 * scope (own / department / all + SA bypass + private handling) instead of
 * the hardcoded `account_id = me` filter. When ctx is null the legacy
 * behaviour (strict per-user) is preserved.
 */
export async function fetchEventsInRange(
  accountId: string,
  rangeStart: Date,
  rangeEnd: Date,
  ctx?: ScopeContext | null,
): Promise<CalendarEventRow[]> {
  let query = supabase
    .from(EVENTS)
    .select("*")
    .lt("start_at", rangeEnd.toISOString())
    .gte("end_at", rangeStart.toISOString())
    .order("start_at", { ascending: true });

  // Scope enforcement decision tree:
  //   - No ctx → legacy behaviour, filter to the requested accountId.
  //   - Super Admin → can view any account's calendar ("view as").
  //     Keep the accountId filter so they see that account's events only.
  //   - Regular user viewing their OWN account → apply scope filter
  //     (own + attending + dept + private-handling).
  //   - Regular user trying to view a DIFFERENT account → deny (empty result).
  if (!ctx) {
    query = query.eq("account_id", accountId);
  } else if (ctx.is_super_admin) {
    query = query.eq("account_id", accountId);
    // Private-record filter still applies unless break-glass
    const filter = await buildScopeFilter({ ctx, module_name: "Calendar" });
    const privacyOr = privacyClause(filter, ctx);
    if (privacyOr) query = query.or(privacyOr);
  } else if (accountId === ctx.account_id) {
    const filter = await buildScopeFilter({ ctx, module_name: "Calendar" });
    const scopeOr = orClauseForScope(filter, ctx);
    if (scopeOr) query = query.or(scopeOr);
    const privacyOr = privacyClause(filter, ctx);
    if (privacyOr) query = query.or(privacyOr);
  } else {
    // Regular user attempting to view another account's calendar — denied.
    return [];
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Calendar] fetchEventsInRange:", error.message);
    return [];
  }
  const events = (data as CalendarEventRow[]) || [];

  if (ctx?.can_view_private) {
    const privateIds = events
      .filter((e) => (e as { is_private?: boolean }).is_private)
      .map((e) => e.id);
    if (privateIds.length > 0) {
      void logPrivateAccess(
        ctx,
        "Calendar",
        "koleex_calendar_events",
        privateIds,
      );
    }
  }

  return events;
}

/** Fetch every event on a single account (small datasets only).
 *  Scope-aware when ctx is provided. */
export async function fetchAllEventsForAccount(
  accountId: string,
  ctx?: ScopeContext | null,
): Promise<CalendarEventRow[]> {
  let query = supabase
    .from(EVENTS)
    .select("*")
    .order("start_at", { ascending: true });

  if (ctx) {
    const filter = await buildScopeFilter({ ctx, module_name: "Calendar" });
    const scopeOr = orClauseForScope(filter, ctx);
    if (scopeOr) query = query.or(scopeOr);
    const privacyOr = privacyClause(filter, ctx);
    if (privacyOr) query = query.or(privacyOr);
  } else {
    query = query.eq("account_id", accountId);
  }

  const { data, error } = await query;
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
