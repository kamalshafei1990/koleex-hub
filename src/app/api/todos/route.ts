import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { countOpenTodos } from "@/lib/todo-open-count";
import { seriesPeriodOf } from "@/lib/todo-series";
import { applyTodoScope, sharedTodoIds, type TodoViewer } from "@/lib/server/todo-scope";
import { ASSIGN_TO_EVERYONE_DENIED, canAssignToEveryone, resolveAssigneeIds } from "@/lib/server/todo-access";
import { readIdList, readTodoFields } from "@/lib/server/todo-input";
import { notifyTodoAssigned, notifyTodoPeopleAdded, pingTodosChanged } from "@/lib/server/todo-notify";

/* GET /api/todos
   Returns the enriched todo list (with assignees, assigner, notes) scoped
   to what the caller is allowed to see.

   Type C module semantics (hardcoded, regardless of koleex_permissions
   data_scope):
     - Super Admin: sees every todo in the tenant.
     - Everyone else: sees todos where ANY of:
         - created_by_account_id = me
         - assigned_by_account_id = me
         - appears in koleex_todo_assignees as me
         - assigned_department = my department
         - assign_to_all = true (broadcast)
       MINUS any is_private=true unless I'm the creator or an assignee
       (owner, 2026-09-27) or have can_view_private (break-glass).

   Multi-tenancy: always filtered by auth.tenant_id.

   Paging (optional, additive): ?limit=N (1–500) returns the newest N and a
   `next_before` cursor; ?before=<created_at> continues from it. Without
   `limit` the whole visible list is returned, as the To-do screen expects,
   up to LIST_CAP rows (`truncated: true` says the cap was hit).

   Lazy completed (optional, additive):
     ?status=open       everything not completed, PLUS tasks completed in
                        the last 24 hours (so a just-ticked task and its Undo
                        still show). Paging as above, by created_at.
     ?status=completed  completed tasks only, newest completion first;
                        ?limit=N (default 50, max 500) and
                        ?before=<completed_at> page it, `next_before` is the
                        cursor for the next page.
   No `status` behaves exactly as before. */

const LIST_CAP = 3000;

interface AssigneeInfo {
  account_id: string;
  username: string;
  full_name: string | null;
  name_alt: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
}

