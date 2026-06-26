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
    .from("project_task_checklist_items")
    .select("*")
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;

  const { title, sort_order } = (await req.json()) as { title?: string; sort_order?: number };
  if (!title || !title.trim()) return NextResponse.json({ error: "Empty item" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("project_task_checklist_items")
    .insert({
      tenant_id: auth.tenant_id,
      task_id: id,
      title: title.trim().slice(0, 500),
      sort_order: sort_order ?? 0,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
