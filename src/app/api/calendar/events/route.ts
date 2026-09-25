import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { expandRecurrence, type CalendarRec } from "@/lib/calendar-recurrence";
import { applyTodoScope, sharedTodoIds, type TodoViewer } from "@/lib/server/todo-scope";
import { sanitizeEventInput } from "@/lib/server/calendar-access";
import { loadDeadlines, loadRequestDeadlines } from "@/lib/server/reports/obligations";
import { reportTemplate } from "@/lib/reports/templates";
import { reportsT } from "@/lib/translations/reports";
import type { CalendarViewEvent } from "@/types/supabase";

/* GET /api/calendar/events?accountId=&from=&to=
   One account's calendar within [from, to): its own events, the occurrences
   of its recurring series, the events it is invited to, and read-only
   mirrors of Planning, To-do, Projects, approved leave and report
   deadlines.

   Calendar is a Type C (personal) module: only the account itself or a
   Super Admin may read it, whatever the role's Scope says. Private events on
   someone else's calendar are hidden unless the role has can_view_private
   (break-glass), in which case the read is audit-logged.

   The sources are independent, so they are fetched together — the
   sequential version cost eight round trips per month view. */

type Row = Record<string, unknown> & {
  id: string;
  start_at: string;
  end_at: string;
  recurrence?: CalendarRec;
  recurrence_until?: string | null;
};

type Window = { from: string; to: string; fromDate: string; toDate: string; winFrom: Date; winTo: Date };

const MUTED = "#9AA0A6";
const DANGER = "#FF3333";
const ACCENT = "#0066FF";

function expandRow(base: Row, w: Window): CalendarViewEvent[] {
  const occ = expandRecurrence(base.start_at, base.end_at, base.recurrence, base.recurrence_until ?? null, w.winFrom, w.winTo);
  return occ.map((o, i) => ({
    ...(base as unknown as CalendarViewEvent),
    id: `${base.id}~${i}`,
    series_base_id: base.id,
    start_at: o.start.toISOString(),
    end_at: o.end.toISOString(),
  }));
}

/** The account's own rows: one-offs in the window plus every series that
 *  could have an occurrence in it, expanded. */
async function ownEvents(auth: ServerAuthContext, accountId: string, viewingOwn: boolean, w: Window): Promise<CalendarViewEvent[]> {
  const hidePrivate = !viewingOwn && !auth.can_view_private;
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

  const [{ data, error }, { data: recRows }] = await Promise.all([oneOff, series]);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CalendarViewEvent[];
  /* Break-glass: a private record read on someone else's calendar is logged. */
  if (!viewingOwn && auth.can_view_private) {
    const privateIds = rows.filter((e) => e.is_private).map((e) => e.id);
    if (privateIds.length > 0) {
      void supabaseServer.from("koleex_private_access_log").insert(
        privateIds.map((id) => ({
          account_id: auth.account_id,
          role_id: auth.role_id,
          module_name: "Calendar",
          record_type: "koleex_calendar_events",
          record_id: id,
          access_reason: null,
        })),
      );
    }
  }
  return [...rows, ...((recRows ?? []) as Row[]).flatMap((r) => expandRow(r, w))];
}

/** Events someone else owns that the viewer is invited to. Own view only. */
async function invitedEvents(auth: ServerAuthContext, accountId: string, w: Window): Promise<CalendarViewEvent[]> {
  const { data: att } = await supabaseServer
    .from("koleex_calendar_event_attendees")
    .select("event_id")
    .eq("account_id", accountId)
    .limit(500);
  const evIds = Array.from(new Set((att ?? []).map((a) => (a as { event_id: string }).event_id)));
  if (evIds.length === 0) return [];
  let q = supabaseServer.from("koleex_calendar_events").select("*").in("id", evIds).neq("account_id", accountId);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data } = await q;
  return ((data ?? []) as Row[]).flatMap((row) => {
    const base = { ...row, invited: true } as Row & { invited: true };
    if (row.recurrence) return expandRow(base, w);
    const s = new Date(row.start_at).getTime();
    const e = new Date(row.end_at).getTime();
    return s < w.winTo.getTime() && e >= w.winFrom.getTime() ? [base as unknown as CalendarViewEvent] : [];
  });
}

