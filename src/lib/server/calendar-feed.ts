import "server-only";

/* ---------------------------------------------------------------------------
   calendar-feed — one account's calendar within [from, to): its own events,
   the occurrences of its recurring series, the events it is invited to, and
   read-only mirrors of Planning, To-do, Projects (tasks and milestones),
   leave (approved, and pending as tentative) and report deadlines. Written once; GET /api/calendar/events and the AI agent's
   listMyCalendar both read it, so the assistant sees what the grid shows.

   Access is the CALLER's job (the route answers 403 before calling this for
   someone else's calendar without Super Admin). What this file applies is the
   private-record rule: private events on someone else's calendar are hidden
   unless the role has can_view_private (break-glass), and then logged.

   All-day items are dates. Every all-day item carries start_date / end_date
   (YYYY-MM-DD, end inclusive), taken in the ORGANIZER's timezone for real
   events and as-is for the mirrors (a to-do's due date is already a date).
   start_at / end_at on those items are that span in the calendar owner's
   zone, kept for sorting and older readers only.

   A series is expanded with its "this occurrence only" exceptions
   (lib/server/calendar-exceptions): a skipped occurrence is gone, an
   overridden one carries its own title / time / place / link / notes. Every
   occurrence says which it is (`occurrence_start` = its original start, the
   key such a change is stored under) and has a STABLE id `<base>~<ms of that
   start>`, the same whichever window it was read in.

   The sources are independent, so they are fetched together.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import { expandWithExceptions, type CalendarRec } from "@/lib/calendar-recurrence";
import { loadExceptions } from "@/lib/server/calendar-exceptions";
import { involvedProjectsOr } from "@/lib/server/project-access";
import { allDayKeys, zonedDateKey, zonedToUtc } from "@/lib/calendar-tz";
import { applyTodoScope, sharedTodoIds, type TodoViewer } from "@/lib/server/todo-scope";
import { logPrivateCalendarReads } from "@/lib/server/calendar-access";
import { accountTimezone, accountTimezones } from "@/lib/server/calendar-notify";
import { loadDeadlines, loadRequestDeadlines } from "@/lib/server/reports/obligations";
import { reportTemplate } from "@/lib/reports/templates";
import { reportsT } from "@/lib/translations/reports";
import { HUB, STATUS } from "@/components/kds/colors";
import type { CalendarAttendeeStatus } from "@/types/supabase";
import type { BusyBlock, CalendarEventException, CalendarFeedEvent } from "@/lib/calendar-types";

type Row = Record<string, unknown> & {
  id: string;
  account_id: string;
  start_at: string;
  end_at: string;
  all_day?: boolean | null;
  is_private?: boolean | null;
  recurrence?: CalendarRec;
  recurrence_until?: string | null;
};

export interface FeedWindow {
  from: string;
  to: string;
  fromDate: string;
  toDate: string;
  winFrom: Date;
  winTo: Date;
}

export function feedWindow(winFrom: Date, winTo: Date): FeedWindow {
  return {
    from: winFrom.toISOString(), to: winTo.toISOString(),
    fromDate: winFrom.toISOString().slice(0, 10), toDate: winTo.toISOString().slice(0, 10),
    winFrom, winTo,
  };
}

const MUTED = "#9AA0A6";
const DANGER = STATUS.error;
const ACCENT = HUB.steel;

/** An all-day real event gets its dates, read in its organizer's zone. */
function withDates(e: CalendarFeedEvent, tz: string): CalendarFeedEvent {
  if (!e.all_day) return e;
  const k = allDayKeys(e.start_at, e.end_at, tz);
  return { ...e, start_date: k.start, end_date: k.end };
}

