import "server-only";

/* ---------------------------------------------------------------------------
   events — server-side helpers for the Events app.

   The security boundary lives HERE, not in the client:
     · every query is tenant-scoped (auth.tenant_id);
     · module access/actions come from lib/server/auth ("Events" module);
     · edit/delete are restricted to the event owner + Super Admin
       (the owner rule: the person running the event controls it; the CEO
       is Super Admin and can always step in).

   RLS note: the three koleex_event* tables have NO public policies — the
   service-role client bypasses RLS by design, so these functions are the
   only door, and every door checks the module permission first.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import {
  GUEST_STATUSES,
  isEventStatus,
  isEventType,
  isGuestCategory,
  isGuestStatus,
  localToIso,
  type EventDetail,
  type EventGuestRow,
  type EventListItem,
  type EventOwner,
  type GuestStatus,
} from "@/lib/events/types";

export const EVENTS_MODULE = "Events";

export function requireTenant(auth: ServerAuthContext): NextResponse | null {
  if (!auth.tenant_id) {
    return NextResponse.json({ error: "No tenant context" }, { status: 400 });
  }
  return null;
}

/** Super Admin always; otherwise the module role must allow the action AND
 *  the caller must own the event. Returns null when allowed. */
export function canManageEvent(
  auth: ServerAuthContext,
  ownerAccountId: string,
): boolean {
  return auth.is_super_admin || auth.account_id === ownerAccountId;
}

/* ── List ─────────────────────────────────────────────────────────────────── */

export type EventListFilter = "all" | "upcoming" | "past" | "archived";

export function listFilterOf(q: string | null): EventListFilter {
  return q === "upcoming" || q === "past" || q === "archived" ? q : "all";
}

/* The account's readable name lives on its linked people row — accounts
 *  itself is login identity only (username, email). */
export const OWNER_SELECT = "owner:owner_account_id(username, person:person_id(full_name, display_name))";

/** The FK embed arrives with every level possibly array-wrapped; flatten it
 *  into the EventOwner shape once, so the views never see PostgREST's
 *  nesting. */
function normalizeOwner(owner: unknown): EventOwner | null {
  const o = (Array.isArray(owner) ? owner[0] : owner) as Record<string, unknown> | null;
  if (!o) return null;
  const p = o.person;
  const person = (Array.isArray(p) ? p[0] : p) as
    | { full_name?: string | null; display_name?: string | null }
    | null;
  return {
    username: (o.username as string | null) ?? null,
    person: person ? { full_name: person.full_name ?? null, display_name: person.display_name ?? null } : null,
  };
}

/** One page of events + the guest funnel counts, merged in memory.
 *  Two queries total, both bounded and tenant-scoped (China-latency rule:
 *  never N+1). `counts` feeds the filter menu's badges — three cheap HEAD
 *  counts, exact at the DB level. */
