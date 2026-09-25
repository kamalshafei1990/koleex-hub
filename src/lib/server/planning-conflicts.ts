import "server-only";

/* ---------------------------------------------------------------------------
   planning-conflicts — the ONE server-side conflict check for planning writes.

   Every path that places an item on a resource runs it: POST / PATCH of an
   item (drag-and-drop and the timeline are PATCHes), taking an open shift,
   a recurring series, and the AI agent's create/update tools. It answers,
   per candidate:

     · double_booking — another item on the SAME resource overlaps it and
       is not cancelled (candidates in one batch are checked against each
       other too, so a series or a copied week can't double-book itself);
     · leave          — the resource's employee is on APPROVED HR leave on
       any day the item covers (days read in the caller's zone, else UTC);
     · travel         — the same, when that leave's TYPE is a business trip
       (code / name reads travel, trip, mission …). The Hub has no trip
       booking table (the Travel app issues visa letters for VISITORS, and
       trip reports are written after the fact), so an approved HR leave of
       a travel type is the one record of a planned trip;
     · out_of_office  — the person's own Calendar holds an "out of office"
       event overlapping the item (one-offs and recurring series, with their
       per-occurrence exceptions). Its title is never returned here — the
       board overlay alone asks for titles, under Calendar's read rule.

   Queries are bounded by the batch's own window and resources: one items
   query, for leave one resources → employees → leave chain, and for the
   calendar one one-off + one series query. A Calendar read failure is
   logged and skipped — it never blocks a planning write.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { allDayKeys, safeTimeZone, zonedDateKey } from "@/lib/calendar-tz";
import { expandWithExceptions, type CalendarRec } from "@/lib/calendar-recurrence";
import { loadExceptions } from "@/lib/server/calendar-exceptions";
import { accountTimezones } from "@/lib/server/calendar-notify";

export type PlanningConflictKind = "double_booking" | "leave" | "travel" | "out_of_office";

export interface PlanningConflictCandidate {
  id?: string | null;
  title?: string | null;
  resource_id: string | null;
  start_at: string;
  end_at: string;
  status?: string | null;
}

export interface PlanningConflict {
  kind: PlanningConflictKind;
  /** Index of the candidate in the checked batch. */
  index: number;
  item_id: string | null;
  title: string | null;
  resource_id: string;
  resource_name: string | null;
  start_at: string;
  end_at: string;
  other_id?: string | null;
  other_title?: string | null;
  other_start_at?: string;
  other_end_at?: string;
  leave_start?: string;
  leave_end?: string;
  /** out_of_office: the calendar event's span (instants). */
  away_start_at?: string;
  away_end_at?: string;
}

/** The most conflicts a response lists (the count is still exact). */
export const MAX_LISTED_CONFLICTS = 50;

const DAY_MS = 86_400_000;

/** An HR leave type that stands for a business trip rather than time off. */
const TRAVEL_TYPE_RE = /travel|trip|mission|出差|差旅|سفر|مأمورية|انتداب/i;

type LeaveTypeJoin = { code?: string | null; name?: string | null };
function isTravelType(t: LeaveTypeJoin | LeaveTypeJoin[] | null | undefined): boolean {
  const one = Array.isArray(t) ? t[0] : t;
  return !!one && TRAVEL_TYPE_RE.test(`${one.code ?? ""} ${one.name ?? ""}`);
}

/** Every local-day key ("YYYY-MM-DD") an item touches in `tz`. */
function coveredDayKeys(startIso: string, endIso: string, tz: string): string[] {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  const keys = new Set<string>();
  // The end is exclusive: an item ending exactly at midnight does not cover the next day.
  const last = Math.max(s, e - 1);
  for (let t = s; t <= last; t += DAY_MS / 2) keys.add(zonedDateKey(t, tz));
  keys.add(zonedDateKey(last, tz));
  return [...keys];
}

/**
 * Check a batch of candidate placements. `excludeIds` are rows that must
 * not count as "the other side" (the rows being edited or replaced).
 */