type Row = Record<string, unknown> & { id: string };

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;
  const params = new URL(req.url).searchParams;

  /* ── ?resource=openCount → the To-do tile badge ───────────────────────────
     It counts OPEN TASKS ASSIGNED TO YOU — "this much work is on you" — not
     unread assignment notifications, so it falls the moment a task is
     finished and can never drift from the tasks themselves. Assignees only,
     not observers. The rule lives in lib/todo-open-count.ts, shared with
     /api/me/work and the dashboard. */
  if (params.get("resource") === "openCount") {
    const open = await countOpenTodos(supabaseServer, auth.account_id, auth.tenant_id);
    return NextResponse.json({ ok: true, data: { open } });
  }

  const statusParam = params.get("status");
  if (statusParam !== null && statusParam !== "open" && statusParam !== "completed") {
    return NextResponse.json({ error: "status must be open or completed" }, { status: 400 });
  }
  const completedOnly = statusParam === "completed";
  const limitParam = Number(params.get("limit"));
  const paged = completedOnly || (Number.isInteger(limitParam) && limitParam > 0);
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : paged ? 50 : LIST_CAP;
  const before = params.get("before");
  if (before && !Number.isFinite(Date.parse(before))) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  /* THE SCOPE, from lib/server/todo-scope.ts: one rule for this route, the
     AI's listMyTodos and the morning brief. The ids the caller is an
     assignee of or observes first, then the query bounded by tenant, then
     the scope and privacy clauses. */
  const viewer: TodoViewer = {
    accountId: auth.account_id,
    tenantId: auth.tenant_id,
    department: auth.department,
    isSuperAdmin: auth.is_super_admin,
    canViewPrivate: auth.can_view_private,
  };
  const sharedIds = await sharedTodoIds(viewer);

  /* The page key: completion time for the completed list, creation time
     for everything else. */
  const cursorCol = completedOnly ? "completed_at" : "created_at";
  let query = supabaseServer
    .from("koleex_todos")
    .select("*")
    .order(cursorCol, { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (auth.tenant_id) query = query.eq("tenant_id", auth.tenant_id);
  if (completedOnly) query = query.eq("completed", true).not("completed_at", "is", null);
  else if (statusParam === "open") {
    const justDone = new Date(Date.now() - 24 * 3600_000).toISOString();
    query = query.or(`completed.eq.false,completed_at.gte.${justDone}`);
  }
  if (before) query = query.lt(cursorCol, before);
  query = applyTodoScope(query, viewer, sharedIds);

  const { data, error } = await query;
  if (error) {
    console.error("[api/todos]", error.message);
    return NextResponse.json({ error: "Failed to load todos" }, { status: 500 });
  }
  const all = (data ?? []) as Row[];
  const more = all.length > limit;
  const todos = more ? all.slice(0, limit) : all;
  const pageInfo = paged
    ? { next_before: more ? (todos[todos.length - 1][cursorCol] as string) : null }
    : more ? { truncated: true } : {};
  if (todos.length === 0) return NextResponse.json({ todos: [], ...pageInfo });

  /* Audit break-glass private reads — after the response; the audit row is
     not part of the answer. */
  if (auth.can_view_private) {
    const privateIds = todos
      .filter((t) => t.is_private && t.created_by_account_id !== auth.account_id)
      .map((t) => t.id);
    if (privateIds.length > 0) {
      after(async () => {
        const { error: logErr } = await supabaseServer.from("koleex_private_access_log").insert(
          privateIds.map((id) => ({
            account_id: auth.account_id,
            role_id: auth.role_id,
            module_name: "To-do",
            record_type: "koleex_todos",
            record_id: id,
            access_reason: null,
          })),
        );
        if (logErr) console.error("[api/todos] private access log:", logErr.message);
      });
    }
  }

  const todoIds = todos.map((t) => t.id);

  /* A recurring instance's cadence lives on its TEMPLATE, which can be
     outside the caller's scope (created by someone else, broadcast only
     from a later period) — those parents are read alongside the rest. */
  const cadenceById = new Map<string, string>();
  todos.forEach((t) => { if (t.recurrence) cadenceById.set(t.id, t.recurrence as string); });
  const orphanParents = Array.from(new Set(
    todos
      .map((t) => t.recurrence_parent_id as string | null)
      .filter((p): p is string => !!p && !cadenceById.has(p)),
  ));

  // Enrichment — assignees, notes and orphan parents in one round trip.
  const [{ data: assigneeRows }, { data: noteRows }, { data: parents }] = await Promise.all([
    supabaseServer
      .from("koleex_todo_assignees")
      .select("todo_id, account_id")
      .in("todo_id", todoIds),
    supabaseServer
      .from("koleex_todo_notes")
      .select("id, todo_id, author_account_id, body, created_at, updated_at")
      .in("todo_id", todoIds)
      .order("created_at", { ascending: true }),
    orphanParents.length > 0
      ? (() => {
          let pq = supabaseServer.from("koleex_todos").select("id, recurrence").in("id", orphanParents);
          if (auth.tenant_id) pq = pq.eq("tenant_id", auth.tenant_id);
          return pq;
        })()
      : Promise.resolve({ data: [] as Array<{ id: string; recurrence: string | null }> }),
  ]);
  ((parents ?? []) as Array<{ id: string; recurrence: string | null }>).forEach((p) => {
    if (p.recurrence) cadenceById.set(p.id, p.recurrence);
  });

  const assigneesByTodo = new Map<string, string[]>();
  ((assigneeRows ?? []) as Array<{ todo_id: string; account_id: string }>).forEach((a) => {
    const list = assigneesByTodo.get(a.todo_id);
    if (list) list.push(a.account_id);
    else assigneesByTodo.set(a.todo_id, [a.account_id]);
  });
  type NoteRow = { id: string; todo_id: string; author_account_id: string; body: string; created_at: string; updated_at: string };
  const notesByTodo = new Map<string, NoteRow[]>();
  ((noteRows ?? []) as NoteRow[]).forEach((n) => {
    const list = notesByTodo.get(n.todo_id);
    if (list) list.push(n);
    else notesByTodo.set(n.todo_id, [n]);
  });

  const accountIds = new Set<string>();
  todos.forEach((t) => {
    if (t.created_by_account_id) accountIds.add(t.created_by_account_id as string);
    if (t.assigned_by_account_id) accountIds.add(t.assigned_by_account_id as string);
  });
  assigneesByTodo.forEach((ids) => ids.forEach((id) => accountIds.add(id)));
  notesByTodo.forEach((ns) => ns.forEach((n) => accountIds.add(n.author_account_id)));
  const infoMap = await resolveAssigneeInfos(Array.from(accountIds));

  const enriched = todos.map((t) => {
    const assignedBy = t.assigned_by_account_id as string | null;
    const assignerInfo = assignedBy ? infoMap.get(assignedBy) : undefined;
    /* Recurring series identity: the template carries the cadence, a
       spawned row points at it. Every row of a series is tagged with the
       cadence and the period it represents, so the list can badge them as
       days of ONE repeating task (lib/todo-series.ts). */
    const parent = t.recurrence_parent_id as string | null;
    const cadence = (t.recurrence as string | null) ?? (parent ? cadenceById.get(parent) ?? null : null);
    return {
      ...t,
      assignees: (assigneesByTodo.get(t.id) ?? [])
        .map((id) => infoMap.get(id))
        .filter((i): i is AssigneeInfo => !!i),
      assigner: assignerInfo
        ? {
            account_id: assignerInfo.account_id,
            username: assignerInfo.username,
            full_name: assignerInfo.full_name,
            avatar_url: assignerInfo.avatar_url,
          }
        : null,
      notes: (notesByTodo.get(t.id) ?? []).map((n) => {
        const author = infoMap.get(n.author_account_id);
        return {
          ...n,
          author_username: author?.username ?? "unknown",
          author_full_name: author?.full_name ?? null,
          author_avatar_url: author?.avatar_url ?? null,
        };
      }),
      series_cadence: cadence,
      series_period: cadence
        ? seriesPeriodOf(t as unknown as Parameters<typeof seriesPeriodOf>[0]) || null
        : null,
    };
  });

  /* The list refreshes on any write via the client's ?v= write version
     (lib/todo-list-url.ts), so a short private cache is safe. */
  return NextResponse.json(
    { todos: enriched, ...pageInfo },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } },
  );
}

