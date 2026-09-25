import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyTaskAssigned } from "@/lib/server/project-notify";
import { recomputeProjectProgress } from "@/lib/server/project-progress";
import { assertProjectAccess, likeTerm, memberProjectIds, UUID_RE } from "@/lib/server/project-access";
import { syncProjectMembersFromAssignees } from "@/lib/server/project-members";
import { checkDateOrder, loadStages, reconcileStageStatus, validateTaskWrite } from "@/lib/server/project-task-rules";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

/* GET  /api/projects/tasks — list tasks across one or all projects.
     Query:
       project_id=<uuid>        scope to a single project
       parent_task_id=<uuid>    only the subtasks of one task
       mine=1                   only tasks assigned to the caller
       status=open|done|cancelled|all   default: open
       priority=low|normal|high|urgent
       search=<text>            ilike over title
       linked_entity_type + linked_entity_id    attached to a Hub entity
       stage_id=<uuid>          single kanban column
       assignee=<uuid>          only tasks assigned to that account
       tag=<uuid>               only tasks carrying that tag
       due_lte=YYYY-MM-DD       only tasks due on/before that day
       limit=<n>                default 500, max 2000
   POST /api/projects/tasks — create a new task. */

/* Card + form columns only — no tenant_id / followers / updated_at, which
   no list screen reads. start_date feeds the Timeline view. */
const LIST_COLS = `id, project_id, stage_id, parent_task_id,
  title, description, priority, assignee_account_id,
  tag_ids, blocked_by_task_ids, due_date, start_date, estimated_hours, logged_hours,
  progress_pct, status,
  linked_planning_item_id, linked_entity_type, linked_entity_id, linked_entity_label,
  sort_order, closed_at, created_at,
  project:project_id ( id, name, color ),
  stage:stage_id ( id, name, color, is_closed, is_default_new, sort_order ),
  assignee:assignee_account_id ( id, username )`;

const CREATABLE = [
  "title", "description", "stage_id", "priority", "status",
  "assignee_account_id", "blocked_by_task_ids", "followers_account_ids", "tag_ids",
  "due_date", "start_date", "estimated_hours", "parent_task_id",
  "linked_planning_item_id", "linked_entity_type", "linked_entity_id", "linked_entity_label",
] as const;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("project_id");
  const parentId = url.searchParams.get("parent_task_id");
  const mine = url.searchParams.get("mine") === "1";
  const status = url.searchParams.get("status") ?? "open";
  const priority = url.searchParams.get("priority");
  const search = url.searchParams.get("search")?.trim();
  const stageId = url.searchParams.get("stage_id");
  const linkedType = url.searchParams.get("linked_entity_type");
  const linkedId = url.searchParams.get("linked_entity_id");
  const assignee = url.searchParams.get("assignee");
  const tag = url.searchParams.get("tag");
  const dueLte = url.searchParams.get("due_lte");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 500, 1), 2000);

  if (dueLte && !/^\d{4}-\d{2}-\d{2}$/.test(dueLte)) return NextResponse.json({ tasks: [] });
  for (const v of [projectId, parentId, stageId, linkedId, assignee, tag]) {
    if (v && !UUID_RE.test(v)) return NextResponse.json({ tasks: [] });
  }

  let q = supabaseServer.from("project_tasks").select(LIST_COLS).eq("tenant_id", auth.tenant_id);

  if (projectId) q = q.eq("project_id", projectId);
  if (parentId) q = q.eq("parent_task_id", parentId);
  if (mine) q = q.eq("assignee_account_id", auth.account_id);

  // Type C scope: non-SA callers see tasks they're involved in (assignee or
  // creator) plus every task inside projects they manage, created, or are
  // a member of (project_members — any role, viewers read too).
  if (!auth.is_super_admin) {
    const [{ data: myProjects }, memberOf] = await Promise.all([
      supabaseServer
        .from("projects")
        .select("id")
        .eq("tenant_id", auth.tenant_id)
        .or(`manager_account_id.eq.${auth.account_id},created_by_account_id.eq.${auth.account_id}`),
      memberProjectIds(auth.tenant_id, auth.account_id),
    ]);
    const pids = [...new Set([...(myProjects ?? []).map((r) => (r as { id: string }).id), ...memberOf])];
    const orParts = [
      `assignee_account_id.eq.${auth.account_id}`,
      `created_by_account_id.eq.${auth.account_id}`,
    ];
    if (pids.length > 0) orParts.push(`project_id.in.(${pids.join(",")})`);
    q = q.or(orParts.join(","));
  }
  if (status !== "all") q = q.eq("status", status);
  if (priority) q = q.eq("priority", priority);
  if (stageId) q = q.eq("stage_id", stageId);
  if (linkedType) q = q.eq("linked_entity_type", linkedType);
  if (linkedId) q = q.eq("linked_entity_id", linkedId);
  if (assignee) q = q.eq("assignee_account_id", assignee);
  if (tag) q = q.contains("tag_ids", [tag]);
  if (dueLte) q = q.lte("due_date", dueLte);
  if (search) q = q.ilike("title", likeTerm(search));

  q = q.order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(limit);

  const { data, error } = await q;
  if (error) {
    console.error("[api/projects/tasks GET]", error.message);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
  /* No max-age: the client always reads this with cache:"no-store", so a
     cacheable header only invited a stale board after a write. */
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const projectId = typeof body?.project_id === "string" ? body.project_id : "";
  if (!body || !projectId || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "project_id and title required" }, { status: 400 });
  }
  const gate = await assertProjectAccess(auth, projectId, { write: true });
  if (gate instanceof NextResponse) return gate;

  const stages = await loadStages(auth.tenant_id, projectId);
  const checked = await validateTaskWrite({
    tenantId: auth.tenant_id,
    projectId,
    taskId: null,
    body,
    allowed: CREATABLE,
    stages,
  });
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const fields = checked.patch;
  const dateErr = checkDateOrder(null, fields);
  if (dateErr) return NextResponse.json({ error: dateErr, code: "date_order" }, { status: 400 });

  // Default the stage to the project's is_default_new column.
  if (!fields.stage_id) {
    fields.stage_id = stages.find((s) => s.is_default_new)?.id ?? null;
  }
  const row = reconcileStageStatus(null, { ...fields, stage_id: fields.stage_id }, stages);

  const { data, error } = await supabaseServer
    .from("project_tasks")
    .insert({
      priority: "normal",
      followers_account_ids: [],
      tag_ids: [],
      blocked_by_task_ids: [],
      ...row,
      tenant_id: auth.tenant_id,
      project_id: projectId,
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/tasks POST]", error.message);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  // After the response: notify the assignee and keep project % in sync.
  after(async () => {
    await notifyTaskAssigned(auth, data);
    await recomputeProjectProgress(auth.tenant_id, projectId);
    const who = data?.assignee_account_id as string | null;
    if (who) await syncProjectMembersFromAssignees(auth, projectId, [who]);
  });

  return NextResponse.json({ task: data });
}