export async function checkPlanningConflicts(
  tenantId: string,
  candidates: PlanningConflictCandidate[],
  opts: { excludeIds?: string[]; tz?: string | null } = {},
): Promise<{ conflicts: PlanningConflict[]; total: number }> {
  const tz = safeTimeZone(opts.tz ?? "UTC");
  const live = candidates
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => !!c.resource_id && c.status !== "cancelled" && Date.parse(c.end_at) > Date.parse(c.start_at));
  if (live.length === 0) return { conflicts: [], total: 0 };

  const resourceIds = [...new Set(live.map(({ c }) => c.resource_id as string))];
  const minStart = new Date(Math.min(...live.map(({ c }) => Date.parse(c.start_at)))).toISOString();
  const maxEnd = new Date(Math.max(...live.map(({ c }) => Date.parse(c.end_at)))).toISOString();
  const exclude = new Set([...(opts.excludeIds ?? []), ...live.map(({ c }) => c.id).filter((x): x is string => !!x)]);

  const [itemsRes, resRes] = await Promise.all([
    supabaseServer
      .from("planning_items")
      .select("id, title, type, resource_id, start_at, end_at")
      .eq("tenant_id", tenantId)
      .in("resource_id", resourceIds)
      .neq("status", "cancelled")
      .lt("start_at", maxEnd)
      .gt("end_at", minStart)
      .limit(5000),
    supabaseServer
      .from("planning_resources")
      .select("id, name, type, account_id")
      .eq("tenant_id", tenantId)
      .in("id", resourceIds),
  ]);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (resRes.error) throw new Error(resRes.error.message);

  type Row = { id: string; title: string | null; type: string; resource_id: string; start_at: string; end_at: string };
  const existing = ((itemsRes.data ?? []) as Row[]).filter((r) => !exclude.has(r.id));
  const byRes = new Map<string, Row[]>();
  for (const r of existing) {
    const arr = byRes.get(r.resource_id) ?? [];
    arr.push(r);
    byRes.set(r.resource_id, arr);
  }
  const resources = (resRes.data ?? []) as Array<{ id: string; name: string; type: string; account_id: string | null }>;
  const resName = new Map(resources.map((r) => [r.id, r.name]));

  const out: PlanningConflict[] = [];
  const base = (c: PlanningConflictCandidate, index: number) => ({
    index,
    item_id: c.id ?? null,
    title: c.title ?? null,
    resource_id: c.resource_id as string,
    resource_name: resName.get(c.resource_id as string) ?? null,
    start_at: c.start_at,
    end_at: c.end_at,
  });

  /* 1. Double booking — against stored rows, then within the batch. */
  for (const { c, index } of live) {
    const s = Date.parse(c.start_at);
    const e = Date.parse(c.end_at);
    for (const o of byRes.get(c.resource_id as string) ?? []) {
      if (Date.parse(o.start_at) < e && Date.parse(o.end_at) > s) {
        out.push({
          kind: "double_booking",
          ...base(c, index),
          other_id: o.id,
          other_title: o.title || o.type,
          other_start_at: o.start_at,
          other_end_at: o.end_at,
        });
      }
    }
  }
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (a.c.resource_id !== b.c.resource_id) continue;
      if (Date.parse(a.c.start_at) < Date.parse(b.c.end_at) && Date.parse(a.c.end_at) > Date.parse(b.c.start_at)) {
        out.push({
          kind: "double_booking",
          ...base(b.c, b.index),
          other_id: a.c.id ?? null,
          other_title: a.c.title ?? null,
          other_start_at: a.c.start_at,
          other_end_at: a.c.end_at,
        });
      }
    }
  }

  /* 2. Approved leave of the resource's employee. hr_leave_requests has no
        tenant column, so the chain runs FROM this tenant's resources (same
        rule as /api/planning/leaves). */
  const accountByRes = new Map(
    resources.filter((r) => r.type === "employee" && r.account_id).map((r) => [r.id, r.account_id as string]),
  );
  const accountIds = [...new Set(accountByRes.values())];
  if (accountIds.length > 0) {
    /* The Calendar read runs alongside the HR chain; a failure there is
       logged and skipped (see the header). */
    const awayP = loadOutOfOffice(tenantId, accountIds, minStart, maxEnd).catch((e: unknown) => {
      console.error("[planning-conflicts] out of office:", e instanceof Error ? e.message : e);
      return new Map<string, AwaySpan[]>();
    });
    const fromKey = zonedDateKey(Date.parse(minStart) - DAY_MS, tz);
    const toKey = zonedDateKey(Date.parse(maxEnd) + DAY_MS, tz);
    const { data: emps, error: empErr } = await supabaseServer
      .from("koleex_employees")
      .select("id, account_id")
      .in("account_id", accountIds)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    if (empErr) throw new Error(empErr.message);
    const accountByEmp = new Map((emps ?? []).map((e) => [e.id as string, e.account_id as string]));
    const empIds = [...accountByEmp.keys()];
    if (empIds.length > 0) {
      const { data: reqs, error: lvErr } = await supabaseServer
        .from("hr_leave_requests")
        .select("employee_id, start_date, end_date, hr_leave_types ( code, name )")
        .eq("status", "approved")
        .in("employee_id", empIds)
        .lte("start_date", toKey)
        .gte("end_date", fromKey)
        .limit(1000);
      if (lvErr) throw new Error(lvErr.message);
      const leaveByAccount = new Map<string, Array<{ start: string; end: string; travel: boolean }>>();
      for (const r of (reqs ?? []) as Array<{ employee_id: string; start_date: string; end_date: string; hr_leave_types?: LeaveTypeJoin | LeaveTypeJoin[] | null }>) {
        const acct = accountByEmp.get(r.employee_id);
        if (!acct) continue;
        const arr = leaveByAccount.get(acct) ?? [];
        arr.push({
          start: String(r.start_date).slice(0, 10),
          end: String(r.end_date).slice(0, 10),
          travel: isTravelType(r.hr_leave_types),
        });
        leaveByAccount.set(acct, arr);
      }
      for (const { c, index } of live) {
        const acct = accountByRes.get(c.resource_id as string);
        const spans = acct ? leaveByAccount.get(acct) : undefined;
        if (!spans?.length) continue;
        const days = coveredDayKeys(c.start_at, c.end_at, tz);
        const hit = spans.find((sp) => days.some((d) => sp.start <= d && d <= sp.end));
        if (hit) out.push({ kind: hit.travel ? "travel" : "leave", ...base(c, index), leave_start: hit.start, leave_end: hit.end });
      }
    }

    /* 3. Out-of-office time on the person's own Calendar. An all-day
          event counts per local day; a timed one by overlap. */
    const away = await awayP;
    for (const { c, index } of live) {
      const acct = accountByRes.get(c.resource_id as string);
      const spans = acct ? away.get(acct) : undefined;
      if (!spans?.length) continue;
      const s = Date.parse(c.start_at);
      const e = Date.parse(c.end_at);
      const days = coveredDayKeys(c.start_at, c.end_at, tz);
      const hit = spans.find(({ s: as, e: ae, days: dk }) =>
        dk ? days.some((d) => dk.start <= d && d <= dk.end) : as < e && ae > s,
      );
      if (hit) {
        out.push({
          kind: "out_of_office",
          ...base(c, index),
          away_start_at: new Date(hit.s).toISOString(),
          away_end_at: new Date(hit.e).toISOString(),
          ...(hit.days ? { leave_start: hit.days.start, leave_end: hit.days.end } : {}),
        });
      }
    }
  }

  out.sort((a, b) => a.index - b.index || a.kind.localeCompare(b.kind));
  return { conflicts: out.slice(0, MAX_LISTED_CONFLICTS), total: out.length };
}