/* POST /api/todos — create a todo.
   Body: { title, description?, priority?, label?, status?, due_date?,
           start_date?, remind_at?, recurrence?, recurrence_until?, source?,
           source_id?, assignee_account_ids?, assigned_department?,
           assign_to_all?, is_private?, metadata? }
   Server enforces creator/assigner = auth.account_id and tenant_id from
   the session. Fan-out to koleex_todo_assignees + inbox_messages. */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "create");
  if (deny) return deny;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  /* Every field through the one allow-list (lib/server/todo-input.ts). The
     database CHECKs status, priority and source; recurrence and
     approval_state are plain text there, so this is their only guard. */
  const read = readTodoFields(body);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: 400 });
  const f = read.fields;
  const explicitIds = readIdList(body.assignee_account_ids);
  if (explicitIds === null) {
    return NextResponse.json({ error: "assignee_account_ids must be a list" }, { status: 400 });
  }

  const status = (f.status as string | undefined) ?? "todo";
  const recurrence = (f.recurrence as string | null | undefined) ?? null;
  const department = (f.assigned_department as string | null | undefined) ?? null;
  const toAll = f.assign_to_all === true;
  if (toAll && !canAssignToEveryone(auth)) {
    return NextResponse.json({ error: ASSIGN_TO_EVERYONE_DENIED }, { status: 403 });
  }
  const metadata = (f.metadata as Record<string, unknown> | undefined) ?? {};
  const nowIso = new Date().toISOString();

  const { data: todo, error } = await supabaseServer
    .from("koleex_todos")
    .insert({
      title: f.title as string,
      metadata,
      description: (f.description as string | null | undefined) ?? null,
      // Keep completed in lockstep with the workflow stage.
      completed: status === "done",
      completed_at: status === "done" ? nowIso : null,
      status,
      priority: (f.priority as string | undefined) ?? "medium",
      label: (f.label as string | null | undefined) ?? null,
      due_date: (f.due_date as string | null | undefined) ?? null,
      start_date: (f.start_date as string | null | undefined) ?? null,
      remind_at: (f.remind_at as string | null | undefined) ?? null,
      // This row becomes the recurring template; the cron spawns instances.
      recurrence,
      recurrence_until: recurrence ? (f.recurrence_until as string | null | undefined) ?? null : null,
      created_by_account_id: auth.account_id,
      assigned_by_account_id: auth.account_id,
      source: (f.source as string | undefined) ?? "manual",
      source_id: (f.source_id as string | null | undefined) ?? null,
      assigned_department: department,
      assign_to_all: toAll,
      is_private: f.is_private === true,
      tenant_id: auth.tenant_id,
    })
    .select("*")
    .single();

  if (error || !todo) {
    console.error("[api/todos POST]", error?.message);
    return NextResponse.json({ error: "Failed to create todo" }, { status: 500 });
  }

  const created = todo as { id: string; title: string; description: string | null; priority: string; tenant_id: string | null };

  /* Assignees: the explicit list, a department's members, or everyone —
     expanded and reduced to INTERNAL accounts in lib/server/todo-access.ts
     (a task is company work; a customer/portal login can never hold one,
     whatever the client posts). Written before the response: the list the
     client refetches next must already show them. */
  const assigneeIds = await resolveAssigneeIds({
    explicit: explicitIds,
    department,
    everyone: toAll,
    tenantId: auth.tenant_id,
  });
  if (assigneeIds.length > 0) {
    const { error: asgErr } = await supabaseServer.from("koleex_todo_assignees").insert(
      assigneeIds.map((accountId) => ({ todo_id: created.id, account_id: accountId })),
    );
    if (asgErr) console.error("[api/todos POST] assignees:", asgErr.message);
  }

  /* Notifications: assignees, then @mentions, then observers — never the
     creator, never the same person twice. Sent after the response: a
     department or company-wide fan-out (inbox rows + web push per person)
     must not hold the Save button. */
  const idsOf = (list: unknown): string[] =>
    Array.isArray(list) ? (list.map((m) => (m as { account_id?: string })?.account_id).filter(Boolean) as string[]) : [];
  const meta = metadata as { mentions?: unknown; observers?: unknown };
  const notified = new Set<string>([auth.account_id, ...assigneeIds]);
  const fresh = (ids: string[]) => {
    const out = Array.from(new Set(ids)).filter((id) => !notified.has(id));
    out.forEach((id) => notified.add(id));
    return out;
  };
  const mentionIds = fresh(idsOf(meta.mentions));
  const observerIds = fresh(idsOf(meta.observers));
  after(async () => {
    await notifyTodoAssigned(created, assigneeIds, auth.account_id);
    await notifyTodoPeopleAdded(created, "mention", mentionIds, auth.account_id);
    await notifyTodoPeopleAdded(created, "observer", observerIds, auth.account_id);
    await pingTodosChanged(auth.tenant_id);
  });

  return NextResponse.json({ todo });
}