function expandRow(base: Row, w: FeedWindow, tz: string, exceptions?: CalendarEventException[]): CalendarFeedEvent[] {
  const occ = expandWithExceptions(base.start_at, base.end_at, base.recurrence, base.recurrence_until ?? null, w.winFrom, w.winTo, exceptions, 400, tz);
  return occ.map((o) => {
    const ov = o.override;
    return withDates({
      ...(base as unknown as CalendarFeedEvent),
      id: `${base.id}~${o.original.getTime()}`,
      series_base_id: base.id,
      occurrence_start: o.original.toISOString(),
      start_at: o.start.toISOString(),
      end_at: o.end.toISOString(),
      ...(ov ? {
        overridden: true,
        ...(ov.title ? { title: ov.title } : {}),
        /* '' = none for this occurrence; NULL = as the series. */
        ...(ov.location != null ? { location: ov.location || null } : {}),
        ...(ov.meeting_url != null ? { meeting_url: ov.meeting_url || null } : {}),
        ...(ov.description != null ? { description: ov.description || null } : {}),
      } : {}),
    }, tz);
  });
}

/** The account's own rows: one-offs in the window plus every series that
 *  could have an occurrence in it, expanded on the organizer's clock. */
async function ownEvents(
  auth: ServerAuthContext, accountId: string, viewingOwn: boolean, w: FeedWindow, tz: string,
  opts: { includePrivate?: boolean } = {},
): Promise<CalendarFeedEvent[]> {
  /* includePrivate: the free/busy view counts private time as busy but never
     shows it (the caller strips titles) — nothing private is disclosed, so
     nothing is logged. */
  const hidePrivate = !opts.includePrivate && !viewingOwn && !auth.can_view_private;
  const logPrivate = !opts.includePrivate;
  let oneOff = supabaseServer
    .from("koleex_calendar_events")
    .select("*")
    .eq("account_id", accountId)
    .is("recurrence", null)
    .lt("start_at", w.to)
    .gte("end_at", w.from)
    .order("start_at", { ascending: true });
  let series = supabaseServer
    .from("koleex_calendar_events")
    .select("*")
    .eq("account_id", accountId)
    .not("recurrence", "is", null)
    .lte("start_at", w.to)
    .or(`recurrence_until.is.null,recurrence_until.gte.${w.fromDate}`);
  if (auth.tenant_id) { oneOff = oneOff.eq("tenant_id", auth.tenant_id); series = series.eq("tenant_id", auth.tenant_id); }
  if (hidePrivate) { oneOff = oneOff.eq("is_private", false); series = series.eq("is_private", false); }

  const [{ data, error }, { data: recRows, error: recErr }] = await Promise.all([oneOff, series]);
  if (error) throw new Error(error.message);
  if (recErr) throw new Error(recErr.message);

  const rows = (data ?? []) as Row[];
  const seriesRows = (recRows ?? []) as Row[];
  if (!viewingOwn && auth.can_view_private && logPrivate) {
    logPrivateCalendarReads(auth, [...rows, ...seriesRows].filter((e) => e.is_private).map((e) => e.id));
  }
  const exceptions = await loadExceptions(seriesRows.map((r) => r.id));
  return [
    ...rows.map((r) => withDates(r as unknown as CalendarFeedEvent, tz)),
    ...seriesRows.flatMap((r) => expandRow(r, w, tz, exceptions.get(r.id))),
  ];
}

const INVITED_COLS = "*, koleex_calendar_event_attendees!inner(status)";

/** Events someone else owns that the viewer is invited to, bounded to the
 *  window in SQL (one-offs by overlap, series by start and end date). A
 *  declined invitation stays on the grid, marked, so it can be re-answered. */
