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
  canViewAccount,
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
  // Try API first — server-side route validates session + enforces
  // Type C rules (only SA can view someone else's calendar) via the
  // service_role client, not anon.
  try {
    const params = new URLSearchParams({
      accountId,
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
    });
    const res = await fetch("/api/calendar/events?" + params.toString(), {
      credentials: "include",
    });
    if (res.ok) {
      const json = (await res.json()) as { events: CalendarEventRow[] };
      return json.events;
    }
    if (res.status === 401 || res.status === 403) return [];
  } catch (e) {
    console.error("[Calendar] fetchEventsInRange API failed:", e);
  }

  // Legacy path: no ctx means the caller hasn't migrated to scope yet.
  // Preserve the old strict per-user behaviour.
  if (!ctx) {
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

  // Permission gate: Calendar is a Type C (Personal) module. canViewAccount
  // enforces the rule that only Super Admin can view another account's
  // calendar — Scope = All / Department configured on a role has NO effect
  // on Type C modules. This is a hard boundary, by design.
  const access = await canViewAccount(ctx, "Calendar", accountId);
  if (!access.allowed) return [];

  let query = supabase
    .from(EVENTS)
    .select("*")
    .eq("account_id", accountId)
    .lt("start_at", rangeEnd.toISOString())
    .gte("end_at", rangeStart.toISOString())
    .order("start_at", { ascending: true });

  // Multi-tenancy: event must belong to the viewer's tenant. Prevents a
  // customer-tenant Super Admin from accidentally viewing Koleex employees'
  // calendars by guessing an account_id from another tenant.
  if (ctx.tenant_id) {
    query = query.eq("tenant_id", ctx.tenant_id);
  }

  // Private-record filter. When viewing own calendar we still see our own
  // private events. When viewing someone else's calendar we hide their
  // private events — unless the role has break-glass can_view_private, in
  // which case we fetch everything and audit-log the private reads.
  const viewingOwn = accountId === ctx.account_id;
  if (!viewingOwn && !ctx.can_view_private) {
    query = query.eq("is_private", false);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Calendar] fetchEventsInRange:", error.message);
    return [];
  }
  const events = (data as CalendarEventRow[]) || [];

  // Audit break-glass reads of private records.
  if (!viewingOwn && ctx.can_view_private) {
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
    if (res.status === 401 || res.status === 403) return null;
  } catch (e) {
    console.error("[Calendar] createEvent API failed:", e);
  }
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
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  } catch (e) {
    console.error("[Calendar] updateEvent API failed:", e);
  }
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
  try {
    const res = await fetch("/api/calendar/events/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403 || res.status === 404) return false;
  } catch (e) {
    console.error("[Calendar] deleteEvent API failed:", e);
  }
  const { error } = await supabase.from(EVENTS).delete().eq("id", id);
  if (error) {
    console.error("[Calendar] deleteEvent:", error.message);
    return false;
  }
  return true;
}