/** One out-of-office span: instants (ms) and, for an all-day event, its
 *  inclusive local date keys on the owner's clock. `title` only when a
 *  `viewer` was passed AND that viewer could open the event in Calendar
 *  (see loadOutOfOffice) — the conflict check never asks for it. */
export type AwaySpan = { s: number; e: number; days?: { start: string; end: string }; title?: string };

/** Who is looking — for the title rule of loadOutOfOffice. */
export interface AwayViewer {
  account_id: string;
  is_super_admin: boolean;
}

/** Out-of-office spans per account in [fromIso, toIso): one-off events plus
 *  recurring series expanded on their owner's clock with their exceptions.
 *  An all-day event also carries its date keys (compared per local day).
 *  Shared by the conflict check and the board's overlay
 *  (/api/planning/leaves), so both see exactly the same time. Callers pass
 *  only accounts behind this tenant's employee resources. Throws on a read
 *  error — callers log and skip. */
export async function loadOutOfOffice(
  tenantId: string,
  accountIds: string[],
  fromIso: string,
  toIso: string,
  viewer?: AwayViewer,
): Promise<Map<string, AwaySpan[]>> {
  /* Titles are only read at all when a viewer asks (the board overlay). */
  const COLS = `id, account_id, start_at, end_at, all_day, recurrence, recurrence_until${viewer ? ", title, is_private" : ""}`;
  const [oneOff, series] = await Promise.all([
    supabaseServer
      .from("koleex_calendar_events")
      .select(COLS)
      .eq("tenant_id", tenantId)
      .eq("event_type", "out_of_office")
      .in("account_id", accountIds)
      .is("recurrence", null)
      .lt("start_at", toIso)
      .gte("end_at", fromIso)
      .limit(1000),
    supabaseServer
      .from("koleex_calendar_events")
      .select(COLS)
      .eq("tenant_id", tenantId)
      .eq("event_type", "out_of_office")
      .in("account_id", accountIds)
      .not("recurrence", "is", null)
      .lte("start_at", toIso)
      .or(`recurrence_until.is.null,recurrence_until.gte.${fromIso.slice(0, 10)}`)
      .limit(500),
  ]);
  if (oneOff.error) throw new Error(oneOff.error.message);
  if (series.error) throw new Error(series.error.message);
  type Ev = {
    id: string; account_id: string; start_at: string; end_at: string; all_day: boolean | null;
    recurrence: CalendarRec; recurrence_until: string | null; title?: string | null; is_private?: boolean | null;
  };
  const rows = [...(oneOff.data ?? []), ...(series.data ?? [])] as unknown as Ev[];
  const out = new Map<string, AwaySpan[]>();
  if (rows.length === 0) return out;

  const recurring = rows.filter((r) => r.recurrence);
  const [tzs, exceptions, readable] = await Promise.all([
    accountTimezones(rows.map((r) => r.account_id)),
    loadExceptions(recurring.map((r) => r.id)),
    viewer ? readableEventIds(rows, viewer) : Promise.resolve(new Set<string>()),
  ]);
  /* The Calendar free/busy rule (lib/server/calendar-feed loadBusyBlocks):
     never a private event; otherwise only when the viewer organizes it, is
     invited to it, or is a Super Admin. */
  const titleOf = (r: Ev, override?: string | null): string | undefined => {
    if (!viewer || r.is_private !== false || !readable.has(r.id)) return undefined;
    const t = (override || r.title || "").trim();
    return t ? t.slice(0, 200) : undefined;
  };
  const push = (acct: string, startIso: string, endIso: string, allDay: boolean, ownerTz: string, title?: string) => {
    const s = Date.parse(startIso);
    const e = Math.max(Date.parse(endIso), s + 1);
    const arr = out.get(acct) ?? [];
    const span: AwaySpan = allDay ? { s, e, days: allDayKeys(startIso, endIso, ownerTz) } : { s, e };
    if (title) span.title = title;
    arr.push(span);
    out.set(acct, arr);
  };
  const winFrom = new Date(Date.parse(fromIso) - DAY_MS);
  const winTo = new Date(Date.parse(toIso) + DAY_MS);
  for (const r of rows) {
    const ownerTz = tzs.get(r.account_id) ?? "UTC";
    if (!r.recurrence) {
      push(r.account_id, r.start_at, r.end_at, !!r.all_day, ownerTz, titleOf(r));
      continue;
    }
    const occ = expandWithExceptions(r.start_at, r.end_at, r.recurrence, r.recurrence_until, winFrom, winTo, exceptions.get(r.id), 400, ownerTz);
    for (const o of occ) push(r.account_id, o.start.toISOString(), o.end.toISOString(), !!r.all_day, ownerTz, titleOf(r, o.override?.title));
  }
  return out;
}

