import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/projects/tasks — list tasks across one or all projects.
     Query:
       project_id=<uuid>        scope to a single project
       mine=1                   only tasks assigned to the caller
       status=open|done|cancelled|all   default: open
       priority=low|normal|high|urgent
       search=<text>            ilike over title
       linked_entity_type + linked_entity_id    attached to a Hub entity
       stage_id=<uuid>          single kanban column
   POST /api/projects/tasks — create a new task. */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("project_id");
  const mine = url.searchParams.get("mine") === "1";
  const status = url.searchParams.get("status") ?? "open";
  const priority = url.searchParams.get("priority");
  const search = url.searchParams.get("search")?.trim();
  const stageId = url.searchParams.get("stage_id");
  const linkedType = url.searchParams.get("linked_entity_type");
  const linkedId = url.searchParams.get("linked_entity_id");

  let q = supabaseServer
    .from("project_tasks")
    .select(
      `id, tenant_id, project_id, stage_id, parent_task_id,
       title, description, priority, assignee_account_id, followers_account_ids,
       tag_ids, due_date, start_date, estimated_hours, logged_hours,
       progress_pct, status,
       linked_planning_item_id, linked_entity_type, linked_entity_id, linked_entity_label,
       sort_order, closed_at, created_at, updated_at,
       project:project_id ( id, name, color ),
       stage:stage_id ( id, name, color, is_closed, is_default_new, sort_order ),
       assignee:assignee_account_id ( id, username )`,
    )
    .eq("tenant_id", auth.tenant_id);

  if (projectId) q = q.eq("project_id", projectId);
  if (mine) q = q.eq("assignee_account_id", auth.account_id);
  if (status !== "all") q = q.eq("status", status);
  if (priority) q = q.eq("priority", priority);
  if (stageId) q = q.eq("stage_id", stageId);
  if (linkedType) q = q.eq("linked_entity_type", linkedType);
  if (linkedId) q = q.eq("linked_entity_id", linkedId);
  if (search) q = q.ilike("title", `%${search}%`);

  q = q.order("sort_order", { ascending: true }).order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[api/projects/tasks GET]", error.message);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;

  const body = (await req.json()) as {
    project_id: string;
    title: string;
    description?: string | null;
    stage_id?: string | null;
    priority?: "low" | "normal" | "high" | "urgent";
    assignee_account_id?: string | null;
    followers_account_ids?: string[];
    tag_ids?: string[];
    due_date?: string | null;
    start_date?: string | null;
    estimated_hours?: number | null;
    parent_task_id?: string | null;
    linked_planning_item_id?: string | null;
    linked_entity_type?: string | null;
    linked_entity_id?: string | null;
    linked_entity_label?: string | null;
  };
  if (!body.project_id || !body.title?.trim()) {
    return NextResponse.json({ error: "project_id and title required" }, { status: 400 });
  }

  // Default the stage to the project's is_default_new column.
  let stageId = body.stage_id ?? null;
  if (!stageId) {
    const { data: def } = await supabaseServer
      .from("project_stages")
      .select("id")
      .eq("tenant_id", auth.tenant_id)
      .eq("project_id", body.project_id)
      .eq("is_default_new", true)
      .maybeSingle();
    stageId = def?.id ?? null;
  }

  const { data, error } = await supabaseServer
    .from("project_tasks")
    .insert({
      tenant_id: auth.tenant_id,
      project_id: body.project_id,
      stage_id: stageId,
      parent_task_id: body.parent_task_id ?? null,
      title: body.title.trim(),
      description: body.description ?? null,
      priority: body.priority ?? "normal",
      assignee_account_id: body.assignee_account_id ?? null,
      followers_account_ids: body.followers_account_ids ?? [],
      tag_ids: body.tag_ids ?? [],
      due_date: body.due_date ?? null,
      start_date: body.start_date ?? null,
      estimated_hours: body.estimated_hours ?? null,
      linked_planning_item_id: body.linked_planning_item_id ?? null,
      linked_entity_type: body.linked_entity_type ?? null,
      linked_entity_id: body.linked_entity_id ?? null,
      linked_entity_label: body.linked_entity_label ?? null,
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/tasks POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget inbox notification when assignee is set + not self.
  if (data?.assignee_account_id && data.assignee_account_id !== auth.account_id) {
    void supabaseServer.from("inbox_messages").insert({
      recipient_account_id: data.assignee_account_id,
      sender_account_id: auth.account_id,
      tenant_id: auth.tenant_id,
      category: "system",
      subject: `Task assigned: ${data.title}`,
      body: `You've been assigned a task${data.due_date ? ` due ${data.due_date}` : ""}.`,
      link: "/projects",
      metadata: { source: "projects", task_id: data.id, project_id: data.project_id },
    });
  }

  return NextResponse.json({ task: data });
}
