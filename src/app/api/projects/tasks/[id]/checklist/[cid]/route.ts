import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertTaskAccess } from "@/lib/server/project-access";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string; cid: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id, cid } = await params;
  const gate = await assertTaskAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "Empty item" }, { status: 400 });
    patch.title = body.title.trim().slice(0, 500);
  }
  if ("is_done" in body) patch.is_done = body.is_done === true;
  if ("sort_order" in body) {
    if (!Number.isInteger(body.sort_order)) return NextResponse.json({ error: "Invalid sort_order" }, { status: 400 });
    patch.sort_order = body.sort_order;
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("project_task_checklist_items")
    .update(patch)
    .eq("id", cid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/tasks/:id/checklist/:cid PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id, cid } = await params;
  const gate = await assertTaskAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { error } = await supabaseServer
    .from("project_task_checklist_items")
    .delete()
    .eq("id", cid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/projects/tasks/:id/checklist/:cid DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
