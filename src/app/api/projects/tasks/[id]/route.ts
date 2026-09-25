import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyTaskAssigned, clearTaskNotifications } from "@/lib/server/project-notify";
import { recomputeProjectProgress } from "@/lib/server/project-progress";
import { assertTaskAccess } from "@/lib/server/project-access";
import { checkDateOrder, loadStages, reconcileStageStatus, validateTaskWrite } from "@/lib/server/project-task-rules";
import { removeTaskAttachmentFiles } from "@/lib/server/project-files";
import { syncProjectMembersFromAssignees } from "@/lib/server/project-members";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

/* logged_hours is NOT here: it is derived from project_time_entries
   (src/lib/server/project-time.ts) and must never be hand-written. */
const PATCHABLE = [
  "stage_id", "parent_task_id",
  "title", "description", "priority",
  "assignee_account_id", "followers_account_ids", "tag_ids",
  "blocked_by_task_ids",
  "due_date", "start_date", "estimated_hours",
  "progress_pct", "status",
  "linked_planning_item_id", "linked_entity_type", "linked_entity_id", "linked_entity_label",
  "sort_order",
] as const;

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await supabaseServer
    .from("project_tasks")
    .select(
      `*,
       project:project_id ( id, name, color ),
       stage:stage_id ( id, name, color, is_closed, is_default_new, sort_order ),
       assignee:assignee_account_id ( id, username )`,
    )
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    console.error("[api/projects/tasks/:id GET]", error.message);
    return NextResponse.json({ error: "Failed to load task" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task: data });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskAccess(auth, id, { write: true });
  if (gate instanceof NextResponse) return gate;
  const prev = gate.task;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const stages = await loadStages(auth.tenant_id, prev.project_id);
  const checked = await validateTaskWrite({
    tenantId: auth.tenant_id,
    projectId: prev.project_id,
    taskId: id,
    body,
    allowed: PATCHABLE,
    stages,
  });
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const dateErr = checkDateOrder(prev, checked.patch);
  if (dateErr) return NextResponse.json({ error: dateErr, code: "date_order" }, { status: 400 });
  const patch = reconcileStageStatus({ status: prev.status, stage_id: prev.stage_id }, checked.patch, stages);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("project_tasks")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/tasks/:id PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }

  /* Post-response side effects: notify on a fresh assignment (inbox +
     push), clear finished notifications on done, keep project % in sync.
     after() keeps them alive past the response on serverless — `void`
     could be frozen mid-flight. */
  const newAssignee = data?.assignee_account_id as string | null;
  const becameDone = data?.status === "done" && prev.status !== "done";
  after(async () => {
    if (newAssignee && newAssignee !== prev.assignee_account_id) {
      await notifyTaskAssigned(auth, data);
      await syncProjectMembersFromAssignees(auth, prev.project_id, [newAssignee]);
    }
    if (becameDone) await clearTaskNotifications(id);
    await recomputeProjectProgress(auth.tenant_id, prev.project_id);
  });

  return NextResponse.json({ task: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "delete");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskAccess(auth, id, { write: true });
  if (gate instanceof NextResponse) return gate;

  /* Collect storage paths BEFORE the cascade removes the attachment rows
     (this task and any subtasks cascading with it). */
  const { data: subs } = await supabaseServer
    .from("project_tasks")
    .select("id")
    .eq("tenant_id", auth.tenant_id)
    .eq("parent_task_id", id);
  const taskIds = [id, ...((subs ?? []).map((r) => (r as { id: string }).id))];
  const { data: files } = await supabaseServer
    .from("project_task_attachments")
    .select("file_path")
    .eq("tenant_id", auth.tenant_id)
    .in("task_id", taskIds);

  const { error } = await supabaseServer
    .from("project_tasks")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/projects/tasks/:id DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
  const paths = (files ?? []).map((f) => (f as { file_path: string }).file_path);
  after(async () => {
    await removeTaskAttachmentFiles(paths);
    await clearTaskNotifications(id);
    await recomputeProjectProgress(auth.tenant_id, gate.task.project_id);
  });
  return NextResponse.json({ ok: true });
}