/** Published/completed Planning items on the viewer's employee resource. */
async function planningMirror(auth: ServerAuthContext, accountId: string, w: Window): Promise<CalendarViewEvent[]> {
  if (!auth.tenant_id) return [];
  const { data: res } = await supabaseServer
    .from("planning_resources")
    .select("id")
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", accountId)
    .eq("type", "employee")
    .maybeSingle();
  if (!res?.id) return [];
  const { data } = await supabaseServer
    .from("planning_items")
    .select("id, type, title, notes, start_at, end_at, status, linked_entity_label, role:role_id ( name, color )")
    .eq("tenant_id", auth.tenant_id)
    .eq("resource_id", res.id)
    .in("status", ["published", "completed"])
    .gte("end_at", w.from)
    .lt("start_at", w.to);
  return ((data ?? []) as Array<Record<string, unknown>>).map((p) => {
    const r = (p as { role?: { name?: string | null; color?: string | null } | null }).role;
    return mirrorRow({
      id: `planning:${p.id}`,
      accountId, tenantId: auth.tenant_id,
      title: (p.title as string) || `[${p.type}]`,
      description: (p.notes as string | null) ?? null,
      start_at: p.start_at as string,
      end_at: p.end_at as string,
      all_day: false,
      color: r?.color ?? null,
      event_type: "event",
      source: "planning",
      source_kind: p.type as string,
      extra: { role_name: r?.name ?? null, linked_entity_label: (p.linked_entity_label as string | null) ?? null },
    });
  });
}

/** Tasks the CALENDAR's account may see, by the same rule as the To-do list
 *  (lib/server/todo-scope.ts). The viewer for that rule is the calendar's
 *  account, never a super admin: a calendar shows one person's work.
 *  Recurrence templates stay out (only spawned periods surface), and so do
 *  tasks the Calendar itself created from a "task" event — those are
 *  already on the grid as the event. */
async function todoMirror(auth: ServerAuthContext, accountId: string, w: Window): Promise<CalendarViewEvent[]> {
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
  const { data } = await q.limit(1000);
  const today = new Date().toISOString().slice(0, 10);
  return ((data ?? []) as Array<{ id: string; title: string; due_date: string | null; start_date: string | null; status: string | null; completed: boolean }>)
    .flatMap((t) => {
      const span = daySpan(t.start_date, t.due_date, w);
      if (!span) return [];
      const overdue = !t.completed && span.end < today;
      return [mirrorRow({
        id: `todo:${t.id}`,
        accountId, tenantId: auth.tenant_id,
        title: t.title,
        description: null,
        start_at: `${span.start}T00:00:00.000Z`,
        end_at: `${span.end}T23:59:59.999Z`,
        all_day: true,
        color: t.completed ? MUTED : overdue ? DANGER : ACCENT,
        event_type: "task",
        source: "todo",
        source_kind: t.completed ? "done" : overdue ? "overdue" : t.status ?? "todo",
        extra: { todo_id: t.id },
      })];
    });
}

/** Project tasks assigned to the account, on their due date or start→due span. */
async function projectTaskMirror(auth: ServerAuthContext, accountId: string, w: Window): Promise<CalendarViewEvent[]> {
  if (!auth.tenant_id) return [];
  const { data } = await supabaseServer
    .from("project_tasks")
    .select("id, title, due_date, start_date, status, project:project_id ( name, color )")
    .eq("tenant_id", auth.tenant_id)
    .eq("assignee_account_id", accountId)
    .neq("status", "cancelled")
    .limit(1000);
  const today = new Date().toISOString().slice(0, 10);
  return ((data ?? []) as Array<{ id: string; title: string; due_date: string | null; start_date: string | null; status: string; project?: { name?: string | null; color?: string | null } | null }>)
    .flatMap((t) => {
      const span = daySpan(t.start_date, t.due_date, w);
      if (!span) return [];
      const done = t.status === "done";
      const overdue = !done && span.end < today;
      return [mirrorRow({
        id: `ptask:${t.id}`,
        accountId, tenantId: auth.tenant_id,
        title: t.title,
        description: t.project?.name ?? null,
        start_at: `${span.start}T00:00:00.000Z`,
        end_at: `${span.end}T23:59:59.999Z`,
        all_day: true,
        color: done ? MUTED : overdue ? DANGER : t.project?.color ?? ACCENT,
        event_type: "task",
        source: "project",
        source_kind: done ? "done" : overdue ? "overdue" : "open",
        extra: { project_task_id: t.id },
      })];
    });
}

/** APPROVED leave of the employee behind the account, as out-of-office. HR's
 *  record stays the only record; nothing is written to the events table. */