export async function loadEventList(
  auth: ServerAuthContext,
  filter: EventListFilter,
  search: string,
): Promise<{ rows: EventListItem[]; counts: Record<EventListFilter, number> }> {
  let q = supabaseServer
    .from("koleex_events")
    .select(`*, ${OWNER_SELECT}`)
    .eq("tenant_id", auth.tenant_id)
    .order("start_at", { ascending: true, nullsFirst: false })
    .limit(500);

  if (filter === "upcoming") q = q.in("status", ["idea", "planning", "confirmed", "live"]);
  else if (filter === "past") q = q.eq("status", "done");
  else if (filter === "archived") q = q.eq("status", "archived");
  else q = q.neq("status", "archived");

  const term = search.trim().toLowerCase();
  if (term) {
    q = q.or(
      `title.ilike.%${term}%,location.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`,
    );
  }

  /* Three SEPARATE head builders — supabase-js filters accumulate on the
   *  same instance, so reusing one base would AND the status filters. */
  const head = () =>
    supabaseServer
      .from("koleex_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", auth.tenant_id);
  const [{ data, error }, nonArchived, done, archived] = await Promise.all([
    q,
    head().neq("status", "archived"),
    head().eq("status", "done"),
    head().eq("status", "archived"),
  ]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const nonArchivedCount = nonArchived.count ?? 0;
  const doneCount = done.count ?? 0;
  const filterCounts: Record<EventListFilter, number> = {
    all: nonArchivedCount,
    upcoming: nonArchivedCount - doneCount,
    past: doneCount,
    archived: archived.count ?? 0,
  };

  /* Funnel counts for exactly these events — one read. */
  const guestCounts = new Map<string, Partial<Record<GuestStatus, number>>>();
  if (rows.length) {
    const { data: gs } = await supabaseServer
      .from("koleex_event_guests")
      .select("event_id, status")
      .eq("tenant_id", auth.tenant_id)
      .in("event_id", rows.map((r) => r.id));
    for (const g of (gs ?? []) as Array<{ event_id: string; status: string }>) {
      const m = guestCounts.get(g.event_id) ?? {};
      const s = g.status as GuestStatus;
      m[s] = (m[s] ?? 0) + 1;
      guestCounts.set(g.event_id, m);
    }
  }

  return {
    rows: rows.map((r) => {
      const { owner, ...rest } = r as { owner?: unknown } & Record<string, unknown>;
      return {
        ...rest,
        owner: normalizeOwner(owner),
        guest_counts: guestCounts.get(String(r.id)) ?? {},
      } as unknown as EventListItem;
    }),
    counts: filterCounts,
  };
}

/* ── Detail ───────────────────────────────────────────────────────────────── */

/** The workspace payload in ONE round trip: event + guests + agenda +
 *  budget lines. */
export async function loadEventDetail(
  auth: ServerAuthContext,
  eventId: string,
): Promise<{ detail?: EventDetail; error?: NextResponse }> {
  const [
    { data: ev, error },
    { data: guests },
    { data: agenda },
    { data: budget },
  ] = await Promise.all([
    supabaseServer
      .from("koleex_events")
      .select(`*, ${OWNER_SELECT}`)
      .eq("tenant_id", auth.tenant_id)
      .eq("id", eventId)
      .maybeSingle(),
    supabaseServer
      .from("koleex_event_guests")
      .select("*, invitation:koleex_event_invitations(token, status, sent_at, viewed_at, answered_at)")
      .eq("tenant_id", auth.tenant_id)
      .eq("event_id", eventId)
      .order("name", { ascending: true })
      .limit(2000),
    supabaseServer
      .from("koleex_event_agenda_items")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("starts_at", { ascending: true, nullsFirst: false }),
    supabaseServer
      .from("koleex_event_budget_lines")
      .select("*")
      .eq("tenant_id", auth.tenant_id)
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
  ]);
  if (error) throw new Error(error.message);
  if (!ev) return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) };

  const { owner, ...rest } = ev as { owner?: unknown } & Record<string, unknown>;
  /* The invitation embed is one-to-one (UNIQUE guest_id) but PostgREST may
   *  still wrap it — unwrap each guest to the plain GuestInvitation shape. */
  const rawGuests = (guests ?? []) as Array<Record<string, unknown>>;
  return {
    detail: {
      ...rest,
      owner: normalizeOwner(owner),
      guests: rawGuests.map((g) => {
        const { invitation, ...guest } = g;
        const inv = (Array.isArray(invitation) ? invitation[0] : invitation) ?? null;
        return { ...guest, invitation: inv } as unknown as EventGuestRow;
      }),
      agenda: (agenda ?? []) as unknown as EventDetail["agenda"],
      budget: (budget ?? []) as unknown as EventDetail["budget"],
    } as unknown as EventDetail,
  };
}

/* ── Field parsing (create/update) ────────────────────────────────────────── */

export interface EventFields {
  title?: string;
  type?: string;
  status?: string;
  start_at?: string | null;
  end_at?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  description?: string | null;
  budget_total?: number | null;
  expected_guests?: number | null;
  booth?: string | null;
  website?: string | null;
}

/** Read the event form body. Returns either the fields or an error message. */
export function readEventFields(body: unknown): { fields?: EventFields; error?: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const fields: EventFields = {};

  if (b.title !== undefined) {
    if (typeof b.title !== "string" || !b.title.trim()) return { error: "Title is required" };
    fields.title = b.title.trim().slice(0, 160);
  }
  if (b.type !== undefined) {
    if (!isEventType(b.type)) return { error: "Unknown event type" };
    fields.type = b.type;
  }
  if (b.status !== undefined) {
    if (!isEventStatus(b.status)) return { error: "Unknown event status" };
    fields.status = b.status;
  }
  for (const key of ["location", "city", "country", "description", "booth", "website"] as const) {
    if (b[key] !== undefined) {
      fields[key] = b[key] === null ? null : String(b[key]).slice(0, 2000);
    }
  }
  if (b.start_at !== undefined) fields.start_at = localToIso(b.start_at as string | null);
  if (b.end_at !== undefined) fields.end_at = localToIso(b.end_at as string | null);
  if (b.budget_total !== undefined) {
    const n = b.budget_total === null || b.budget_total === "" ? null : Number(b.budget_total);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return { error: "Invalid budget" };
    fields.budget_total = n;
  }
  if (b.expected_guests !== undefined) {
    const n = b.expected_guests === null || b.expected_guests === "" ? null : Number(b.expected_guests);
    if (n !== null && (!Number.isInteger(n) || n < 0)) return { error: "Invalid guest target" };
    fields.expected_guests = n;
  }
  return { fields };
}

/* ── Guest parsing ────────────────────────────────────────────────────────── */

export interface GuestFields {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  category?: string;
  status?: string;
  notes?: string | null;
}