async function invitedEvents(auth: ServerAuthContext, accountId: string, w: FeedWindow): Promise<CalendarFeedEvent[]> {
  let oneOff = supabaseServer
    .from("koleex_calendar_events")
    .select(INVITED_COLS)
    .eq("koleex_calendar_event_attendees.account_id", accountId)
    .neq("account_id", accountId)
    .is("recurrence", null)
    .lt("start_at", w.to)
    .gte("end_at", w.from)
    .limit(500);
  let series = supabaseServer
    .from("koleex_calendar_events")
    .select(INVITED_COLS)
    .eq("koleex_calendar_event_attendees.account_id", accountId)
    .neq("account_id", accountId)
    .not("recurrence", "is", null)
    .lte("start_at", w.to)
    .or(`recurrence_until.is.null,recurrence_until.gte.${w.fromDate}`)
    .limit(500);
  if (auth.tenant_id) { oneOff = oneOff.eq("tenant_id", auth.tenant_id); series = series.eq("tenant_id", auth.tenant_id); }
  const [a, b] = await Promise.all([oneOff, series]);
  if (a.error || b.error) {
    console.error("[calendar-feed] invited:", a.error?.message ?? b.error?.message);
    return [];
  }
  const rows = [...(a.data ?? []), ...(b.data ?? [])] as Array<Row & { koleex_calendar_event_attendees?: Array<{ status: CalendarAttendeeStatus }> | { status: CalendarAttendeeStatus } | null }>;
  if (rows.length === 0) return [];
  const [tzs, exceptions] = await Promise.all([
    accountTimezones(rows.map((r) => r.account_id)),
    loadExceptions(rows.filter((r) => r.recurrence).map((r) => r.id)),
  ]);
  return rows.flatMap((row) => {
    const { koleex_calendar_event_attendees: att, ...rest } = row;
    const status = (Array.isArray(att) ? att[0]?.status : att?.status) ?? "invited";
    const base = { ...rest, invited: true, invite_status: status } as Row;
    const tz = tzs.get(row.account_id) ?? "UTC";
    if (row.recurrence) return expandRow(base, w, tz, exceptions.get(row.id));
    return [withDates(base as unknown as CalendarFeedEvent, tz)];
  });
}

/** Published/completed Planning items on the viewer's employee resource. */
async function planningMirror(auth: ServerAuthContext, accountId: string, w: FeedWindow): Promise<CalendarFeedEvent[]> {
  if (!auth.tenant_id) return [];
  const { data, error } = await supabaseServer
    .from("planning_items")
    .select("id, type, title, notes, start_at, end_at, status, linked_entity_label, role:role_id ( name, color ), resource:resource_id!inner ( account_id, type )")
    .eq("tenant_id", auth.tenant_id)
    .eq("resource.account_id", accountId)
    .eq("resource.type", "employee")
    .in("status", ["published", "completed"])
    .gte("end_at", w.from)
    .lt("start_at", w.to);
  if (error) { console.error("[calendar-feed] planning:", error.message); return []; }
  return ((data ?? []) as Array<Record<string, unknown>>).map((p) => {
    const r = (p as { role?: { name?: string | null; color?: string | null } | null }).role;
    return mirrorRow({
      id: `planning:${p.id}`,
      accountId, tenantId: auth.tenant_id,
      title: (p.title as string) || "",
      description: (p.notes as string | null) ?? null,
      start_at: p.start_at as string,
      end_at: p.end_at as string,
      color: r?.color ?? null,
      event_type: "event",
      source: "planning",
      source_kind: p.type as string,
      extra: {
        role_name: r?.name ?? null,
        linked_entity_label: (p.linked_entity_label as string | null) ?? null,
        planning_item_id: String(p.id),
        planning_type: (p.type as string | null) ?? null,
      },
    });
  });
}

/** Tasks the CALENDAR's account may see, by the same rule as the To-do list
 *  (lib/server/todo-scope.ts). The viewer for that rule is the calendar's
 *  account, never a super admin: a calendar shows one person's work.
 *  Recurrence templates stay out (only spawned periods surface), and so do
 *  tasks the Calendar itself created from a "task" event — those are
 *  already on the grid as the event. */
