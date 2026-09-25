import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertProjectAccess } from "@/lib/server/project-access";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string; mid: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id, mid } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    patch.name = body.name.trim().slice(0, 200);
  }
  if ("due_date" in body) {
    const v = body.due_date;
    if (v && !(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))) return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
    patch.due_date = v || null;
  }
  if ("is_reached" in body) patch.is_reached = body.is_reached === true;
  if ("color" in body) patch.color = typeof body.color === "string" ? body.color : null;
  if ("sort_order" in body) {
    if (!Number.isInteger(body.sort_order)) return NextResponse.json({ error: "Invalid sort_order" }, { status: 400 });
    patch.sort_order = body.sort_order;
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("project_milestones")
    .update(patch)
    .eq("id", mid)
    .eq("project_id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/:id/milestones/:mid PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }
  return NextResponse.json({ milestone: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "delete");
  if (deny) return deny;
  const { id, mid } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (gate instanceof NextResponse) return gate;

  const { error } = await supabaseServer
    .from("project_milestones")
    .delete()
    .eq("id", mid)
    .eq("project_id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/projects/:id/milestones/:mid DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
