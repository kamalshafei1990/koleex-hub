import "server-only";

/* POST /api/projects/tasks/bulk — one request for a multi-select action.

   Body: { task_ids: uuid[] (1..500), action, value }
     action "stage"    value: stage uuid   (all tasks must share a project)
     action "status"   value: open|done|cancelled
     action "assign"   value: account uuid | null
     action "due"      value: YYYY-MM-DD | null
     action "priority" value: low|normal|high|urgent
     action "delete"   value: ignored

   Access — the SAME rules as the single-task routes, per task:
     · the project gate with { write: true } (super admin, manager, creator,
       non-viewer member, assignee of a task in it), OR
     · the task's own assignee / creator (assertTaskAccess's first path).
   Any task outside the caller's reach fails the WHOLE request (403) —
   nothing is half-applied.

   Stage and status go through reconcileStageStatus exactly like the PATCH
   and reorder routes (closed stage ⇒ done, reopened ⇒ first open stage,
   closed_at / progress stamped). Values are validated by validateTaskWrite.
   Moved tasks append to the bottom of the target column. */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { assertProjectAccess, UUID_RE } from "@/lib/server/project-access";
import {
  checkDateOrder,
  loadStages,
  reconcileStageStatus,
  validateTaskWrite,
  type StageLite,
} from "@/lib/server/project-task-rules";
import { recomputeProjectProgress } from "@/lib/server/project-progress";
import { clearTaskNotifications, notifyTaskAssigned } from "@/lib/server/project-notify";
import { removeTaskAttachmentFiles } from "@/lib/server/project-files";
import { syncProjectMembersFromAssignees } from "@/lib/server/project-members";

const ACTIONS = ["stage", "status", "assign", "due", "priority", "delete"] as const;
type Action = (typeof ACTIONS)[number];

