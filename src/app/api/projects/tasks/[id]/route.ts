import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyTaskAssigned } from "@/lib/server/project-notify";
import { recomputeProjectProgress } from "@/lib/server/project-progress";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;

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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task: data });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json()) as Record<string, unknown>;
  const allowed = [
    "stage_id", "parent_task_id",
    "title", "description", "priority",
    "assignee_account_id", "followers_account_ids", "tag_ids",
    "due_date", "start_date", "estimated_hours", "logged_hours",
    "progress_pct", "status",
    "linked_planning_item_id", "linked_entity_type", "linked_entity_id", "linked_entity_label",
    "sort_order",
  ];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];

  // Look at previous assignee / status so we can fire notifications +
  // stamp closed_at automatically on the "done" transition.
  const { data: prev } = await supabaseServer
    .from("project_tasks")
    .select("assignee_account_id, status, title, project_id, due_date")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  if (patch.status === "done" && prev?.status !== "done") {
    patch.closed_at = new Date().toISOString();
    patch.progress_pct = 100;
  }
  if (patch.status && patch.status !== "done") {
    patch.closed_at = null;
  }

  const { data, error } = await supabaseServer
    .from("project_tasks")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify on fresh assignment (not on re-save with same assignee) —
  // inbox + web-push — and keep the project's progress % in sync.
  const newAssignee = data?.assignee_account_id as string | null;
  if (newAssignee && newAssignee !== prev?.assignee_account_id) {
    void notifyTaskAssigned(auth, data);
  }
  void recomputeProjectProgress(auth.tenant_id, data?.project_id as string | null);

  return NextResponse.json({ task: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "delete");
  if (deny) return deny;
  const { id } = await params;

  const { data: victim } = await supabaseServer
    .from("project_tasks")
    .select("project_id")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();

  const { error } = await supabaseServer
    .from("project_tasks")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  void recomputeProjectProgress(auth.tenant_id, victim?.project_id as string | null);
  return NextResponse.json({ ok: true });
}
