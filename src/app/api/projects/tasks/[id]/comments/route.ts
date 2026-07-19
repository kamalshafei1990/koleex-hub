import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyTaskComment } from "@/lib/server/project-notify";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("project_task_comments")
    .select(`*, author:author_account_id ( id, username )`)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;

  const { body } = (await req.json()) as { body?: string };
  if (!body || !body.trim()) return NextResponse.json({ error: "Empty comment" }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("project_task_comments")
    .insert({
      tenant_id: auth.tenant_id,
      task_id: id,
      author_account_id: auth.account_id,
      body: body.trim().slice(0, 5000),
    })
    .select(`*, author:author_account_id ( id, username )`)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: ping the task's assignee + followers (inbox + push).
  void notifyTaskComment(auth, id, body);

  return NextResponse.json({ comment: data });
}
