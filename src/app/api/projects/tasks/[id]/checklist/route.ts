import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertTaskAccess } from "@/lib/server/project-access";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await supabaseServer
    .from("project_task_checklist_items")
    .select("*")
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[api/projects/tasks/:id/checklist GET]", error.message);
    return NextResponse.json({ error: "Failed to load checklist" }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskAccess(auth, id, { write: true });
  if (gate instanceof NextResponse) return gate;

  const { title, sort_order } = (await req.json().catch(() => ({}))) as { title?: string; sort_order?: number };
  if (typeof title !== "string" || !title.trim()) return NextResponse.json({ error: "Empty item" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("project_task_checklist_items")
    .insert({
      tenant_id: auth.tenant_id,
      task_id: id,
      title: title.trim().slice(0, 500),
      sort_order: Number.isInteger(sort_order) ? sort_order : 0,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/tasks/:id/checklist POST]", error.message);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}
