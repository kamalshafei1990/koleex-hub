import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { expandRecurrence, type CalendarRec } from "@/lib/calendar-recurrence";

/* GET /api/calendar/events
   Returns events for a given account within [from, to).

   Calendar is a Type C (Personal) module: scope rules are hardcoded
   regardless of koleex_permissions scope setting.

   Access rules:
     - Must be authenticated + have "Calendar" module permission.
     - Viewing OWN calendar: allowed, returns all events (including private).
     - Viewing SOMEONE ELSE's calendar: only allowed for Super Admin.
     - Private events on another's calendar are hidden unless role has
       can_view_private (break-glass) — in which case they're included
       and the access is audit-logged.

   Query params:
     accountId   (required) — which account's calendar to view
     from        (required) — ISO timestamp; lower bound of window (gte end_at)
     to          (required) — ISO timestamp; upper bound of window (lt start_at)
*/

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
    return NextResponse.json(
      { error: "accountId, from, to are required" },
      { status: 400 },
    );
  }

  // Type C rule: only Super Admin can view someone else's calendar.
  const viewingOwn = accountId === auth.account_id;
  if (!viewingOwn && !auth.is_super_admin) {
    return NextResponse.json({ events: [] });
  }

  let query = supabaseServer
    .from("koleex_calendar_events")
    .select("*")
    .eq("account_id", accountId)
    .is("recurrence", null) // recurring series render via expansion below, not here
    .lt("start_at", to)
    .gte("end_at", from)
    .order("start_at", { ascending: true });

  // Multi-tenancy: event must belong to the viewer's tenant.
  if (auth.tenant_id) {
    query = query.eq("tenant_id", auth.tenant_id);
  }

  // Privacy: hide is_private on other's calendar unless break-glass.
  if (!viewingOwn && !auth.can_view_private) {
    query = query.eq("is_private", false);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[api/calendar/events]", error.message);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500 },
    );
  }

  // Audit break-glass private reads.
  if (!viewingOwn && auth.can_view_private) {
    const privateIds = (data ?? [])
      .filter((e) => (e as { is_private?: boolean }).is_private)
      .map((e) => (e as { id: string }).id);
    if (privateIds.length > 0) {
      // Fire-and-forget — match the behaviour of logPrivateAccess in scope.ts.
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

  const winFrom = new Date(from);
  const winTo = new Date(to);

  /* ── Recurring series (read-expansion) ──
     A recurring event is ONE row (recurrence = daily/weekly/monthly). Its
     occurrences are computed here rather than spawned. Each occurrence carries
     `series_base_id` so the UI edits/deletes the whole series (clicking an
     occurrence opens the base row). */
  type Row = Record<string, unknown> & {
    id: string;
    start_at: string;
    end_at: string;
    recurrence?: CalendarRec;
    recurrence_until?: string | null;
  };
  const expandRow = (base: Row): unknown[] => {
    const occ = expandRecurrence(
      base.start_at,
      base.end_at,
      base.recurrence,
      base.recurrence_until ?? null,
      winFrom,
      winTo,
    );
    return occ.map((o, i) => ({
      ...base,
      id: `${base.id}~${i}`,
      series_base_id: base.id,
      start_at: o.start.toISOString(),
      end_at: o.end.toISOString(),
    }));
  };

  let recurringExpanded: unknown[] = [];
  {
    let rq = supabaseServer
      .from("koleex_calendar_events")
      .select("*")
      .eq("account_id", accountId)
      .not("recurrence", "is", null)
      .lte("start_at", to) // series must have started before the window's end
      .or(`recurrence_until.is.null,recurrence_until.gte.${from.slice(0, 10)}`);
    if (auth.tenant_id) rq = rq.eq("tenant_id", auth.tenant_id);
    if (!viewingOwn && !auth.can_view_private) rq = rq.eq("is_private", false);
    const { data: recRows } = await rq;
    recurringExpanded = (recRows ?? []).flatMap((r) => expandRow(r as Row));
  }

  /* ── Events the viewer is INVITED to (not owner) ──
     Shows on your calendar even though someone else owns it. Only for your own
     calendar view. Recurring invited events are expanded too. */
  let attendeeEvents: unknown[] = [];
  if (viewingOwn) {
    const { data: att } = await supabaseServer
      .from("koleex_calendar_event_attendees")
      .select("event_id")
      .eq("account_id", accountId)
      .limit(500);
    const evIds = Array.from(new Set((att ?? []).map((a) => (a as { event_id: string }).event_id)));
    if (evIds.length) {
      let aq = supabaseServer
        .from("koleex_calendar_events")
        .select("*")
        .in("id", evIds)
        .neq("account_id", accountId); // owned ones already covered above
      if (auth.tenant_id) aq = aq.eq("tenant_id", auth.tenant_id);
      const { data: aRows } = await aq;
      attendeeEvents = (aRows ?? []).flatMap((r) => {
        const row = r as Row;
        const base = { ...row, invited: true };
        if (row.recurrence) return expandRow(base as Row);
        // one-off: include only if it overlaps the window
        const s = new Date(row.start_at).getTime();
        const e = new Date(row.end_at).getTime();
        return s < winTo.getTime() && e >= winFrom.getTime() ? [base] : [];
      });
    }
  }

  // Mirror Planning items onto the caller's own Calendar. Read-only
  // shadow — shows shifts / meetings / production runs / etc. assigned
  // to the viewer's employee resource so they have a single "today's
  // day" view. Only for published + completed items; drafts stay in
  // Planning only.
  let planningMirror: unknown[] = [];
  if (viewingOwn && auth.tenant_id) {
    const { data: res } = await supabaseServer
      .from("planning_resources")
      .select("id")
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id)
      .eq("type", "employee")
      .maybeSingle();
    if (res?.id) {
      const { data: pItems } = await supabaseServer
        .from("planning_items")
        .select(
          "id, type, title, notes, start_at, end_at, status, linked_entity_label, role:role_id ( name, color )",
        )
        .eq("tenant_id", auth.tenant_id)
        .eq("resource_id", res.id)
        .in("status", ["published", "completed"])
        .gte("end_at", from)
        .lt("start_at", to);
      planningMirror = (pItems ?? []).map((p) => {
        const r = (p as { role?: { name?: string | null; color?: string | null } | null }).role;
        return {
          id: `planning:${p.id}`,
          account_id: accountId,
          tenant_id: auth.tenant_id,
          title: p.title || `[${p.type}]`,
          description: p.notes ?? null,
          start_at: p.start_at,
          end_at: p.end_at,
          all_day: false,
          color: r?.color ?? null,
          is_private: false,
          source: "planning",
          source_kind: p.type,
          role_name: r?.name ?? null,
          linked_entity_label: (p as { linked_entity_label?: string | null }).linked_entity_label ?? null,
        };
      });
    }
  }

  // Mirror To-do items onto the Calendar. Read-only shadow — a task appears
  // on its due date (or, when it also has a start date, as a start→due span)
  // so tasks and events live in one view. Tasks the account CREATED or is
  // ASSIGNED to are shown. Recurrence TEMPLATES are excluded — only their
  // concrete spawned instances (and one-off tasks) surface, so the calendar
  // isn't cluttered by the rule itself. Color encodes status: done = muted,
  // overdue = danger, otherwise the action accent.
  let todoMirror: unknown[] = [];
  if (auth.tenant_id) {
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);

    const { data: asg } = await supabaseServer
      .from("koleex_todo_assignees")
      .select("todo_id")
      .eq("account_id", accountId)
      .limit(500);
    const assignedIds = Array.from(
      new Set((asg ?? []).map((a) => (a as { todo_id: string }).todo_id)),
    ).slice(0, 400);

    const orExpr = assignedIds.length
      ? `created_by_account_id.eq.${accountId},id.in.(${assignedIds.join(",")})`
      : `created_by_account_id.eq.${accountId}`;

    const { data: todos } = await supabaseServer
      .from("koleex_todos")
      .select("id, title, due_date, start_date, priority, status, completed")
      .eq("tenant_id", auth.tenant_id)
      .is("recurrence", null)
      .or(orExpr)
      .limit(1000);

    const todayStr = new Date().toISOString().slice(0, 10);
    const seen = new Set<string>();
    todoMirror = (todos ?? [])
      .map((t) => t as {
        id: string;
        title: string;
        due_date: string | null;
        start_date: string | null;
        priority: string | null;
        status: string | null;
        completed: boolean;
      })
      .filter((t) => {
        if (seen.has(t.id)) return false;
        const s = t.start_date ?? t.due_date;
        const e = t.due_date ?? t.start_date;
        if (!s || !e) return false; // a task needs at least one date to place
        if (!(s <= toDate && e >= fromDate)) return false; // overlaps the window
        seen.add(t.id);
        return true;
      })
      .map((t) => {
        const s = (t.start_date ?? t.due_date) as string;
        const e = (t.due_date ?? t.start_date) as string;
        const overdue = !t.completed && e < todayStr;
        const color = t.completed ? "#9AA0A6" : overdue ? "#FF3333" : "#0066FF";
        return {
          id: `todo:${t.id}`,
          account_id: accountId,
          tenant_id: auth.tenant_id,
          title: t.title,
          description: null,
          location: null,
          start_at: `${s}T00:00:00.000Z`,
          end_at: `${e}T23:59:59.999Z`,
          all_day: true,
          color,
          is_private: false,
          event_type: "task",
          source: "todo",
          source_kind: t.completed ? "done" : overdue ? "overdue" : t.status ?? "todo",
          todo_id: t.id,
        };
      });
  }

  return NextResponse.json({
    events: [
      ...(data ?? []),
      ...recurringExpanded,
      ...attendeeEvents,
      ...planningMirror,
      ...todoMirror,
    ],
  });
}

/* POST /api/calendar/events — create a new event.
   Body must set account_id. Type C rule: non-SA can only create events
   on their OWN calendar. Server enforces tenant_id from the session. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Calendar", "create");
  if (deny) return deny;

  const body = (await req.json()) as Record<string, unknown>;
  const targetAccountId = (body.account_id as string) || auth.account_id;

  if (targetAccountId !== auth.account_id && !auth.is_super_admin) {
    return NextResponse.json(
      { error: "Cannot create events on another account's calendar" },
      { status: 403 },
    );
  }

  const row = {
    ...body,
    account_id: targetAccountId,
    tenant_id: auth.tenant_id, // server-side truth
  };

  const { data, error } = await supabaseServer
    .from("koleex_calendar_events")
    .insert(row)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[api/calendar/events POST]", error.message);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 },
    );
  }
  return NextResponse.json({ event: data });
}