/** Ids of these events the viewer could open in Calendar: their own, one
 *  they are invited to, or any when a Super Admin. Private-ness is checked
 *  by the caller. One attendee read; a failure reads as "none invited". */
async function readableEventIds(
  rows: Array<{ id: string; account_id: string; is_private?: boolean | null }>,
  viewer: AwayViewer,
): Promise<Set<string>> {
  const out = new Set<string>();
  const candidates = rows.filter((r) => r.is_private === false);
  const others: string[] = [];
  for (const r of candidates) {
    if (viewer.is_super_admin || r.account_id === viewer.account_id) out.add(r.id);
    else others.push(r.id);
  }
  if (others.length === 0) return out;
  const { data, error } = await supabaseServer
    .from("koleex_calendar_event_attendees")
    .select("event_id")
    .eq("account_id", viewer.account_id)
    .in("event_id", [...new Set(others)].slice(0, 500));
  if (error) {
    console.error("[planning-conflicts] out-of-office attendees:", error.message);
    return out;
  }
  for (const r of (data ?? []) as Array<{ event_id: string }>) out.add(r.event_id);
  return out;
}

/** The 409 body every planning write answers with on a conflict. */
export function conflictBody(r: { conflicts: PlanningConflict[]; total: number }, canOverride: boolean) {
  return { error: "schedule_conflict", conflicts: r.conflicts, total: r.total, can_override: canOverride };
}
