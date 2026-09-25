import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertStageAccess } from "@/lib/server/project-access";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertStageAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    patch.name = body.name.trim().slice(0, 80);
  }
  if ("color" in body) patch.color = typeof body.color === "string" ? body.color : null;
  if ("sort_order" in body) {
    if (!Number.isInteger(body.sort_order)) return NextResponse.json({ error: "Invalid sort_order" }, { status: 400 });
    patch.sort_order = body.sort_order;
  }
  if ("is_closed" in body) patch.is_closed = body.is_closed === true;
  if ("is_default_new" in body) patch.is_default_new = body.is_default_new === true;

  const { data, error } = await supabaseServer
    .from("project_stages")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/stages/:id PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update stage" }, { status: 500 });
  }
  return NextResponse.json({ stage: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "delete");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertStageAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  /* A board with no columns has nowhere to put a task — keep at least one. */
  const { count } = await supabaseServer
    .from("project_stages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", auth.tenant_id)
    .eq("project_id", gate.stage.project_id);
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: "A project needs at least one stage", code: "last_stage" }, { status: 409 });
  }

  // Tasks in this stage have stage_id set to NULL via FK ON DELETE SET NULL;
  // the board shows them in an "Unstaged" column.
  const { error } = await supabaseServer
    .from("project_stages")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/projects/stages/:id DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete stage" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