interface Row {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  stage_id: string | null;
  status: string;
  due_date: string | null;
  start_date: string | null;
  sort_order: number;
  closed_at: string | null;
  progress_pct: number;
  assignee_account_id: string | null;
  created_by_account_id: string | null;
}

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as { task_ids?: unknown; action?: unknown; value?: unknown } | null;
  const action = body?.action as Action;
  if (!ACTIONS.includes(action)) return bad("Invalid action");
  const deny = await requireModuleAction(auth, "Projects", action === "delete" ? "delete" : "edit");
  if (deny) return deny;

  const raw = Array.isArray(body?.task_ids) ? (body!.task_ids as unknown[]) : [];
  if (raw.length === 0 || raw.length > 500 || !raw.every((x) => typeof x === "string" && UUID_RE.test(x))) {
    return bad("Invalid task_ids");
  }
  const ids = [...new Set(raw as string[])];

  const { data, error } = await supabaseServer
    .from("project_tasks")
    .select("id, tenant_id, project_id, title, stage_id, status, due_date, start_date, sort_order, closed_at, progress_pct, assignee_account_id, created_by_account_id")
    .eq("tenant_id", auth.tenant_id)
    .in("id", ids);
  if (error) {
    console.error("[api/projects/tasks/bulk] read:", error.message);
    return bad("Failed to load tasks", 500);
  }
  const rows = (data ?? []) as Row[];
  if (rows.length !== ids.length) return bad("Task not found", 404);

  /* ── Access: one project gate per distinct project, then the per-task
        assignee/creator fallback for projects the gate refused. ── */
  const projectIds = [...new Set(rows.map((r) => r.project_id))];
  const gates = await Promise.all(projectIds.map((pid) => assertProjectAccess(auth, pid, { write: true })));
  const writable = new Set(projectIds.filter((_, i) => !(gates[i] instanceof NextResponse)));
  for (const r of rows) {
    if (writable.has(r.project_id)) continue;
    if (r.assignee_account_id === auth.account_id || r.created_by_account_id === auth.account_id) continue;
    return bad("Forbidden", 403);
  }

  const value = body?.value;

  /* ── Delete ── */
  if (action === "delete") {
    const { data: subs } = await supabaseServer
      .from("project_tasks").select("id").eq("tenant_id", auth.tenant_id).in("parent_task_id", ids);
    const allIds = [...new Set([...ids, ...((subs ?? []).map((r) => (r as { id: string }).id))])];
    const { data: files } = await supabaseServer
      .from("project_task_attachments").select("file_path").eq("tenant_id", auth.tenant_id).in("task_id", allIds);
    const { error: delErr } = await supabaseServer.from("project_tasks").delete().eq("tenant_id", auth.tenant_id).in("id", ids);
    if (delErr) {
      console.error("[api/projects/tasks/bulk] delete:", delErr.message);
      return bad("Failed to delete tasks", 500);
    }
    const paths = (files ?? []).map((f) => (f as { file_path: string }).file_path);
    after(async () => {
      await removeTaskAttachmentFiles(paths);
      for (const id of ids) await clearTaskNotifications(id);
      for (const pid of projectIds) await recomputeProjectProgress(auth.tenant_id, pid);
    });
    return NextResponse.json({ ok: true, deleted: ids.length });
  }

  /* ── Stage / status: per-task reconcile, one upsert ── */
  if (action === "stage" || action === "status") {
    if (action === "stage" && projectIds.length !== 1) return bad("Tasks must be in one project to change their stage");
    const stagesByProject = new Map<string, StageLite[]>();
    await Promise.all(projectIds.map(async (pid) => stagesByProject.set(pid, await loadStages(auth.tenant_id, pid))));

    const field = action === "stage" ? "stage_id" : "status";
    const first = rows[0];
    const checked = await validateTaskWrite({
      tenantId: auth.tenant_id,
      projectId: first.project_id,
      taskId: null,
      body: { [field]: value },
      allowed: [field],
      stages: stagesByProject.get(first.project_id) ?? [],
    });
    if ("error" in checked) return bad(checked.error);

    /* Next free sort_order per (project, stage) so moved cards append. */
    const maxOrder = new Map<string, number>();
    const orderKey = (pid: string, sid: string | null) => `${pid}:${sid ?? ""}`;
    const now = new Date().toISOString();
    const upserts: Record<string, unknown>[] = [];
    const becameDone: string[] = [];

    for (const r of rows) {
      const stages = stagesByProject.get(r.project_id) ?? [];
      const patch = reconcileStageStatus({ status: r.status, stage_id: r.stage_id }, { ...checked.patch }, stages);
      const nextStage = ("stage_id" in patch ? patch.stage_id : r.stage_id) as string | null;
      const nextStatus = ("status" in patch ? patch.status : r.status) as string;
      if (nextStage === r.stage_id && nextStatus === r.status) continue;

      let sort = r.sort_order;
      if (nextStage !== r.stage_id) {
        const k = orderKey(r.project_id, nextStage);
        if (!maxOrder.has(k)) {
          let mq = supabaseServer.from("project_tasks").select("sort_order")
            .eq("tenant_id", auth.tenant_id).eq("project_id", r.project_id);
          mq = nextStage ? mq.eq("stage_id", nextStage) : mq.is("stage_id", null);
          const { data: top } = await mq.order("sort_order", { ascending: false }).limit(1).maybeSingle();
          maxOrder.set(k, Number((top as { sort_order: number } | null)?.sort_order ?? -1));
        }
        sort = maxOrder.get(k)! + 1;
        maxOrder.set(k, sort);
      }
      const done = nextStatus === "done";
      if (done && r.status !== "done") becameDone.push(r.id);
      /* Every row carries the same key set (bulk upsert requirement); the
         NOT NULL columns ride along unchanged so only the UPDATE arm runs. */
      upserts.push({
        id: r.id,
        tenant_id: r.tenant_id,
        project_id: r.project_id,
        title: r.title,
        stage_id: nextStage,
        status: nextStatus,
        sort_order: sort,
        closed_at: done ? (r.status === "done" ? r.closed_at : now) : null,
        progress_pct: done && r.status !== "done" ? 100 : r.progress_pct,
      });
    }
    if (upserts.length > 0) {
      const { error: upErr } = await supabaseServer.from("project_tasks").upsert(upserts, { onConflict: "id" });
      if (upErr) {
        console.error("[api/projects/tasks/bulk] upsert:", upErr.message);
        return bad("Failed to update tasks", 500);
      }
    }
    after(async () => {
      for (const id of becameDone) await clearTaskNotifications(id);
      for (const pid of projectIds) await recomputeProjectProgress(auth.tenant_id, pid);
    });
    return NextResponse.json({ ok: true, updated: upserts.length });
  }

  /* ── Assign / due / priority: one validated patch for every task ── */
  const field = action === "assign" ? "assignee_account_id" : action === "due" ? "due_date" : "priority";
  const checked = await validateTaskWrite({
    tenantId: auth.tenant_id,
    projectId: rows[0].project_id,
    taskId: null,
    body: { [field]: value },
    allowed: [field],
    stages: [],
  });
  if ("error" in checked) return bad(checked.error);
  if (action === "due") {
    const clash = rows.find((r) => checkDateOrder(r, checked.patch));
    if (clash) return bad("Start date must be on or before the due date");
  }
  const { error: upErr } = await supabaseServer
    .from("project_tasks")
    .update(checked.patch)
    .eq("tenant_id", auth.tenant_id)
    .in("id", ids);
  if (upErr) {
    console.error("[api/projects/tasks/bulk] update:", upErr.message);
    return bad("Failed to update tasks", 500);
  }

  if (action === "assign") {
    const who = checked.patch.assignee_account_id as string | null;
    if (who) {
      const fresh = rows.filter((r) => r.assignee_account_id !== who);
      after(async () => {
        for (const r of fresh) await notifyTaskAssigned(auth, { id: r.id, title: r.title, project_id: r.project_id, due_date: r.due_date, assignee_account_id: who });
        for (const pid of new Set(fresh.map((r) => r.project_id))) await syncProjectMembersFromAssignees(auth, pid, [who]);
      });
    }
  }
  return NextResponse.json({ ok: true, updated: ids.length });
}