async function todoMirror(auth: ServerAuthContext, accountId: string, w: FeedWindow, tz: string): Promise<CalendarFeedEvent[]> {
  if (!auth.tenant_id) return [];
  const own = accountId === auth.account_id;
  const viewer: TodoViewer = {
    accountId,
    tenantId: auth.tenant_id,
    department: own ? auth.department : null,
    isSuperAdmin: false,
    canViewPrivate: own ? auth.can_view_private : false,
  };
  const shared = await sharedTodoIds(viewer);
  let q = supabaseServer
    .from("koleex_todos")
    .select("id, title, due_date, start_date, status, completed")
    .eq("tenant_id", auth.tenant_id)
    .is("recurrence", null)
    .neq("source", "calendar")
    .or(`start_date.lte.${w.toDate},due_date.lte.${w.toDate}`)
    .or(`due_date.gte.${w.fromDate},start_date.gte.${w.fromDate}`);
  q = applyTodoScope(q, viewer, shared);
  const { data } = await q.order("due_date", { ascending: true }).limit(1000);
  const today = todayKey(tz);
  return ((data ?? []) as Array<{ id: string; title: string; due_date: string | null; start_date: string | null; status: string | null; completed: boolean }>)
    .flatMap((t) => {
      const span = daySpan(t.start_date, t.due_date, w);
      if (!span) return [];
      const overdue = !t.completed && span.end < today;
      return [allDayMirror(span, tz, {
        id: `todo:${t.id}`,
        accountId, tenantId: auth.tenant_id,
        title: t.title,
        description: null,
        color: t.completed ? MUTED : overdue ? DANGER : ACCENT,
        event_type: "task",
        source: "todo",
        source_kind: t.completed ? "done" : overdue ? "overdue" : t.status ?? "todo",
        extra: { todo_id: t.id },
      })];
    });
}

/** Project tasks assigned to the account, on their due date or start→due
 *  span, bounded to the window in SQL. */
async function projectTaskMirror(auth: ServerAuthContext, accountId: string, w: FeedWindow, tz: string): Promise<CalendarFeedEvent[]> {
  if (!auth.tenant_id) return [];
  const { data } = await supabaseServer
    .from("project_tasks")
    .select("id, title, due_date, start_date, status, project_id, project:project_id ( name, color )")
    .eq("tenant_id", auth.tenant_id)
    .eq("assignee_account_id", accountId)
    .neq("status", "cancelled")
    .or(`start_date.lte.${w.toDate},due_date.lte.${w.toDate}`)
    .or(`due_date.gte.${w.fromDate},start_date.gte.${w.fromDate}`)
    .order("due_date", { ascending: true })
    .limit(1000);
  const today = todayKey(tz);
  return ((data ?? []) as Array<{ id: string; title: string; due_date: string | null; start_date: string | null; status: string; project_id: string | null; project?: { name?: string | null; color?: string | null } | null }>)
    .flatMap((t) => {
      const span = daySpan(t.start_date, t.due_date, w);
      if (!span) return [];
      const done = t.status === "done";
      const overdue = !done && span.end < today;
      return [allDayMirror(span, tz, {
        id: `ptask:${t.id}`,
        accountId, tenantId: auth.tenant_id,
        title: t.title,
        description: t.project?.name ?? null,
        color: done ? MUTED : overdue ? DANGER : t.project?.color ?? ACCENT,
        event_type: "task",
        source: "project",
        source_kind: done ? "done" : overdue ? "overdue" : "open",
        extra: { project_task_id: t.id, project_id: t.project_id },
      })];
    });
}

/** Milestones of the projects the calendar's account is involved in — the
 *  Projects list rule (lib/server/project-access involvedProjectsOr:
 *  manager, creator, or assignee of a task in it), never wider, so nothing
 *  the account could not open in Projects appears here. Templates stay out.
 *  All-day on the due date; a reached milestone is muted. */