export function readGuestFields(body: unknown): { fields?: GuestFields; error?: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const fields: GuestFields = {};

  if (b.name !== undefined) {
    if (typeof b.name !== "string" || !b.name.trim()) return { error: "Name is required" };
    fields.name = b.name.trim().slice(0, 120);
  }
  for (const key of ["company", "email", "phone", "notes"] as const) {
    if (b[key] !== undefined) {
      fields[key] = b[key] === null ? null : String(b[key]).slice(0, 500);
    }
  }
  if (b.category !== undefined) {
    if (!isGuestCategory(b.category)) return { error: "Unknown guest category" };
    fields.category = b.category;
  }
  if (b.status !== undefined) {
    if (!isGuestStatus(b.status)) return { error: "Unknown guest status" };
    fields.status = b.status;
  }
  return { fields };
}

/** Status transition bookkeeping: invited_at / responded_at stamps. */
export function guestStatusPatch(
  prevStatus: GuestStatus,
  nextStatus: GuestStatus,
  prevRow: { invited_at: string | null; responded_at: string | null },
): Record<string, unknown> {
  const patch: Record<string, unknown> = { status: nextStatus };
  const now = new Date().toISOString();
  if (["invited", "viewed", "accepted", "declined", "maybe", "attended"].includes(nextStatus)
      && !prevRow.invited_at && prevStatus === "listed") {
    patch.invited_at = now;
  }
  if (["accepted", "declined", "maybe", "attended"].includes(nextStatus) && !prevRow.responded_at) {
    patch.responded_at = now;
  }
  return patch;
}

/** Load an event for a mutation: tenant-scoped, exists, and owned by the
 *  caller (or Super Admin). One helper so every mutation route implements
 *  the SAME rule — drift here is a privilege bug. */
export async function requireOwnedEvent(
  auth: ServerAuthContext,
  eventId: string,
): Promise<{
  event?: { id: string; owner_account_id: string };
  error?: NextResponse;
}> {
  const { data, error } = await supabaseServer
    .from("koleex_events")
    .select("id, owner_account_id")
    .eq("tenant_id", auth.tenant_id)
    .eq("id", eventId)
    .maybeSingle();
  if (error) {
    console.error("[events] load for manage:", error.message);
    return { error: NextResponse.json({ error: "Could not load event" }, { status: 500 }) };
  }
  if (!data) return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) };
  const ev = data as { id: string; owner_account_id: string };
  if (!canManageEvent(auth, ev.owner_account_id)) {
    return { error: NextResponse.json({ error: "Only the owner can change this event" }, { status: 403 }) };
  }
  return { event: ev };
}

/* ── Check-in ─────────────────────────────────────────────────────────────── */

export type CheckInResult =
  | { ok: true; guest: { id: string; name: string; status: string; checked_in_at: string } }
  | { ok: false; error: string; status: number };

/** Stamp the check-in. THE conditional update is the double-scan guard: two
 *  staff scanning the same QR in the same second race on
 *  `WHERE checked_in_at ISNULL`, and exactly one row comes back. The funnel
 *  follows to 'attended' so every surface agrees. */
export async function checkInGuest(
  auth: ServerAuthContext,
  eventId: string,
  target: { guestId?: string; token?: string },
): Promise<CheckInResult> {
  const owned = await requireOwnedEvent(auth, eventId);
  if (owned.error) return { ok: false, error: "Event not found", status: 404 };

  /* Resolve the guest — directly, or through their invitation token (what
   *  the QR at the door encodes). Both stay tenant- and event-scoped. */
  let guestId = target.guestId ?? null;
  if (!guestId && target.token) {
    const { data: inv } = await supabaseServer
      .from("koleex_event_invitations")
      .select("guest_id")
      .eq("tenant_id", auth.tenant_id)
      .eq("event_id", eventId)
      .eq("token", target.token)
      .maybeSingle();
    guestId = (inv as { guest_id: string } | null)?.guest_id ?? null;
    if (!guestId) return { ok: false, error: "No guest for this code", status: 404 };
  }
  if (!guestId) return { ok: false, error: "Nothing to check in", status: 400 };

  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("koleex_event_guests")
    .update({ checked_in_at: now, checked_in_by: auth.account_id, status: "attended", responded_at: now })
    .eq("tenant_id", auth.tenant_id)
    .eq("event_id", eventId)
    .eq("id", guestId)
    .is("checked_in_at", null)
    .select("id, name, status, checked_in_at")
    .maybeSingle();
  if (error) {
    console.error("[events] checkin:", error.message);
    return { ok: false, error: "Check-in failed", status: 500 };
  }
  if (!data) {
    /* Either no such guest, or already checked in — report the truth. */
    const { data: row } = await supabaseServer
      .from("koleex_event_guests")
      .select("checked_in_at")
      .eq("tenant_id", auth.tenant_id)
      .eq("event_id", eventId)
      .eq("id", guestId)
      .maybeSingle();
    if (!row) return { ok: false, error: "Guest not found", status: 404 };
    return { ok: false, error: "Already checked in", status: 409 };
  }
  return { ok: true, guest: data as { id: string; name: string; status: string; checked_in_at: string } };
}

export function validGuestStatuses(): readonly string[] {
  return GUEST_STATUSES;
}
