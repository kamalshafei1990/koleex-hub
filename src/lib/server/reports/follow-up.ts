import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — a report becomes work (Phase 6A, owner's picks
   27 Sep 2026). The rules are pure in lib/reports/follow-up; this file
   reads and writes.

     forwardReport    — new copy readers, with who forwarded, when and the
                        note; each is told (report_forwarded).
     makeReportTask   — a To-do task (source 'report', source_id = the
                        report) written the way every To-do writer writes one:
                        the assignees through resolveAssigneeIds (internal
                        accounts only), notifyTodoAssigned, pingTodosChanged.
                        `share` also forwards the report to an assignee who
                        cannot read it yet — only where a forward is allowed.
     loadReportTasks  — the tasks of this report and its earlier versions:
                        the ones To-do itself shows THIS viewer (the one scope
                        rule, lib/server/todo-scope), and how many there are.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { listPeople, loadOrgTree, type LoadedReport, type ReportRow } from "@/lib/server/reports/core";
import { notifyReportForwarded } from "@/lib/server/reports/notify";
import { resolveAssigneeIds } from "@/lib/server/todo-access";
import { notifyTodoAssigned, pingTodosChanged } from "@/lib/server/todo-notify";
import { applyTodoScope, sharedTodoIds, type TodoViewer } from "@/lib/server/todo-scope";
import {
  FOLLOW_UP_LIMITS, TASK_PRIORITIES, forwardNote, forwardTargets, mayForward, reportLine, taskDue, taskPeopleAllowed, taskTitle,
  type ReportTask, type TaskPriority,
} from "@/lib/reports/follow-up";
import { REPORT_LIMITS } from "@/lib/reports/templates";
import { pickWord, readSnapshot } from "@/lib/reports/custom-templates";
import { rangeLabel } from "@/lib/reports/team";
import { reportsT } from "@/lib/translations/reports";

/** May this viewer create To-do tasks? The same check POST /api/todos makes
 *  (a view-as preview never may — it is a write). */
export async function mayMakeTasks(auth: ServerAuthContext): Promise<boolean> {
  return (await requireModuleAction(auth, "To-do", "create")) === null;
}

const forwardFacts = (loaded: LoadedReport) => ({
  status: loaded.row.status, superseded: loaded.row.superseded, confidential: loaded.row.confidential, isAuthor: loaded.access === "author",
});

/** Add copy readers who were forwarded the report. A person someone else
 *  added a moment ago is skipped, never an error. */