async function leaveMirror(auth: ServerAuthContext, accountId: string, w: Window): Promise<CalendarViewEvent[]> {
  let eq = supabaseServer.from("koleex_employees").select("id").eq("account_id", accountId);
  if (auth.tenant_id) eq = eq.eq("tenant_id", auth.tenant_id);
  const { data: emp } = await eq.limit(1).maybeSingle();
  const employeeId = (emp as { id?: string } | null)?.id ?? null;
  if (!employeeId) return [];
  const { data } = await supabaseServer
    .from("hr_leave_requests")
    .select("id, start_date, end_date, half_day, half_day_period, hr_leave_types(name)")
    .eq("employee_id", employeeId).eq("status", "approved")
    .lte("start_date", w.toDate).gte("end_date", w.fromDate).limit(200);
  return ((data ?? []) as Array<{ id: string; start_date: string; end_date: string; half_day: boolean; half_day_period: string | null; hr_leave_types?: { name?: string } | { name?: string }[] | null }>)
    .map((l) => {
      const t = Array.isArray(l.hr_leave_types) ? l.hr_leave_types[0] : l.hr_leave_types;
      const half = l.half_day && l.half_day_period ? ` (${l.half_day_period})` : "";
      return mirrorRow({
        id: `leave:${l.id}`,
        accountId, tenantId: auth.tenant_id,
        title: `${t?.name ?? "Leave"}${half}`,
        description: null,
        start_at: `${l.start_date}T00:00:00.000Z`,
        end_at: `${l.end_date}T23:59:59.999Z`,
        all_day: true,
        color: null,
        event_type: "out_of_office",
        source: "leave",
        source_kind: "approved",
        extra: { leave_request_id: l.id },
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
async function reportMirror(auth: ServerAuthContext, accountId: string, viewingOwn: boolean, w: Window): Promise<CalendarViewEvent[]> {
  const failed = (what: string) => (e: unknown) => {
    console.error(`[api/calendar/events] ${what}:`, e instanceof Error ? e.message : e);
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
    all_day: false,
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
    all_day: false,
    color: d.state === "sent" || d.state === "late" ? MUTED : d.state === "missing" ? DANGER : ACCENT,
    event_type: "reminder",
    source: "report",
    source_kind: d.state,
    extra: { report_key: d.key, report_date: d.date, report_id: d.reportId || (viewingOwn ? d.draftId : undefined) || undefined },
  }))];
}

/** A dated item's [start, end] as YYYY-MM-DD, or null when it has no date or
 *  misses the window. */
function daySpan(startDate: string | null, dueDate: string | null, w: Window): { start: string; end: string } | null {
  const start = startDate ?? dueDate;
  const end = dueDate ?? startDate;
  if (!start || !end) return null;
  if (!(start <= w.toDate && end >= w.fromDate)) return null;
  return { start, end };
}

function mirrorRow(m: {
  id: string; accountId: string; tenantId: string | null; title: string; description: string | null;
  start_at: string; end_at: string; all_day: boolean; color: string | null;
  event_type: CalendarViewEvent["event_type"]; source: NonNullable<CalendarViewEvent["source"]>; source_kind: string | null;
  extra?: Partial<CalendarViewEvent>;
}): CalendarViewEvent {
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
    all_day: m.all_day,
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

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!accountId || !from || !to) {
    return NextResponse.json({ error: "accountId, from, to are required" }, { status: 400 });
  }
  const winFrom = new Date(from);
  const winTo = new Date(to);
  if (Number.isNaN(winFrom.getTime()) || Number.isNaN(winTo.getTime()) || winTo <= winFrom) {
    return NextResponse.json({ error: "from/to must be ISO timestamps with from < to" }, { status: 400 });
  }
  /* A window bounded to a quarter keeps the series expansion and the mirror
     scans proportional to what a screen can show. */
  if (winTo.getTime() - winFrom.getTime() > 93 * 86_400_000) {
    return NextResponse.json({ error: "window too large" }, { status: 400 });
  }

  const viewingOwn = accountId === auth.account_id;
  if (!viewingOwn && !auth.is_super_admin) {
    return NextResponse.json({ error: "Only a Super Admin can view another account's calendar" }, { status: 403 });
  }

  const w: Window = {
    from: winFrom.toISOString(), to: winTo.toISOString(),
    fromDate: winFrom.toISOString().slice(0, 10), toDate: winTo.toISOString().slice(0, 10),
    winFrom, winTo,
  };

  try {
    const [own, invited, planning, todos, projects, leave, reports] = await Promise.all([
      ownEvents(auth, accountId, viewingOwn, w),
      viewingOwn ? invitedEvents(auth, accountId, w) : Promise.resolve([]),
      viewingOwn ? planningMirror(auth, accountId, w) : Promise.resolve([]),
      todoMirror(auth, accountId, w),
      projectTaskMirror(auth, accountId, w),
      leaveMirror(auth, accountId, w),
      reportMirror(auth, accountId, viewingOwn, w),
    ]);
    return NextResponse.json({ events: [...own, ...invited, ...planning, ...todos, ...projects, ...leave, ...reports] });
  } catch (e) {
    console.error("[api/calendar/events]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

/* POST /api/calendar/events — create an event. Non-SA callers create only on
   their OWN calendar; tenant_id and the server-managed columns come from the
   session, never the body. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Calendar", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

  const targetAccountId = typeof body.account_id === "string" && body.account_id ? body.account_id : auth.account_id;
  if (targetAccountId !== auth.account_id && !auth.is_super_admin) {
    return NextResponse.json({ error: "Cannot create events on another account's calendar" }, { status: 403 });
  }

  const input = sanitizeEventInput(body, "create");
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("koleex_calendar_events")
    .insert({ ...input.row, account_id: targetAccountId, tenant_id: auth.tenant_id })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[api/calendar/events POST]", error.message);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
  return NextResponse.json({ event: data });
}