/* Resolve assignee info (username, full_name, avatar, dept, position) for a
   batch of account_ids — the account (with its person embedded) and the
   employee record are read in parallel. */
async function resolveAssigneeInfos(accountIds: string[]): Promise<Map<string, AssigneeInfo>> {
  const out = new Map<string, AssigneeInfo>();
  if (accountIds.length === 0) return out;

  type Person = { full_name: string | null; name_alt: string | null };
  const [accRes, empRes] = await Promise.all([
    supabaseServer
      .from("accounts")
      .select("id, username, avatar_url, person:people ( full_name, name_alt )")
      .in("id", accountIds),
    supabaseServer
      .from("koleex_employees")
      .select("account_id, department, position")
      .in("account_id", accountIds),
  ]);
  if (accRes.error) console.error("[api/todos] accounts:", accRes.error.message);

  const empMap = new Map(
    ((empRes.data ?? []) as Array<{ account_id: string; department: string | null; position: string | null }>)
      .map((e) => [e.account_id, e]),
  );
  ((accRes.data ?? []) as unknown as Array<{
    id: string;
    username: string;
    avatar_url: string | null;
    person: Person | Person[] | null;
  }>).forEach((a) => {
    const person = Array.isArray(a.person) ? a.person[0] ?? null : a.person;
    const emp = empMap.get(a.id);
    out.set(a.id, {
      account_id: a.id,
      username: a.username,
      full_name: person?.full_name ?? null,
      name_alt: person?.name_alt ?? null,
      avatar_url: a.avatar_url,
      department: emp?.department ?? null,
      position: emp?.position ?? null,
    });
  });
  return out;
}
