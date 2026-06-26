import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("project_milestones")
    .select("*")
    .eq("project_id", id)
    .eq("tenant_id", auth.tenant_id)
    .order("sort_order", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestones: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "create");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json()) as { name?: string; due_date?: string | null; color?: string | null; sort_order?: number };
  if (!body.name || !body.name.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("project_milestones")
    .insert({
      tenant_id: auth.tenant_id,
      project_id: id,
      name: body.name.trim().slice(0, 200),
      due_date: body.due_date || null,
      color: body.color || null,
      sort_order: body.sort_order ?? 0,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ milestone: data });
}