async function addForwarded(row: ReportRow, ids: string[], by: string, note: string | null): Promise<string[]> {
  if (!ids.length) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer.from("work_report_recipients")
    .upsert(ids.map((account_id) => ({ report_id: row.id, account_id, role: "cc", forwarded_by: by, forwarded_at: now, forward_note: note })),
      { onConflict: "report_id,account_id", ignoreDuplicates: true })
    .select("account_id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ account_id: string }>).map((r) => r.account_id);
}

export type ForwardOutcome = { added: string[] } | "forbidden" | "nobody" | "full";

export async function forwardReport(auth: ServerAuthContext, loaded: LoadedReport, body: { people?: unknown; note?: unknown }): Promise<ForwardOutcome> {
  const { row, recipients } = loaded;
  if (!mayForward(forwardFacts(loaded))) return "forbidden";
  const people = await listPeople(auth.tenant_id);
  const add = forwardTargets(body.people, {
    /* Not the one forwarding it either — they can read it already. */
    staff: new Set(people.map((p) => p.id)), authorId: row.author_account_id, already: new Set([...recipients.map((r) => r.account_id), auth.account_id]),
  });
  if (!add.length) return "nobody";
  if (recipients.length + add.length > REPORT_LIMITS.recipients) return "full";
  const note = forwardNote(body.note);
  const added = await addForwarded(row, add, auth.account_id, note);
  if (added.length) {
    const me = people.find((p) => p.id === auth.account_id);
    await notifyReportForwarded(row, added, auth.account_id, me?.name ?? auth.username, note);
  }
  return { added };
}

export type TaskOutcome = { id: string; shared: string[] } | "forbidden" | "bad_line" | "bad_title" | "bad_people" | "people_not_allowed";

/** The line under a task's title in To-do: where it came from, in English —
 *  To-do shows a description through AutoTranslatedText, in each reader's
 *  own language. */
function taskContext(row: ReportRow, authorName: string, line: string | null, title: string): string {
  const type = (reportsT[`tpl.${row.template_key}.name`]?.en as string | undefined) ?? (pickWord(readSnapshot(row.template_snapshot)?.head.name, "en") || "Report");
  const period = row.period_start ? rangeLabel(row.period_start, row.period_end ?? row.period_start) : "";
  const head = [row.title?.trim() || type, authorName, period].filter(Boolean).join(" — ");
  return line && line !== title ? `${head}\n“${line}”` : head;
}

export async function makeReportTask(
  auth: ServerAuthContext, loaded: LoadedReport,
  body: { title?: unknown; people?: unknown; due?: unknown; priority?: unknown; line?: unknown; share?: unknown },
): Promise<TaskOutcome> {
  const { row, recipients, access } = loaded;
  if (row.status === "draft" || !(await mayMakeTasks(auth))) return "forbidden";
  const line = body.line == null ? null : reportLine(row.sections, body.line);
  if (body.line != null && !line) return "bad_line";
  const title = taskTitle(body.title ?? line?.text);
  if (!title) return "bad_title";
  const staff = new Map((await listPeople(auth.tenant_id)).map((p) => [p.id, p]));
  const people = Array.isArray(body.people)
    ? Array.from(new Set(body.people.filter((v): v is string => typeof v === "string" && staff.has(v)))).slice(0, FOLLOW_UP_LIMITS.taskPeople)
    : [];
  if (!people.length) return "bad_people";
  const isAuthor = access === "author";
  const readers = new Set([row.author_account_id, ...recipients.map((r) => r.account_id)]);
  if (!taskPeopleAllowed({ confidential: row.confidential, isAuthor, readers }, people)) return "people_not_allowed";
  const priority: TaskPriority = (TASK_PRIORITIES as readonly unknown[]).includes(body.priority) ? (body.priority as TaskPriority) : "medium";

  const { data: todo, error } = await supabaseServer.from("koleex_todos").insert({
    title,
    description: taskContext(row, staff.get(row.author_account_id)?.name ?? "", line?.text ?? null, title),
    metadata: { report: { id: row.id, version: row.version, ...(line ? { section: line.section, item: line.item } : {}) }, created_via: "reports" },
    completed: false,
    completed_at: null,
    status: "todo",
    priority,
    due_date: taskDue(body.due),
    created_by_account_id: auth.account_id,
    assigned_by_account_id: auth.account_id,
    source: "report",
    source_id: row.id,
    assign_to_all: false,
    is_private: false,
    tenant_id: auth.tenant_id,
  }).select("id, title, description, priority, tenant_id").single();
  if (error || !todo) {
    console.error("[reports] task:", error?.message);
    throw new Error(error?.message ?? "task not written");
  }
  const created = todo as { id: string; title: string; description: string | null; priority: string; tenant_id: string | null };
  const assigneeIds = await resolveAssigneeIds({ explicit: people, department: null, everyone: false, tenantId: auth.tenant_id });
  if (assigneeIds.length) {
    const { error: aErr } = await supabaseServer.from("koleex_todo_assignees").insert(assigneeIds.map((account_id) => ({ todo_id: created.id, account_id })));
    if (aErr) console.error("[reports] task assignees:", aErr.message);
  }
  /* The report goes along to an assignee who cannot read it yet — only
     where this viewer may forward it, and the task's own notice is the one
     they get (no second one about the forward). */
  let shared: string[] = [];
  if (body.share === true && mayForward(forwardFacts(loaded))) {
    const chain = row.confidential ? [] : (await loadOrgTree(auth.tenant_id)).chainOf(row.author_account_id);
    const canRead = new Set([...readers, ...chain]);
    const add = assigneeIds.filter((a) => !canRead.has(a));
    if (add.length && recipients.length + add.length <= REPORT_LIMITS.recipients) shared = await addForwarded(row, add, auth.account_id, null);
  }
  await notifyTodoAssigned(created, assigneeIds, auth.account_id);
  await pingTodosChanged(auth.tenant_id);
  return { id: created.id, shared };
}

type TaskRow = { id: string; title: string; status: ReportTask["status"]; approval_state: ReportTask["approval"]; due_date: string | null; source_id: string; metadata: { report?: { section?: unknown; item?: unknown } } | null };

/** The tasks made from this report and its earlier versions: those To-do
 *  shows this viewer, and how many there are in all. */
export async function loadReportTasks(auth: ServerAuthContext, row: ReportRow): Promise<{ tasks: ReportTask[]; count: number }> {
  if (row.status === "draft") return { tasks: [], count: 0 };
  const ids = [row.id];
  for (let prev = row.previous_id, i = 0; prev && i < 10; i++) {
    ids.push(prev);
    const { data } = await supabaseServer.from("work_reports").select("previous_id").eq("id", prev).maybeSingle();
    prev = (data as { previous_id: string | null } | null)?.previous_id ?? null;
  }
  let q = supabaseServer.from("koleex_todos").select("id, title, status, approval_state, due_date, source_id, metadata")
    .eq("source", "report").in("source_id", ids).order("created_at", { ascending: true }).limit(200);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const all = (data ?? []) as TaskRow[];
  if (!all.length) return { tasks: [], count: 0 };

  /* What To-do shows this viewer — its own rule, read from its own module. */
  const viewer: TodoViewer = {
    accountId: auth.account_id, tenantId: auth.tenant_id, department: auth.department, isSuperAdmin: !!auth.is_super_admin, canViewPrivate: !!auth.can_view_private,
  };
  const taskIds = new Set(all.map((t) => t.id));
  const shared = (await sharedTodoIds(viewer)).filter((id) => taskIds.has(id));
  let vq = supabaseServer.from("koleex_todos").select("id").in("id", [...taskIds]);
  if (auth.tenant_id) vq = vq.eq("tenant_id", auth.tenant_id);
  const { data: vis, error: vErr } = await applyTodoScope(vq, viewer, shared);
  if (vErr) throw new Error(vErr.message);
  const visible = new Set(((vis ?? []) as Array<{ id: string }>).map((v) => v.id));
  const rows = all.filter((t) => visible.has(t.id));
  if (!rows.length) return { tasks: [], count: all.length };

  const [{ data: assignees }, people] = await Promise.all([
    supabaseServer.from("koleex_todo_assignees").select("todo_id, account_id").in("todo_id", rows.map((r) => r.id)),
    listPeople(auth.tenant_id),
  ]);
  const personOf = new Map(people.map((p) => [p.id, p]));
  const peopleOf = new Map<string, ReportTask["people"]>();
  for (const a of (assignees ?? []) as Array<{ todo_id: string; account_id: string }>) {
    const p = personOf.get(a.account_id);
    const list = peopleOf.get(a.todo_id) ?? [];
    list.push({ id: a.account_id, name: p?.name ?? "—", avatar: p?.avatar ?? null });
    peopleOf.set(a.todo_id, list);
  }
  const tasks: ReportTask[] = rows.map((t) => {
    const at = t.metadata?.report;
    const line = at && typeof at.section === "string" && typeof at.item === "number" ? { section: at.section, item: at.item } : null;
    return { id: t.id, reportId: t.source_id, title: t.title, status: t.status, approval: t.approval_state ?? null, due: t.due_date, people: peopleOf.get(t.id) ?? [], line };
  });
  return { tasks, count: all.length };
}
