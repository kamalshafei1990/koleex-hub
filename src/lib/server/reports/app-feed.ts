import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the author's own work in the apps, around a draft's
   period (Phase 2B). Raw facts only (AppRecord); which calendar day each
   falls on and how it reads is decided in the browser (src/lib/reports/
   app-feed.ts), because only there is the author's clock known.

   EVERY read is the VIEWER's own: each query is pinned to auth.account_id
   (the organiser / attendee / assignee / creator column of that app), and
   an app is read only when the viewer holds its module (requireModuleAccess
   — the same gate the app's own list uses). The callers already made sure
   the viewer is the author of a draft. What "mine" means per app (mapped
   25/09/2026):
     calendar   events.account_id + attendee rows (declined left out);
                repeating events expanded in the window with their
                "this occurrence only" changes (expandWithExceptions)
     to-do      assigned to me, or created by me and not handed to anyone
     projects   project_tasks.assignee_account_id
     planning   items on my own planning resources (published / completed)
     documents  quotations.created_by · invoices.created_by_account_id ·
                orders.created_by
     customers  crm_activities.assignee_account_id
   A source that fails logs and returns nothing — a report must open even
   when one app is down.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAccess, type ServerAuthContext } from "@/lib/server/auth";
import { expandWithExceptions, type CalendarRec } from "@/lib/calendar-recurrence";
import { loadExceptions } from "@/lib/server/calendar-exceptions";
import { accountTimezones } from "@/lib/server/calendar-notify";
import { feedSources, feedWindow, type AppRecord, type AppSource } from "@/lib/reports/app-feed";
import { periodFor, type ReportPeriod } from "@/lib/reports/templates";
import { templateOf } from "@/lib/reports/custom-templates";

export const FEED_MODULE: Record<AppSource, string> = {
  calendar: "Calendar", todos: "To-do", tasks: "Projects", planning: "Planning",
  quotations: "Quotations", invoices: "Invoices", orders: "Orders", crm: "CRM",
};
const LIMIT = 60;
/** How far back an OPEN item still counts as "still open and due". */
const OPEN_LOOKBACK_DAYS = 30;
/** Not meetings: the calendar's own reminders, tasks (they live in To-do
 *  too), holidays and leave. */
const NOT_MEETINGS = new Set(["reminder", "task", "holiday", "out_of_office"]);

type Ctx = { me: string; from: string; to: string; fromDate: string; toDate: string; openFrom: string; openFromDate: string };
type Loader = (c: Ctx) => Promise<AppRecord[]>;

const name = (v: unknown): string | null => {
  const o = (Array.isArray(v) ? v[0] : v) as { company_name?: string | null; name?: string | null; display_name?: string | null } | null | undefined;
  return (o?.company_name || o?.display_name || o?.name || "").trim() || null;
};
const rows = <T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] => {
  if (res.error) { console.error(`[reports] feed ${what}:`, res.error.message); return []; }
  return (res.data ?? []) as T[];
};

type EventRow = { id: string; account_id: string; title: string | null; start_at: string; end_at: string; all_day: boolean | null; event_type: string | null; recurrence: CalendarRec; recurrence_until: string | null };
const EVENT_COLS = "id, account_id, title, start_at, end_at, all_day, event_type, recurrence, recurrence_until";

const calendar: Loader = async (c) => {
  const [own, series, invites] = await Promise.all([
    supabaseServer.from("koleex_calendar_events").select(EVENT_COLS).eq("account_id", c.me).is("recurrence", null)
      .lt("start_at", c.to).gte("end_at", c.from).limit(LIMIT),
    supabaseServer.from("koleex_calendar_events").select(EVENT_COLS).eq("account_id", c.me).not("recurrence", "is", null)
      .lte("start_at", c.to).or(`recurrence_until.is.null,recurrence_until.gte.${c.fromDate}`).limit(LIMIT),
    supabaseServer.from("koleex_calendar_event_attendees").select("event_id").eq("account_id", c.me).neq("status", "declined")
      .order("created_at", { ascending: false }).limit(150),
  ]);
  const invitedIds = rows<{ event_id: string }>(invites, "invites").map((r) => r.event_id);
  const invited = invitedIds.length
    ? rows<EventRow>(await supabaseServer.from("koleex_calendar_events").select(EVENT_COLS).in("id", invitedIds).neq("account_id", c.me).limit(LIMIT), "invited")
    : [];
  const from = new Date(c.from), to = new Date(c.to);
  const all = [...rows<EventRow>(own, "events"), ...rows<EventRow>(series, "series"), ...invited].filter((e) => !NOT_MEETINGS.has(e.event_type ?? ""));
  /* A series runs on its organizer's clock, with its "this occurrence only"
     changes (one read for every series). */
  const repeating = all.filter((e) => e.recurrence);
  const [tzs, exceptions] = await Promise.all([
    accountTimezones(repeating.map((e) => e.account_id)),
    loadExceptions(repeating.map((e) => e.id)),
  ]);
  const out: AppRecord[] = [];
  for (const e of all) {
    const base = { source: "calendar" as const, state: "scheduled" as const, allDay: !!e.all_day, title: (e.title ?? "").trim() };
    if (e.recurrence) {
      /* The id is the occurrence's original start, stable whatever else of
         the series was deleted or moved. */
      expandWithExceptions(e.start_at, e.end_at, e.recurrence, e.recurrence_until, from, to, exceptions.get(e.id), 400, tzs.get(e.account_id) ?? "UTC").forEach((o) =>
        out.push({ ...base, ...(o.override?.title ? { title: o.override.title.trim() } : {}), id: `${e.id}~${o.original.getTime()}`, at: o.start.toISOString(), end: o.end.toISOString() }));
    } else if (e.start_at < c.to && e.end_at >= c.from) {
      out.push({ ...base, id: e.id, at: e.start_at, end: e.end_at });
    }
  }
  return out;
};

