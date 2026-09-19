import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/employees/[id]/activity?accountId=…
   The cross-module activity snapshot on an employee's profile: their CRM
   opportunities, quotations, invoices, projects, tasks, to-dos, calendar and
   notes, plus HR leave.

   WHY THIS ROUTE EXISTS. The same nine queries used to run in the BROWSER,
   with the anon key, and every one of those nine tables has RLS on with no
   policy for anon — so all nine returned nothing. The client wrapper
   (`safeBucket`) swallows a failing bucket and reports an empty one, so the
   panel showed zeros and never said why. It has been showing zeros while the
   tenant holds 15 quotations, 2 projects and 24 notes.

   Two of the queries could not have worked even with permission:
     · `todos` is not a table. It is `koleex_todos`, and assignees live in the
       `koleex_todo_assignees` junction, not in an `assignee_account_ids`
       array column.
     · calendar events were filtered and sorted on `starts_at` / `ends_at`;
       the columns are `start_at` / `end_at`.

   Nine cross-border round trips also became one. */

const LIMIT = 5;

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  amount?: number | null;
  currency?: string | null;
  createdAt: string | null;
  href: string;
}
interface ActivityBucket { count: number; recent: ActivityItem[] }

const EMPTY: ActivityBucket = { count: 0, recent: [] };

/* One bucket must never take the panel down with it — but unlike the browser
   version, a failure is LOGGED with the bucket's name. A silently empty
   bucket is indistinguishable from "nothing happened yet", which is exactly
   how this went unnoticed. */
async function bucket<T>(
  name: string,
  /* PromiseLike, not Promise: a PostgREST builder is a thenable and does not
     carry .catch/.finally, so typing this as Promise rejects every caller. */
  run: () => PromiseLike<{ data: T[] | null; count: number | null; error: { message: string } | null }>,
  map: (row: T) => ActivityItem,
): Promise<ActivityBucket> {
  try {
    const { data, count, error } = await run();
    if (error) {
      console.error(`[api/employees/activity] ${name}:`, error.message);
      return EMPTY;
    }
    const rows = data ?? [];
    return { count: count ?? rows.length, recent: rows.map(map) };
  } catch (e) {
    console.error(`[api/employees/activity] ${name} threw:`, e);
    return EMPTY;
  }
}