async function milestoneMirror(auth: ServerAuthContext, accountId: string, w: FeedWindow, tz: string): Promise<CalendarFeedEvent[]> {
  if (!auth.tenant_id) return [];
  try {
    const or = await involvedProjectsOr(auth.tenant_id, accountId);
    const { data: projects, error: pErr } = await supabaseServer
      .from("projects")
      .select("id, name, color, is_template")
      .eq("tenant_id", auth.tenant_id)
      .or(or)
      .limit(500);
    if (pErr) { console.error("[calendar-feed] milestones/projects:", pErr.message); return []; }
    const list = ((projects ?? []) as Array<{ id: string; name: string | null; color: string | null; is_template?: boolean | null }>).filter((p) => !p.is_template);
    if (list.length === 0) return [];
    const byId = new Map(list.map((p) => [p.id, p]));
    const { data, error } = await supabaseServer
      .from("project_milestones")
      .select("id, project_id, name, due_date, is_reached, color")
      .eq("tenant_id", auth.tenant_id)
      .in("project_id", list.map((p) => p.id))
      .gte("due_date", w.fromDate)
      .lte("due_date", w.toDate)
      .limit(500);
    if (error) { console.error("[calendar-feed] milestones:", error.message); return []; }
    return ((data ?? []) as Array<{ id: string; project_id: string; name: string; due_date: string | null; is_reached: boolean | null; color: string | null }>)
      .flatMap((m) => {
        if (!m.due_date) return [];
        const day = String(m.due_date).slice(0, 10);
        const project = byId.get(m.project_id);
        return [allDayMirror({ start: day, end: day }, tz, {
          id: `milestone:${m.id}`,
          accountId, tenantId: auth.tenant_id,
          title: m.name,
          description: project?.name ?? null,
          color: m.is_reached ? MUTED : m.color || project?.color || ACCENT,
          event_type: "event",
          source: "project",
          source_kind: m.is_reached ? "milestone_reached" : "milestone",
          extra: { project_id: m.project_id, milestone_id: m.id },
        })];
      });
  } catch (e) {
    console.error("[calendar-feed] milestones:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** APPROVED leave of the employee behind the account, as out-of-office, and
 *  PENDING leave as tentative (source_kind "pending" — the views draw it
 *  dashed). HR's record stays the only record; nothing is written to the
 *  events table.
 *  The title is the leave type's own name ("" when it has none — the views
 *  word it); a half day carries its period for the views to translate. */
async function leaveMirror(auth: ServerAuthContext, accountId: string, w: FeedWindow, tz: string): Promise<CalendarFeedEvent[]> {
  let q = supabaseServer
    .from("hr_leave_requests")
    .select("id, status, start_date, end_date, half_day, half_day_period, hr_leave_types(name), employee:employee_id!inner ( account_id, tenant_id )")
    .eq("employee.account_id", accountId)
    .in("status", ["approved", "pending"])
    .lte("start_date", w.toDate).gte("end_date", w.fromDate).limit(200);
  if (auth.tenant_id) q = q.eq("employee.tenant_id", auth.tenant_id);
  const { data, error } = await q;
  if (error) { console.error("[calendar-feed] leave:", error.message); return []; }
  return ((data ?? []) as Array<{ id: string; status: string; start_date: string; end_date: string; half_day: boolean; half_day_period: string | null; hr_leave_types?: { name?: string } | { name?: string }[] | null }>)
    .map((l) => {
      const t = Array.isArray(l.hr_leave_types) ? l.hr_leave_types[0] : l.hr_leave_types;
      return allDayMirror({ start: String(l.start_date).slice(0, 10), end: String(l.end_date).slice(0, 10) }, tz, {
        id: `leave:${l.id}`,
        accountId, tenantId: auth.tenant_id,
        title: t?.name ?? "",
        description: null,
        color: null,
        event_type: "out_of_office",
        source: "leave",
        source_kind: l.status === "pending" ? "pending" : "approved",
        extra: { leave_request_id: l.id, half_day_period: l.half_day ? l.half_day_period ?? null : null },
      });
    });
}

/** The account's report deadlines (Reports Phase 3C, owner's pick 25 Sep
 *  2026: every report, the daily on each working day), each at its moment on
 *  the person's own clock — sent, missing or still to write. Computed from
 *  the obligation rules, never stored; nothing before tracking starts. A
 *  failure here leaves the rest of the calendar standing. The Calendar words
 *  the title in the viewer's language; the English one is the fallback. A
 *  draft is only ever its author's to open, so its id rides on their own
 *  calendar only. */
async function reportMirror(auth: ServerAuthContext, accountId: string, viewingOwn: boolean, w: FeedWindow): Promise<CalendarFeedEvent[]> {
  const failed = (what: string) => (e: unknown) => {
    console.error(`[calendar-feed] ${what}:`, e instanceof Error ? e.message : e);
    return [];
  };
  const [items, asked] = await Promise.all([
    loadDeadlines(auth.tenant_id, accountId, w.from, w.to).catch(failed("report deadlines")),
    loadRequestDeadlines(accountId, w.from, w.to).catch(failed("report requests")),
  ]);
  const color = (state: string) => state === "sent" || state === "late" ? MUTED : state === "missing" ? DANGER : ACCENT;
  /* What events asked for (Phase 3D) sits beside the routine reports, named
     with what it is about. A confidential one (a probation review) is never
     linked from someone else's calendar. */
  const requests = asked.map((r) => mirrorRow({
    id: `request:${r.id}`,
    accountId, tenantId: auth.tenant_id,
    title: `${(reportsT[`tpl.${r.template_key}.name`]?.en as string | undefined) ?? "Report"} · ${r.subject}`,
    description: null,
    start_at: r.due_at,
    end_at: new Date(Date.parse(r.due_at) + 30 * 60_000).toISOString(),
    color: color(r.state),
    event_type: "reminder",
    source: "report",
    source_kind: r.state,
    extra: {
      report_key: r.template_key, report_date: String(r.event_day).slice(0, 10), report_request: r.id, report_subject: r.subject,
      report_id: (viewingOwn || !reportTemplate(r.template_key)?.confidential ? r.report_id : null) || (viewingOwn ? r.draftId : undefined) || undefined,
    },
  }));
  return [...requests, ...items.map((d) => mirrorRow({
    id: `report:${d.key}:${d.periodKey}`,
    accountId, tenantId: auth.tenant_id,
    title: (reportsT[`tpl.${d.key}.name`]?.en as string | undefined) ?? "Report",
    description: null,
    start_at: d.dueAt,
    end_at: new Date(Date.parse(d.dueAt) + 30 * 60_000).toISOString(),
    color: color(d.state),
    event_type: "reminder",
    source: "report",
    source_kind: d.state,
    extra: { report_key: d.key, report_date: d.date, report_id: d.reportId || (viewingOwn ? d.draftId : undefined) || undefined },
  }))];
}

function todayKey(tz: string): string {
  return zonedDateKey(Date.now(), tz);
}

/** A dated item's [start, end] as YYYY-MM-DD, or null when it has no date or
 *  misses the window. Either column may be a timestamptz — only the date
 *  part is used, so the span is never an invalid date. */
function daySpan(startDate: string | null, dueDate: string | null, w: FeedWindow): { start: string; end: string } | null {
  const s = startDate ? String(startDate).slice(0, 10) : null;
  const d = dueDate ? String(dueDate).slice(0, 10) : null;
  const start = s ?? d;
  let end = d ?? s;
  if (!start || !end) return null;
  if (end < start) end = start;
  if (!(start <= w.toDate && end >= w.fromDate)) return null;
  return { start, end };
}

type MirrorInput = {
  id: string; accountId: string; tenantId: string | null; title: string; description: string | null;
  color: string | null;
  event_type: CalendarFeedEvent["event_type"]; source: NonNullable<CalendarFeedEvent["source"]>; source_kind: string | null;
  extra?: Partial<CalendarFeedEvent>;
};

/** An all-day mirror: its dates, plus the same span as instants in the
 *  calendar owner's zone for sorting and older readers. */
function allDayMirror(span: { start: string; end: string }, tz: string, m: MirrorInput): CalendarFeedEvent {
  const [sy, sm, sd] = span.start.split("-").map(Number);
  const [ey, em, ed] = span.end.split("-").map(Number);
  return {
    ...mirrorRow({
      ...m,
      start_at: new Date(zonedToUtc(sy, sm, sd, 0, 0, 0, 0, tz)).toISOString(),
      end_at: new Date(zonedToUtc(ey, em, ed, 23, 59, 59, 999, tz)).toISOString(),
    }, true),
    start_date: span.start,
    end_date: span.end,
  };
}

function mirrorRow(m: MirrorInput & { start_at: string; end_at: string }, allDay = false): CalendarFeedEvent {
  const now = new Date(0).toISOString();
  return {
    id: m.id,
    account_id: m.accountId,
    tenant_id: m.tenantId,
    title: m.title,
    description: m.description,
    location: null,
    start_at: m.start_at,
    end_at: m.end_at,
    all_day: allDay,
    event_type: m.event_type,
    color: m.color,
    is_private: false,
    created_at: now,
    updated_at: now,
    source: m.source,
    source_kind: m.source_kind,
    ...(m.extra ?? {}),
  };
}

/** Everything on one account's calendar in the window. Throws when the
 *  account's own events cannot be read (the rest degrade to empty). */
export async function loadCalendarFeed(
  auth: ServerAuthContext,
  accountId: string,
  w: FeedWindow,
): Promise<CalendarFeedEvent[]> {
  const viewingOwn = accountId === auth.account_id;
  const tz = await accountTimezone(accountId);
  const [own, invited, planning, todos, projects, milestones, leave, reports] = await Promise.all([
    ownEvents(auth, accountId, viewingOwn, w, tz),
    viewingOwn ? invitedEvents(auth, accountId, w) : Promise.resolve([]),
    viewingOwn ? planningMirror(auth, accountId, w) : Promise.resolve([]),
    todoMirror(auth, accountId, w, tz),
    projectTaskMirror(auth, accountId, w, tz),
    milestoneMirror(auth, accountId, w, tz),
    leaveMirror(auth, accountId, w, tz),
    reportMirror(auth, accountId, viewingOwn, w),
  ]);
  return [...own, ...invited, ...planning, ...todos, ...projects, ...milestones, ...leave, ...reports];
}

/** One account's BUSY time in the window, for the free/busy view of the
 *  event editor: its own events (private ones too — as time only), the
 *  events it is invited to and has not declined (an unanswered invitation
 *  is tentative), each series with its exceptions, and leave (pending =
 *  tentative). Mirrors that are not time (to-dos, tasks, deadlines) are not
 *  busy.
 *
 *  Titles are the CALLER's to see only when the caller could open the event
 *  itself: not private, and the caller organizes it, is invited to it, or is
 *  a Super Admin. Private time never carries a title. The caller checks that
 *  the account is a colleague in the tenant before calling. */
export async function loadBusyBlocks(
  auth: ServerAuthContext,
  accountId: string,
  w: FeedWindow,
): Promise<BusyBlock[]> {
  const tz = await accountTimezone(accountId);
  const [own, invited, leave] = await Promise.all([
    ownEvents(auth, accountId, false, w, tz, { includePrivate: true }),
    invitedEvents(auth, accountId, w),
    leaveMirror(auth, accountId, w, tz),
  ]);
  const events = [...own, ...invited.filter((e) => e.invite_status !== "declined")];

  /* Which of these the caller is a guest of — one read. */
  const baseIds = Array.from(new Set(events.map((e) => e.series_base_id ?? e.id)));
  const callerInvited = new Set<string>();
  if (baseIds.length && accountId !== auth.account_id) {
    const { data } = await supabaseServer
      .from("koleex_calendar_event_attendees")
      .select("event_id")
      .eq("account_id", auth.account_id)
      .in("event_id", baseIds.slice(0, 500));
    for (const r of (data ?? []) as Array<{ event_id: string }>) callerInvited.add(r.event_id);
  }
  const titleFor = (e: CalendarFeedEvent): string | undefined => {
    if (e.is_private) return undefined;
    const base = e.series_base_id ?? e.id;
    const mayRead = e.account_id === auth.account_id || callerInvited.has(base) || auth.is_super_admin;
    return mayRead ? e.title || undefined : undefined;
  };

  const out: BusyBlock[] = events.map((e) => ({
    start: e.start_at,
    end: e.end_at,
    ...(e.all_day ? { all_day: true, start_date: e.start_date, end_date: e.end_date } : {}),
    kind: "event" as const,
    ...(e.invite_status === "invited" ? { tentative: true } : {}),
    ...(titleFor(e) ? { title: titleFor(e) } : {}),
  }));
  for (const l of leave) {
    out.push({
      start: l.start_at, end: l.end_at, all_day: true, start_date: l.start_date, end_date: l.end_date,
      kind: "leave", ...(l.source_kind === "pending" ? { tentative: true } : {}),
    });
  }
  return out.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