type TodoRow = { id: string; title: string | null; completed: boolean; completed_at: string | null; due_date: string | null; recurrence: string | null; recurrence_parent_id: string | null };
const todos: Loader = async (c) => {
  const assigned = rows<{ todo_id: string }>(await supabaseServer.from("koleex_todo_assignees").select("todo_id")
    .eq("account_id", c.me).order("assigned_at", { ascending: false }).limit(150), "todo assignees").map((r) => r.todo_id);
  const mine = assigned.length
    ? `id.in.(${assigned.join(",")}),and(created_by_account_id.eq.${c.me},assigned_by_account_id.is.null)`
    : `and(created_by_account_id.eq.${c.me},assigned_by_account_id.is.null)`;
  const cols = "id, title, completed, completed_at, due_date, recurrence, recurrence_parent_id";
  const [done, open] = await Promise.all([
    supabaseServer.from("koleex_todos").select(cols).or(mine).eq("completed", true)
      .gte("completed_at", c.from).lt("completed_at", c.to).limit(LIMIT),
    supabaseServer.from("koleex_todos").select(cols).or(mine).eq("completed", false).not("due_date", "is", null)
      .gte("due_date", c.openFrom).lt("due_date", c.to).order("due_date", { ascending: true }).limit(LIMIT),
  ]);
  /* A repeating to-do's template row is not a task anyone does. */
  const real = (r: TodoRow) => !(r.recurrence && !r.recurrence_parent_id) && !!(r.title ?? "").trim();
  return [
    ...rows<TodoRow>(done, "todos done").filter(real).map((r) => ({ source: "todos" as const, id: r.id, state: "done" as const, at: r.completed_at!, title: r.title!.trim() })),
    /* A to-do's due date is a DAY stored as midnight UTC (timestamptz): read
       as a day — as a moment it showed "08:00" in Shanghai, and a day early
       west of Greenwich. */
    ...rows<TodoRow>(open, "todos open").filter(real).map((r) => ({ source: "todos" as const, id: r.id, state: "open" as const, at: r.due_date!.slice(0, 10), title: r.title!.trim() })),
  ];
};

type TaskRow = { id: string; title: string | null; closed_at: string | null; due_date: string | null; project: unknown };
const tasks: Loader = async (c) => {
  const cols = "id, title, closed_at, due_date, project:project_id(name)";
  const [done, open] = await Promise.all([
    supabaseServer.from("project_tasks").select(cols).eq("assignee_account_id", c.me).eq("status", "done")
      .gte("closed_at", c.from).lt("closed_at", c.to).limit(LIMIT),
    supabaseServer.from("project_tasks").select(cols).eq("assignee_account_id", c.me).eq("status", "open").not("due_date", "is", null)
      .gte("due_date", c.openFromDate).lte("due_date", c.toDate).order("due_date", { ascending: true }).limit(LIMIT),
  ]);
  const ok = (r: TaskRow) => !!(r.title ?? "").trim();
  return [
    ...rows<TaskRow>(done, "tasks done").filter(ok).map((r) => ({ source: "tasks" as const, id: r.id, state: "done" as const, at: r.closed_at!, title: r.title!.trim(), who: name(r.project) })),
    ...rows<TaskRow>(open, "tasks open").filter(ok).map((r) => ({ source: "tasks" as const, id: r.id, state: "open" as const, at: String(r.due_date).slice(0, 10), title: r.title!.trim(), who: name(r.project) })),
  ];
};

type PlanRow = { id: string; title: string | null; type: string | null; status: string; start_at: string };
const planning: Loader = async (c) => {
  const res = rows<{ id: string }>(await supabaseServer.from("planning_resources").select("id").eq("account_id", c.me).eq("type", "employee").limit(10), "planning resources").map((r) => r.id);
  if (!res.length) return [];
  const items = rows<PlanRow>(await supabaseServer.from("planning_items").select("id, title, type, status, start_at")
    .in("resource_id", res).in("status", ["published", "completed"]).gte("end_at", c.from).lt("start_at", c.to).limit(LIMIT), "planning items");
  return items.map((r) => ({ source: "planning" as const, id: r.id, state: r.status === "completed" ? "done" as const : "open" as const, at: r.start_at, title: (r.title ?? "").trim() || (r.type ?? "").trim() })).filter((r) => r.title);
};