type Row = Record<string, unknown>;
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const n = (v: unknown): number | null => (typeof v === "number" ? v : null);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: employeeId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Employees");
  if (deny) return deny;

  const accountId = new URL(req.url).searchParams.get("accountId");

  /* The employee must belong to the caller's tenant. Without this, an id from
     another tenant would return that person's whole working history. */
  const { data: emp } = await supabaseServer
    .from("koleex_employees")
    .select("id, account_id, tenant_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const empRow = emp as { account_id: string | null; tenant_id: string | null };
  if (auth.tenant_id && empRow.tenant_id && empRow.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  /* Trust the row over the query string: the caller may not pass accountId,
     and must not be able to point this at someone else's account by passing a
     different one. */
  const acct = empRow.account_id ?? (accountId && accountId === empRow.account_id ? accountId : null);

  /* Started, not awaited: leave is employee-keyed and independent of the
     account resolution below, so it rides in parallel with the to-do link
     lookup and the main bucket batch instead of adding its own stage. */
  const leavePromise = bucket<Row>(
    "hr_leave_requests",
    () =>
      supabaseServer
        .from("hr_leave_requests")
        .select("id, leave_type_id, status, start_date, end_date, days, created_at", { count: "exact" })
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    (r) => ({
      id: String(r.id),
      title: `${r.days ?? "?"} day${Number(r.days) === 1 ? "" : "s"} leave`,
      subtitle: `${s(r.start_date) ?? ""} → ${s(r.end_date) ?? ""}`,
      status: s(r.status),
      createdAt: s(r.created_at),
      href: "/hr",
    }),
  );

  if (!acct) {
    const leave = await leavePromise;
    return NextResponse.json({
      activity: {
        crmOpportunities: EMPTY, quotations: EMPTY, invoices: EMPTY,
        projectsManaged: EMPTY, tasksAssigned: EMPTY, todosAssigned: EMPTY,
        leaveRequests: leave, calendarEvents: EMPTY, notes: EMPTY,
        missingAccount: true,
      },
    });
  }

  /* The to-do assignment lives in a junction table, so it needs its ids first.
     Everything else is a single filtered read. */
  const { data: todoLinks } = await supabaseServer
    .from("koleex_todo_assignees")
    .select("todo_id")
    .eq("account_id", acct);
  const todoIds = ((todoLinks ?? []) as { todo_id: string }[]).map((t) => t.todo_id);

  const [leave, crm, quotations, invoices, projectsManaged, tasksAssigned, todosAssigned, calendarEvents, notes] =
    await Promise.all([
      leavePromise,
      /* expected_revenue, not `value`, and crm_opportunities has no currency
         column at all — the browser version asked for both and the whole
         bucket errored out on every load. */
      bucket<Row>("crm_opportunities", () =>
        supabaseServer
          .from("crm_opportunities")
          .select("id, name, stage_id, expected_revenue, expected_close_date, created_at", { count: "exact" })
          .eq("owner_account_id", acct)
          .order("created_at", { ascending: false })
          .limit(LIMIT),
        (r) => ({
          id: String(r.id),
          title: s(r.name) ?? "Opportunity",
          subtitle: s(r.expected_close_date) ? `Close ${s(r.expected_close_date)}` : null,
          amount: n(r.expected_revenue), currency: null, status: null,
          createdAt: s(r.created_at), href: "/crm",
        })),

      bucket<Row>("quotations", () =>
        supabaseServer
          .from("quotations")
          .select("id, quote_no, status, total, currency, issue_date, created_at", { count: "exact" })
          .eq("created_by", acct)
          .order("created_at", { ascending: false })
          .limit(LIMIT),
        (r) => ({
          id: String(r.id),
          title: s(r.quote_no) ?? "Quotation",
          subtitle: s(r.issue_date), status: s(r.status),
          amount: n(r.total), currency: s(r.currency),
          createdAt: s(r.created_at), href: `/quotations/${r.id}`,
        })),

      /* inv_no, not invoice_no. */
      bucket<Row>("invoices", () =>
        supabaseServer
          .from("invoices")
          .select("id, inv_no, status, total, currency, issue_date, created_at", { count: "exact" })
          .eq("created_by_account_id", acct)
          .order("created_at", { ascending: false })
          .limit(LIMIT),
        (r) => ({
          id: String(r.id),
          title: s(r.inv_no) ?? "Invoice",
          subtitle: s(r.issue_date), status: s(r.status),
          amount: n(r.total), currency: s(r.currency),
          createdAt: s(r.created_at), href: `/invoices/${r.id}`,
        })),

      bucket<Row>("projects", () =>
        supabaseServer
          .from("projects")
          .select("id, name, code, status, planned_end, created_at", { count: "exact" })
          .eq("manager_account_id", acct)
          .order("created_at", { ascending: false })
          .limit(LIMIT),
        (r) => ({
          id: String(r.id),
          title: s(r.name) ?? "Project", subtitle: s(r.code),
          status: s(r.status), createdAt: s(r.created_at), href: `/projects/${r.id}`,
        })),

      bucket<Row>("project_tasks", () =>
        supabaseServer
          .from("project_tasks")
          .select("id, title, status, priority, due_date, project_id, created_at", { count: "exact" })
          .eq("assignee_account_id", acct)
          .neq("status", "done")
          .order("created_at", { ascending: false })
          .limit(LIMIT),
        (r) => ({
          id: String(r.id),
          title: s(r.title) ?? "Task",
          subtitle: s(r.due_date) ? `Due ${s(r.due_date)}` : null,
          status: s(r.status), createdAt: s(r.created_at), href: `/projects/${r.project_id}`,
        })),

      todoIds.length
        ? bucket<Row>("koleex_todos", () =>
            supabaseServer
              .from("koleex_todos")
              .select("id, title, status, priority, due_date, completed, created_at", { count: "exact" })
              .in("id", todoIds)
              .eq("completed", false)
              .order("created_at", { ascending: false })
              .limit(LIMIT),
            (r) => ({
              id: String(r.id),
              title: s(r.title) ?? "Todo",
              subtitle: s(r.due_date) ? `Due ${s(r.due_date)}` : null,
              status: s(r.status), createdAt: s(r.created_at), href: "/todo",
            }))
        : Promise.resolve(EMPTY),

      bucket<Row>("koleex_calendar_events", () =>
        supabaseServer
          .from("koleex_calendar_events")
          .select("id, title, start_at, end_at, event_type, created_at", { count: "exact" })
          .eq("account_id", acct)
          .gte("start_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
          .order("start_at", { ascending: false })
          .limit(LIMIT),
        (r) => ({
          id: String(r.id),
          title: s(r.title) ?? "Event", subtitle: s(r.start_at),
          status: s(r.event_type), createdAt: s(r.created_at), href: "/calendar",
        })),

      bucket<Row>("notes", () =>
        supabaseServer
          .from("notes")
          .select("id, title, updated_at, created_at", { count: "exact" })
          .eq("account_id", acct)
          .order("updated_at", { ascending: false })
          .limit(LIMIT),
        (r) => ({
          id: String(r.id),
          title: s(r.title) ?? "Untitled note", subtitle: null, status: null,
          createdAt: s(r.updated_at) ?? s(r.created_at), href: "/notes",
        })),
    ]);

  return NextResponse.json({
    activity: {
      crmOpportunities: crm, quotations, invoices, projectsManaged,
      tasksAssigned, todosAssigned, leaveRequests: leave, calendarEvents, notes,
      missingAccount: false,
    },
  }, { headers: { "Cache-Control": "private, max-age=30" } });
}
