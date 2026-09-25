import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertProjectAccess } from "@/lib/server/project-access";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await supabaseServer
    .from("project_milestones")
    .select("*")
    .eq("project_id", id)
    .eq("tenant_id", auth.tenant_id)
    .order("sort_order", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("[api/projects/:id/milestones GET]", error.message);
    return NextResponse.json({ error: "Failed to load milestones" }, { status: 500 });
  }
  return NextResponse.json({ milestones: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "create");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => ({}))) as { name?: string; due_date?: string | null; color?: string | null; sort_order?: number };
  if (typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (body.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("project_milestones")
    .insert({
      tenant_id: auth.tenant_id,
      project_id: id,
      name: body.name.trim().slice(0, 200),
      due_date: body.due_date || null,
      color: body.color || null,
      sort_order: Number.isInteger(body.sort_order) ? body.sort_order : 0,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/:id/milestones POST]", error.message);
    return NextResponse.json({ error: "Failed to add milestone" }, { status: 500 });
  }
  return NextResponse.json({ milestone: data });
}