const quotations: Loader = async (c) => {
  const list = rows<{ id: string; quote_no: string | null; created_at: string; doc_customer: string | null; customer: unknown }>(await supabaseServer.from("quotations")
    .select("id, quote_no, created_at, doc_customer:doc->>customerName, customer:customer_id(name, company_name)")
    .eq("created_by", c.me).gte("created_at", c.from).lt("created_at", c.to).order("created_at", { ascending: true }).limit(LIMIT), "quotations");
  return list.filter((r) => r.quote_no).map((r) => ({ source: "quotations" as const, id: r.id, state: "done" as const, at: r.created_at, title: r.quote_no!, who: name(r.customer) ?? ((r.doc_customer ?? "").trim() || null) }));
};

const invoices: Loader = async (c) => {
  const list = rows<{ id: string; inv_no: string | null; created_at: string; customer: unknown }>(await supabaseServer.from("invoices")
    .select("id, inv_no, created_at, customer:customer_id(display_name:name, company_name)")
    .eq("created_by_account_id", c.me).not("status", "in", "(void,cancelled)").gte("created_at", c.from).lt("created_at", c.to).limit(LIMIT), "invoices");
  return list.filter((r) => r.inv_no).map((r) => ({ source: "invoices" as const, id: r.id, state: "done" as const, at: r.created_at, title: r.inv_no!, who: name(r.customer) }));
};

const orders: Loader = async (c) => {
  const list = rows<{ id: string; order_no: string | null; created_at: string; customer_name: string | null; company_name: string | null }>(await supabaseServer.from("orders")
    .select("id, order_no, created_at, customer_name, company_name")
    .eq("created_by", c.me).neq("status", "cancelled").gte("created_at", c.from).lt("created_at", c.to).limit(LIMIT), "orders");
  return list.filter((r) => r.order_no).map((r) => ({ source: "orders" as const, id: r.id, state: "done" as const, at: r.created_at, title: r.order_no!, who: (r.company_name || r.customer_name || "").trim() || null }));
};

type CrmRow = { id: string; type: string; title: string | null; due_at: string | null; done_at: string | null; opportunity: unknown };
const crm: Loader = async (c) => {
  const list = rows<CrmRow>(await supabaseServer.from("crm_activities")
    .select("id, type, title, due_at, done_at, opportunity:opportunity_id(name, company_name)")
    .eq("assignee_account_id", c.me)
    .or(`and(due_at.gte.${c.from},due_at.lt.${c.to}),and(done_at.gte.${c.from},done_at.lt.${c.to})`).limit(LIMIT), "crm activities");
  const out: AppRecord[] = [];
  for (const r of list) {
    const title = (r.title ?? "").trim();
    if (!title || r.type === "note") continue;
    const who = name(r.opportunity);
    /* A meeting is a meeting whether or not it was ticked off; the rest
       count once they are done. */
    if (r.type === "meeting" && (r.due_at || r.done_at)) out.push({ source: "crm", id: r.id, state: "scheduled", at: (r.due_at ?? r.done_at)!, title, who, kind: "meeting" });
    else if (r.done_at) out.push({ source: "crm", id: r.id, state: "done", at: r.done_at, title, who, kind: r.type });
  }
  return out;
};

const LOADERS: Record<AppSource, Loader> = { calendar, todos, tasks, planning, quotations, invoices, orders, crm };

type DraftFacts = { template_key: string; template_snapshot?: unknown; period_start: string | null; period_end: string | null; period_key: string | null };

/** The viewer's own work in every app the report type reads and the viewer
 *  may open, over the window around the draft's period (or `date`'s). */
export async function loadAppFeed(row: DraftFacts, auth: ServerAuthContext, date?: string | null): Promise<AppRecord[]> {
  const tpl = templateOf(row);
  if (!tpl) return [];
  const sources = feedSources(tpl);
  if (!sources.length) return [];
  let period: ReportPeriod | null = null;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) period = periodFor(tpl.cadence, date);
  else if (row.period_start) period = { start: row.period_start, end: row.period_end ?? row.period_start, key: row.period_key ?? row.period_start };
  if (!period) return [];
  const w = feedWindow(tpl.cadence, period);
  const openFrom = new Date(Date.parse(w.from) - OPEN_LOOKBACK_DAYS * 86_400_000).toISOString();
  const ctx: Ctx = { me: auth.account_id, from: w.from, to: w.to, fromDate: w.from.slice(0, 10), toDate: w.to.slice(0, 10), openFrom, openFromDate: openFrom.slice(0, 10) };
  const allowed = await Promise.all(sources.map(async (s) => ((await requireModuleAccess(auth, FEED_MODULE[s])) === null ? s : null)));
  const lists = await Promise.all(allowed.filter((s): s is AppSource => !!s).map((s) =>
    LOADERS[s](ctx).catch((e: unknown) => { console.error(`[reports] feed ${s}:`, e instanceof Error ? e.message : e); return [] as AppRecord[]; })));
  return lists.flat();
}
